import {
  AdtsOutputFormat,
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  canEncodeAudio,
  canEncodeVideo,
  CanvasSink,
  CanvasSource,
  Conversion,
  FlacOutputFormat,
  getFirstEncodableAudioCodec,
  getFirstEncodableVideoCodec,
  Input,
  MkvOutputFormat,
  MovOutputFormat,
  Mp3OutputFormat,
  Mp4OutputFormat,
  MpegTsOutputFormat,
  OggOutputFormat,
  Output,
  Quality,
  QUALITY_MEDIUM,
  WavOutputFormat,
  WebMOutputFormat,
  type AudioCodec,
  type OutputFormat as MuxFormat,
  type VideoCodec,
} from "mediabunny"
import { registerFlacEncoder } from "@mediabunny/flac-encoder"
import { registerMp3Encoder } from "@mediabunny/mp3-encoder"
import { envelopeProcessor, isFlat, normalizeGain, speedProcessor, type Envelope } from "./audiofx"
import { TARGET_SLACK, targetBytes } from "./target"
import type { AudioFormat, AudioSettings, ErrorCode, MediaEdit, MediaResult, StillFormat, VideoCodecChoice, VideoFormat, VideoSettings } from "./types"

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

export const VIDEO_LABELS:Record<VideoFormat,string>={ mp4:"MP4", webm:"WebM", mov:"MOV", mkv:"MKV", ts:"TS" }
export const AUDIO_LABELS:Record<AudioFormat,string>={ mp3:"MP3", m4a:"M4A", aac:"AAC", ogg:"OGG", opus:"Opus", flac:"FLAC", wav:"WAV" }
const STILL_EXT:Record<StillFormat,string>={ "image/jpeg":"jpg", "image/png":"png", "image/webp":"webp" }
const STILL_LABELS:Record<StillFormat,string>={ "image/jpeg":"JPEG", "image/png":"PNG", "image/webp":"WebP" }

// Browsers without a native MP3 or FLAC encoder get a WebAssembly one.
let mp3Registered=false
async function ensureMp3() {
  if (mp3Registered) return
  if (!(await canEncodeAudio("mp3"))) registerMp3Encoder()
  mp3Registered=true
}

let flacRegistered=false
async function ensureFlac() {
  if (flacRegistered) return
  if (!(await canEncodeAudio("flac"))) registerFlacEncoder()
  flacRegistered=true
}

function videoMuxer(format:VideoFormat):MuxFormat {
  if (format==="mp4") return new Mp4OutputFormat({ fastStart:"in-memory" })
  if (format==="mov") return new MovOutputFormat({ fastStart:"in-memory" })
  if (format==="mkv") return new MkvOutputFormat()
  if (format==="ts") return new MpegTsOutputFormat()
  return new WebMOutputFormat()
}

// "Auto" takes the first codec the container allows and this device can encode; a named codec is
// used only when both are true.
async function pickVideoCodec(format:MuxFormat,choice:VideoCodecChoice,width:number,height:number):Promise<VideoCodec|null> {
  const allowed=format.getSupportedVideoCodecs()
  if (choice==="auto") return getFirstEncodableVideoCodec(allowed,{ width, height })
  if (!allowed.includes(choice)) return null
  return (await canEncodeVideo(choice,{ width, height }))?choice:null
}

async function audioMuxer(format:AudioFormat):Promise<MuxFormat> {
  if (format==="mp3") {
    await ensureMp3()
    return new Mp3OutputFormat()
  }
  if (format==="m4a") return new Mp4OutputFormat({ fastStart:"in-memory" })
  if (format==="aac") return new AdtsOutputFormat()
  if (format==="ogg"||format==="opus") return new OggOutputFormat()
  if (format==="flac") {
    await ensureFlac()
    return new FlacOutputFormat()
  }
  return new WavOutputFormat()
}

// .opus is an Ogg file that must hold Opus; the other containers take what the device can encode.
async function pickAudioCodec(format:AudioFormat,mux:MuxFormat):Promise<AudioCodec|null> {
  if (format==="opus") return (await canEncodeAudio("opus"))?"opus":null
  return getFirstEncodableAudioCodec(mux.getSupportedAudioCodecs())
}

