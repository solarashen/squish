export type MediaKind="image"|"video"|"audio"

export type OutputFormat="image/jpeg"|"image/webp"|"image/png"|"image/avif"
export type VideoFormat="mp4"|"webm"
export type AudioFormat="mp3"|"m4a"|"ogg"|"wav"
export type VideoQuality="low"|"medium"|"high"

// "Quality" uses the normal controls; "size" aims every file at a fixed size,
// "percent" aims every file at its own size minus the given percentage.
export type TargetMode="quality"|"size"|"percent"
export type Target={
  mode:TargetMode
  // kilobytes, for "size"
  sizeKb:number
  // how much smaller, 1–95, for "percent"
  percent:number
}

export type Settings={
  format:OutputFormat
  // 1–100, ignored for PNG
  quality:number
  // null means "keep original"
  maxWidth:number|null
  maxHeight:number|null
  target:Target
}

export type VideoSettings={
  format:VideoFormat
  quality:VideoQuality
  // output height in px, null keeps the original resolution
  maxHeight:number|null
  removeAudio:boolean
  target:Target
}

export type AudioSettings={
  format:AudioFormat
  // kbps, ignored for WAV
  bitrate:number
  target:Target
}

export type AllSettings={ image:Settings; video:VideoSettings; audio:AudioSettings }

export type ErrorCode="decode"|"encode"|"unsupported-output"|"too-large"|"no-track"|"codec"

export type EncodeResult={
  blob:Blob
  width:number
  height:number
  sourceWidth:number
  sourceHeight:number
  // the file could not get down to the target size; this is the smallest result
  missed?:boolean
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
  missed?:boolean
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
