import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  canEncodeAudio,
  Conversion,
  getFirstEncodableAudioCodec,
  getFirstEncodableVideoCodec,
  Input,
  Mp3OutputFormat,
  Mp4OutputFormat,
  OggOutputFormat,
  Output,
  Quality,
  WavOutputFormat,
  WebMOutputFormat,
  type OutputFormat as MuxFormat,
} from "mediabunny"
import { registerMp3Encoder } from "@mediabunny/mp3-encoder"
import { TARGET_SLACK, targetBytes } from "./target"
import type { AudioFormat, AudioSettings, ErrorCode, MediaResult, VideoFormat, VideoSettings } from "./types"

// Video and audio cannot go through a canvas efficiently, so they use WebCodecs (the browser's
// built-in hardware encoders) through the mediabunny library. Everything still runs locally.

export class MediaError extends Error {
  code:ErrorCode
  constructor(code:ErrorCode) {
    super(code)
    this.code=code
  }
}

export class Canceled extends Error {}

export const VIDEO_LABELS:Record<VideoFormat,string>={ mp4:"MP4", webm:"WebM" }
export const AUDIO_LABELS:Record<AudioFormat,string>={ mp3:"MP3", m4a:"M4A", ogg:"OGG", wav:"WAV" }

// Browsers without a native MP3 encoder get a WebAssembly one.
let mp3Registered=false
async function ensureMp3() {
  if (mp3Registered) return
  if (!(await canEncodeAudio("mp3"))) registerMp3Encoder()
  mp3Registered=true
}

function videoMuxer(format:VideoFormat):MuxFormat {
  return format==="mp4"?new Mp4OutputFormat({ fastStart:"in-memory" }):new WebMOutputFormat()
}

async function audioMuxer(format:AudioFormat):Promise<MuxFormat> {
  if (format==="mp3") {
    await ensureMp3()
    return new Mp3OutputFormat()
  }
  if (format==="m4a") return new Mp4OutputFormat({ fastStart:"in-memory" })
  if (format==="ogg") return new OggOutputFormat()
  return new WavOutputFormat()
}

const AUDIO_MIME:Record<AudioFormat,string>={ mp3:"audio/mpeg", m4a:"audio/mp4", ogg:"audio/ogg", wav:"audio/wav" }

// MP3 only allows fixed bitrate steps; the other codecs take any value within their range.
const MP3_STEPS=[8,16,24,32,40,48,56,64,80,96,112,128,160,192,224,256,320]

function fitBitrate(format:AudioFormat,kbps:number) {
  if (format==="mp3") return [...MP3_STEPS].reverse().find((s)=>s<=kbps)??8
  return Math.round(Math.min(320,Math.max(format==="m4a"?16:8,kbps)))
}

function openInput(file:Blob) {
  return new Input({ source:new BlobSource(file), formats:ALL_FORMATS })
}

async function run(conversion:Conversion,onProgress:(p:number)=>void,signal:AbortSignal) {
  if (!conversion.isValid) throw new MediaError("codec")
  conversion.onProgress=(p)=>onProgress(p)
  const abort=()=>{
    conversion.cancel()
  }
  signal.addEventListener("abort",abort)
  try {
    await conversion.execute()
  } catch (error) {
    if (signal.aborted) throw new Canceled()
    throw error instanceof MediaError?error:new MediaError("encode")
  } finally {
    signal.removeEventListener("abort",abort)
  }
}