// Formats without lossy compression: a bitrate means nothing to them.
const LOSSLESS_AUDIO:AudioFormat[]=["wav","flac"]

const AUDIO_MIME:Record<AudioFormat,string>={ mp3:"audio/mpeg", m4a:"audio/mp4", aac:"audio/aac", ogg:"audio/ogg", opus:"audio/ogg", flac:"audio/flac", wav:"audio/wav" }

// MP3 only allows fixed bitrate steps; the other codecs take any value within their range.
const MP3_STEPS=[8,16,24,32,40,48,56,64,80,96,112,128,160,192,224,256,320]

function fitBitrate(format:AudioFormat,kbps:number) {
  if (format==="mp3") return [...MP3_STEPS].reverse().find((s)=>s<=kbps)??8
  return Math.round(Math.min(320,Math.max(format==="m4a"||format==="aac"?16:8,kbps)))
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

// Width ÷ height of the crop shapes offered for video.
export const ASPECTS:Record<string,number>={ "1:1":1, "4:3":4/3, "16:9":16/9, "9:16":9/16, "4:5":4/5 }

// The trim range in seconds, clamped to the file; end is undefined when the file plays to the end.
function trimRange(edit:MediaEdit|undefined,length:number) {
  const start=Math.max(0,Math.min(edit?.start??0,length))
  const end=edit?.end!=null&&edit.end<length?Math.max(start+0.1,edit.end):undefined
  return { start, end, span:(end??length)-start }
}

export async function convertVideo(file:Blob,settings:VideoSettings,onProgress:(p:number)=>void,signal:AbortSignal,edit?:MediaEdit):Promise<MediaResult> {
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
    const audioTrack=await input.getPrimaryAudioTrack().catch(()=>null)
    const keepAudio=!settings.removeAudio&&!!audioCodec&&!!audioTrack

    const length=await input.computeDuration().catch(()=>0)
    const { start, end, span }=trimRange(edit,length)
    const speed=settings.speed||1

    // Rotation happens first, so a quarter turn swaps width and height before the crop.
    const quarter=settings.rotate===90||settings.rotate===270
    const turnedW=quarter?sourceHeight:sourceWidth
    const turnedH=quarter?sourceWidth:sourceHeight
    let crop:{ left:number; top:number; width:number; height:number }|undefined
    const ratio=edit?.aspect?ASPECTS[edit.aspect]:undefined
    if (ratio) {
      let w=turnedW
      let h=Math.round(w/ratio)
      if (h>turnedH) {
        h=turnedH
        w=Math.round(h*ratio)
      }
      w-=w%2
      h-=h%2
      crop={ left:Math.round((turnedW-w)/2), top:Math.round((turnedH-h)/2), width:w, height:h }
    }
    const frameW=crop?.width??turnedW
    const frameH=crop?.height??turnedH

    // Scale down to the chosen height, never up.
    let height=frameH
    if (settings.maxHeight&&frameH>settings.maxHeight) height=settings.maxHeight

    // With a target size, the budget sets the bitrate: bits available ÷ seconds of footage.
    const budget=targetBytes(settings.target,file.size)
    const seconds=span/speed
    let videoBitrate:number|null=null
    let audioBitrate=128000
    if (budget!==null&&seconds>0) {
      // 5% is left for the container (headers, index, timestamps).
      const total=budget*8/seconds*0.95
      audioBitrate=keepAudio?Math.min(128000,Math.max(32000,total*0.12)):0
      videoBitrate=Math.max(40000,total-audioBitrate)
      // Too few bits for many pixels looks worse than fewer, sharper pixels, so lower the resolution
      // until each pixel gets about 0.08 bits per frame at 30 fps.
      const fitHeight=Math.sqrt(videoBitrate/(0.08*30)*frameH/frameW)
      height=Math.min(height,Math.max(144,fitHeight))
    }

    // Encoders want even dimensions.
    height=Math.max(2,Math.round(height/2)*2)
    const width=Math.max(2,Math.round(frameW*height/frameH/2)*2)

    const codec=await pickVideoCodec(format,settings.codec,width,height)
    if (!codec) throw new MediaError("codec")

    const output=new Output({ format, target:new BufferTarget() })
    const conversion=await Conversion.init({
      input,
      output,
      showWarnings:false,
      trim:{ start, end },
      video:{
        codec,
        width,
        height,
        fit:"contain",
        forceTranscode:true,
        rotate:settings.rotate,
        flip:settings.flip||undefined,
        crop,
        // Frames are dropped before the speed change, so the rate is picked on the original timeline.
        frameRate:settings.fps?settings.fps*speed:undefined,
        allowTransformationMetadata:false,
        quality:videoBitrate?new Quality({ bitrate:Math.round(videoBitrate) }):new Quality({ quality:settings.quality, preferBitrate:true }),
        // A different speed only changes when each frame is shown.
        process:speed===1?undefined:(sample)=>{
          sample.setTimestamp(sample.timestamp/speed)
          sample.setDuration(sample.duration/speed)
          return sample
        },
      },
      audio:!keepAudio||!audioCodec
        ?{ discard:true }
        :{
          codec:audioCodec,
          quality:budget===null?new Quality({ quality:"medium" }):new Quality({ bitrate:Math.round(audioBitrate) }),
          ...(speed===1?{}:{ process:speedProcessor(speed), forceTranscode:true }),
        },
    })
    await run(conversion,onProgress,signal)

    const buffer=output.target.buffer
    if (!buffer) throw new MediaError("encode")
    const blob=new Blob([buffer],{ type:format.mimeType })
    return {
      blob,
      ext:settings.format,
      label:VIDEO_LABELS[settings.format],
      width,
      height,
      sourceWidth,
      sourceHeight,
      duration:seconds,
      missed:budget!==null&&blob.size>budget*TARGET_SLACK,
    }
  } finally {
    input.dispose()
  }
}

