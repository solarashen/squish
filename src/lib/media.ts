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

    // Scale down to the chosen height, never up; encoders want even dimensions.
    let height=sourceHeight
    if (settings.maxHeight&&sourceHeight>settings.maxHeight) height=settings.maxHeight
    height=Math.max(2,Math.round(height/2)*2)
    const width=Math.max(2,Math.round(sourceWidth*height/sourceHeight/2)*2)

    const format=videoMuxer(settings.format)
    const codec=await getFirstEncodableVideoCodec(format.getSupportedVideoCodecs(),{ width, height })
    if (!codec) throw new MediaError("codec")
    const audioCodec=await getFirstEncodableAudioCodec(format.getSupportedAudioCodecs())

    const output=new Output({ format, target:new BufferTarget() })
    const conversion=await Conversion.init({
      input,
      output,
      showWarnings:false,
      video:{ codec, width, height, fit:"contain", forceTranscode:true, quality:new Quality({ quality:settings.quality, preferBitrate:true }) },
      audio:settings.removeAudio||!audioCodec?{ discard:true }:{ codec:audioCodec, quality:new Quality({ quality:"medium" }) },
    })
    await run(conversion,onProgress,signal)

    const buffer=output.target.buffer
    if (!buffer) throw new MediaError("encode")
    const duration=await input.computeDuration().catch(()=>undefined)
    return {
      blob:new Blob([buffer],{ type:format.mimeType }),
      ext:settings.format,
      label:VIDEO_LABELS[settings.format],
      width,
      height,
      sourceWidth,
      sourceHeight,
      duration,
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
        ...(settings.format==="wav"?{}:{ quality:new Quality({ bitrate:settings.bitrate*1000 }) }),
      },
    })
    await run(conversion,onProgress,signal)

    const buffer=output.target.buffer
    if (!buffer) throw new MediaError("encode")
    const duration=await input.computeDuration().catch(()=>undefined)
    return {
      blob:new Blob([buffer],{ type:AUDIO_MIME[settings.format] }),
      ext:settings.format,
      label:AUDIO_LABELS[settings.format],
      duration,
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