export async function convertVideo(file:Blob,settings:VideoSettings,onProgress:(p:number)=>void,signal:AbortSignal):Promise<MediaResult> {
  const input=openInput(file)
  try {
    const track=await input.getPrimaryVideoTrack().catch(()=>{
      throw new MediaError("decode")
    })
    if (!track) throw new MediaError("no-track")
    const sourceWidth=track.displayWidth
    const sourceHeight=track.displayHeight
    const format=videoMuxer(settings.format)
    const audioCodec=await getFirstEncodableAudioCodec(format.getSupportedAudioCodecs())
    const keepAudio=!settings.removeAudio&&!!audioCodec&&!!(await input.getPrimaryAudioTrack().catch(()=>null))

    // Scale down to the chosen height, never up.
    let height=sourceHeight
    if (settings.maxHeight&&sourceHeight>settings.maxHeight) height=settings.maxHeight

    // With a target size, the budget sets the bitrate: bits available ÷ seconds of footage.
    const budget=targetBytes(settings.target,file.size)
    const length=budget===null?0:await input.computeDuration().catch(()=>0)
    let videoBitrate:number|null=null
    let audioBitrate=128000
    if (budget!==null&&length>0) {
      // 5% is left for the container (headers, index, timestamps).
      const total=budget*8/length*0.95
      audioBitrate=keepAudio?Math.min(128000,Math.max(32000,total*0.12)):0
      videoBitrate=Math.max(40000,total-audioBitrate)
      // Too few bits for many pixels looks worse than fewer, sharper pixels, so lower the resolution
      // until each pixel gets about 0.08 bits per frame at 30 fps.
      const fitHeight=Math.sqrt(videoBitrate/(0.08*30)*sourceHeight/sourceWidth)
      height=Math.min(height,Math.max(144,fitHeight))
    }

    // Encoders want even dimensions.
    height=Math.max(2,Math.round(height/2)*2)
    const width=Math.max(2,Math.round(sourceWidth*height/sourceHeight/2)*2)

    const codec=await getFirstEncodableVideoCodec(format.getSupportedVideoCodecs(),{ width, height })
    if (!codec) throw new MediaError("codec")

    const output=new Output({ format, target:new BufferTarget() })
    const conversion=await Conversion.init({
      input,
      output,
      showWarnings:false,
      video:{ codec, width, height, fit:"contain", forceTranscode:true, quality:videoBitrate?new Quality({ bitrate:Math.round(videoBitrate) }):new Quality({ quality:settings.quality, preferBitrate:true }) },
      audio:!keepAudio||!audioCodec?{ discard:true }:{ codec:audioCodec, quality:budget===null?new Quality({ quality:"medium" }):new Quality({ bitrate:Math.round(audioBitrate) }) },
    })
    await run(conversion,onProgress,signal)

    const buffer=output.target.buffer
    if (!buffer) throw new MediaError("encode")
    const duration=await input.computeDuration().catch(()=>undefined)
    const blob=new Blob([buffer],{ type:format.mimeType })
    return {
      blob,
      ext:settings.format,
      label:VIDEO_LABELS[settings.format],
      width,
      height,
      sourceWidth,
      sourceHeight,
      duration,
      missed:budget!==null&&blob.size>budget*TARGET_SLACK,
    }
  } finally {
    input.dispose()
  }
}

export async function convertAudio(file:Blob,settings:AudioSettings,onProgress:(p:number)=>void,signal:AbortSignal):Promise<MediaResult> {
  const input=openInput(file)
  try {
    const track=await input.getPrimaryAudioTrack().catch(()=>{
      throw new MediaError("decode")
    })
    if (!track) throw new MediaError("no-track")

    const format=await audioMuxer(settings.format)
    const codec=await getFirstEncodableAudioCodec(format.getSupportedAudioCodecs())
    if (!codec) throw new MediaError("codec")

    // With a target size, the bitrate is the budget spread over the length of the track.
    const budget=targetBytes(settings.target,file.size)
    let kbps=settings.bitrate
    if (budget!==null) {
      const length=await input.computeDuration().catch(()=>0)
      if (length>0) kbps=fitBitrate(settings.format,budget*8/length*0.97/1000)
    }

    const output=new Output({ format, target:new BufferTarget() })
    const conversion=await Conversion.init({
      input,
      output,
      showWarnings:false,
      video:{ discard:true },
      audio:{
        codec,
        forceTranscode:true,
        // WAV is uncompressed, so a bitrate makes no sense there.
        ...(settings.format==="wav"?{}:{ quality:new Quality({ bitrate:kbps*1000 }) }),
      },
    })
    await run(conversion,onProgress,signal)

    const buffer=output.target.buffer
    if (!buffer) throw new MediaError("encode")
    const duration=await input.computeDuration().catch(()=>undefined)
    const blob=new Blob([buffer],{ type:AUDIO_MIME[settings.format] })
    return {
      blob,
      ext:settings.format,
      label:AUDIO_LABELS[settings.format],
      duration,
      missed:budget!==null&&blob.size>budget*TARGET_SLACK,
    }
  } finally {
    input.dispose()
  }
}

// Which output formats this browser can actually produce.
export async function detectMediaEncoders() {
  const video={} as Record<VideoFormat,boolean>
  for (const f of ["mp4","webm"] as VideoFormat[]) {
    const fmt=videoMuxer(f)
    video[f]=!!(await getFirstEncodableVideoCodec(fmt.getSupportedVideoCodecs(),{ width:1280, height:720 }).catch(()=>null))
  }
  const audio={} as Record<AudioFormat,boolean>
  for (const f of ["mp3","m4a","ogg","wav"] as AudioFormat[]) {
    const fmt=await audioMuxer(f)
    audio[f]=!!(await getFirstEncodableAudioCodec(fmt.getSupportedAudioCodecs()).catch(()=>null))
  }
  return { video, audio }
}