export async function convertAudio(file:Blob,settings:AudioSettings,onProgress:(p:number)=>void,signal:AbortSignal,edit?:MediaEdit):Promise<MediaResult> {
  const input=openInput(file)
  try {
    const track=await input.getPrimaryAudioTrack().catch(()=>{
      throw new MediaError("decode")
    })
    if (!track) throw new MediaError("no-track")

    const format=await audioMuxer(settings.format)
    const codec=await pickAudioCodec(settings.format,format)
    if (!codec) throw new MediaError("codec")

    const length=await input.computeDuration().catch(()=>0)
    const { start, end, span }=trimRange(edit,length)

    // With a target size, the bitrate is the budget spread over the length of the track.
    const budget=targetBytes(settings.target,file.size)
    let kbps=settings.bitrate
    if (budget!==null&&span>0) kbps=fitBitrate(settings.format,budget*8/span*0.97/1000)

    const envelope:Envelope={
      fadeIn:settings.fadeIn??0,
      fadeOut:settings.fadeOut??0,
      length:span,
      gain:settings.normalize?await normalizeGain(track,start,end):1,
    }

    const output=new Output({ format, target:new BufferTarget() })
    const conversion=await Conversion.init({
      input,
      output,
      showWarnings:false,
      trim:{ start, end },
      video:{ discard:true },
      audio:{
        codec,
        forceTranscode:true,
        numberOfChannels:settings.mono?1:undefined,
        sampleRate:settings.sampleRate??undefined,
        process:isFlat(envelope)?undefined:envelopeProcessor(envelope),
        // WAV and FLAC are lossless, so a bitrate makes no sense there.
        ...(LOSSLESS_AUDIO.includes(settings.format)?{}:{ quality:new Quality({ bitrate:kbps*1000 }) }),
      },
    })
    await run(conversion,onProgress,signal)

    const buffer=output.target.buffer
    if (!buffer) throw new MediaError("encode")
    const blob=new Blob([buffer],{ type:AUDIO_MIME[settings.format] })
    return {
      blob,
      ext:settings.format,
      label:AUDIO_LABELS[settings.format],
      duration:span,
      missed:budget!==null&&blob.size>budget*TARGET_SLACK,
    }
  } finally {
    input.dispose()
  }
}

