export type MediaKind="image"|"video"|"audio"

export type OutputFormat="image/jpeg"|"image/webp"|"image/png"|"image/avif"
export type VideoFormat="mp4"|"webm"
export type AudioFormat="mp3"|"m4a"|"ogg"|"wav"
export type VideoQuality="low"|"medium"|"high"

export type Settings={
  format:OutputFormat
  // 1–100, ignored for PNG
  quality:number
  // null means "keep original"
  maxWidth:number|null
  maxHeight:number|null
}

export type VideoSettings={
  format:VideoFormat
  quality:VideoQuality
  // output height in px, null keeps the original resolution
  maxHeight:number|null
  removeAudio:boolean
}

export type AudioSettings={
  format:AudioFormat
  // kbps, ignored for WAV
  bitrate:number
}

export type AllSettings={ image:Settings; video:VideoSettings; audio:AudioSettings }

export type ErrorCode="decode"|"encode"|"unsupported-output"|"too-large"|"no-track"|"codec"

export type EncodeResult={
  blob:Blob
  width:number
  height:number
  sourceWidth:number
  sourceHeight:number
}

export type MediaResult={
  blob:Blob
  // file extension and display label of the output format
  ext:string
  label:string
  width?:number
  height?:number
  sourceWidth?:number
  sourceHeight?:number
  // seconds, audio and video only
  duration?:number
}

export type ItemStatus="queued"|"working"|"done"|"error"

export type Item={
  id:string
  kind:MediaKind
  file:File
  previewUrl:string
  status:ItemStatus
  // 0–1 while a video or audio file is converting
  progress?:number
  result?:MediaResult
  error?:ErrorCode
  // bumps every time settings change, so stale results can be dropped
  version:number
}