// The sound of a video, saved as an audio file. convertAudio already ignores the picture.
export function extractAudio(file:Blob,settings:VideoSettings,onProgress:(p:number)=>void,signal:AbortSignal,edit?:MediaEdit) {
  const audio:AudioSettings={ format:settings.audioFormat, bitrate:settings.audioBitrate, target:settings.target, fadeIn:0, fadeOut:0, normalize:false, mono:false, sampleRate:null }
  return convertAudio(file,audio,onProgress,signal,edit)
}

async function openVideo(file:Blob) {
  const input=openInput(file)
  const track=await input.getPrimaryVideoTrack().catch(()=>null)
  if (!track) {
    input.dispose()
    throw new MediaError("no-track")
  }
  return { input, track }
}

function stillBlob(canvas:HTMLCanvasElement|OffscreenCanvas,type:string,quality=0.9):Promise<Blob> {
  if ("convertToBlob" in canvas) return canvas.convertToBlob({ type, quality })
  return new Promise((resolve,reject)=>canvas.toBlob((b)=>b?resolve(b):reject(new MediaError("encode")),type,quality))
}

// One still picture from the clip, at a position between its start (0) and end (1).
export async function videoFrame(file:Blob,settings:VideoSettings,edit?:MediaEdit):Promise<MediaResult> {
  const { input, track }=await openVideo(file)
  try {
    const length=await input.computeDuration()
    const range=trimRange(edit,length)
    const first=Math.max(await track.getFirstTimestamp(),range.start)
    const span=Math.max(0,(range.end??length)-first)
    const at=first+Math.min(Math.max(0,span-0.05),span*settings.framePosition)
    const sink=new CanvasSink(track)
    const frame=await sink.getCanvas(at)??await sink.getCanvas(first)
    if (!frame) throw new MediaError("decode")
    const blob=await stillBlob(frame.canvas,settings.frameFormat)
    return {
      blob,
      ext:STILL_EXT[settings.frameFormat],
      label:STILL_LABELS[settings.frameFormat],
      width:frame.canvas.width,
      height:frame.canvas.height,
      sourceWidth:track.displayWidth,
      sourceHeight:track.displayHeight,
    }
  } finally {
    input.dispose()
  }
}

// A GIF caps at 256 colours per frame and has no inter-frame compression, so long clips grow fast.
// Frames past this limit are dropped and the GIF simply ends there.
const MAX_GIF_FRAMES=600

export async function videoToGif(file:Blob,settings:VideoSettings,onProgress:(p:number)=>void,signal:AbortSignal,edit?:MediaEdit):Promise<MediaResult> {
  const { GIFEncoder, quantize, applyPalette }=await import("gifenc")
  const { input, track }=await openVideo(file)
  try {
    const length=await input.computeDuration()
    const range=trimRange(edit,length)
    const first=Math.max(await track.getFirstTimestamp(),range.start)
    const last=range.end??length
    const width=Math.min(settings.gifWidth,track.displayWidth)
    const height=Math.max(1,Math.round(track.displayHeight*width/track.displayWidth))
    const step=1/settings.gifFps
    const count=Math.min(MAX_GIF_FRAMES,Math.max(1,Math.floor((last-first)/step)))
    const times=Array.from({ length:count },(_,i)=>first+i*step)
    const sink=new CanvasSink(track,{ width, height, fit:"fill" })
    const gif=GIFEncoder()
    let done=0
    for await (const frame of sink.canvasesAtTimestamps(times)) {
      if (signal.aborted) throw new Canceled()
      if (!frame) continue
      const ctx=frame.canvas.getContext("2d") as CanvasRenderingContext2D|OffscreenCanvasRenderingContext2D
      const { data }=ctx.getImageData(0,0,width,height)
      const palette=quantize(data,256)
      gif.writeFrame(applyPalette(data,palette),width,height,{ palette, delay:Math.round(step*1000), repeat:0 })
      onProgress(++done/count)
    }
    gif.finish()
    return {
      blob:new Blob([gif.bytes() as BlobPart],{ type:"image/gif" }),
      ext:"gif",
      label:"GIF",
      width,
      height,
      sourceWidth:track.displayWidth,
      sourceHeight:track.displayHeight,
      duration:count*step,
    }
  } finally {
    input.dispose()
  }
}

function animatedType(file:File) {
  if (file.type) return file.type
  if (/\.webp$/i.test(file.name)) return "image/webp"
  if (/\.a?png$/i.test(file.name)) return "image/png"
  return "image/gif"
}

// Animated GIF, WebP or PNG to MP4 or WebM. The browser's ImageDecoder reads the frames with
// their own durations, and each one is painted on a canvas that feeds the video encoder.
export async function animatedToVideo(file:File,target:"mp4"|"webm",onProgress:(p:number)=>void,signal:AbortSignal):Promise<MediaResult> {
  if (typeof ImageDecoder==="undefined") throw new MediaError("codec")
  const decoder=new ImageDecoder({ data:file.stream(), type:animatedType(file) })
  try {
    await decoder.tracks.ready
    const count=decoder.tracks.selectedTrack?.frameCount??0
    if (count<2) throw new MediaError("not-animated")
    const { image:firstImage }=await decoder.decode({ frameIndex:0 })
    const sourceWidth=firstImage.displayWidth
    const sourceHeight=firstImage.displayHeight
    firstImage.close()
    const width=Math.max(2,Math.round(sourceWidth/2)*2)
    const height=Math.max(2,Math.round(sourceHeight/2)*2)

    const format=videoMuxer(target)
    const codec=await getFirstEncodableVideoCodec(format.getSupportedVideoCodecs(),{ width, height })
    if (!codec) throw new MediaError("codec")
    const canvas=new OffscreenCanvas(width,height)
    const ctx=canvas.getContext("2d")
    if (!ctx) throw new MediaError("encode")
    const output=new Output({ format, target:new BufferTarget() })
    const source=new CanvasSource(canvas,{ codec, bitrate:QUALITY_MEDIUM })
    output.addVideoTrack(source)
    await output.start()

    let time=0
    for (let i=0;i<count;i++) {
      if (signal.aborted) {
        await output.cancel()
        throw new Canceled()
      }
      const { image }=await decoder.decode({ frameIndex:i })
      // Browsers play frames shorter than 20 ms at 100 ms, so the video does the same.
      const seconds=(image.duration??0)/1e6
      const duration=seconds<0.02?0.1:seconds
      // Video has no transparency; transparent pixels sit on white.
      ctx.fillStyle="#ffffff"
      ctx.fillRect(0,0,width,height)
      ctx.drawImage(image,0,0,width,height)
      image.close()
      await source.add(time,duration)
      time+=duration
      onProgress((i+1)/count)
    }
    await output.finalize()
    const buffer=output.target.buffer
    if (!buffer) throw new MediaError("encode")
    return {
      blob:new Blob([buffer],{ type:format.mimeType }),
      ext:target,
      label:VIDEO_LABELS[target],
      width,
      height,
      sourceWidth,
      sourceHeight,
      duration:time,
    }
  } catch (error) {
    if (error instanceof MediaError||error instanceof Canceled) throw error
    throw new MediaError("decode")
  } finally {
    decoder.close()
  }
}

// Which output formats and codecs this browser can actually produce.
export async function detectMediaEncoders() {
  const video={} as Record<VideoFormat,boolean>
  for (const f of ["mp4","webm","mov","mkv","ts"] as VideoFormat[]) {
    const fmt=videoMuxer(f)
    video[f]=!!(await getFirstEncodableVideoCodec(fmt.getSupportedVideoCodecs(),{ width:1280, height:720 }).catch(()=>null))
  }
  const codecs={ auto:true } as Record<VideoCodecChoice,boolean>
  for (const c of ["avc","hevc","vp9","av1"] as const) {
    codecs[c]=await canEncodeVideo(c,{ width:1280, height:720 }).catch(()=>false)
  }
  const audio={} as Record<AudioFormat,boolean>
  for (const f of ["mp3","m4a","aac","ogg","opus","flac","wav"] as AudioFormat[]) {
    const fmt=await audioMuxer(f)
    audio[f]=!!(await pickAudioCodec(f,fmt).catch(()=>null))
  }
  return { video, codecs, audio }
}
