export type MediaKind="image"|"video"|"audio"|"pdf"

// Formats the canvas itself can write.
export type CanvasFormat="image/jpeg"|"image/webp"|"image/png"|"image/avif"
// Everything an image can become: canvas formats, formats written by hand or by a small library,
// a one-page PDF, and (for animated GIF, WebP or PNG) a video.
export type OutputFormat=CanvasFormat|"image/gif"|"image/bmp"|"image/x-icon"|"application/pdf"|"video/mp4"|"video/webm"
export type VideoFormat="mp4"|"webm"|"mov"|"mkv"|"ts"
export type VideoCodecChoice="auto"|"avc"|"hevc"|"vp9"|"av1"
// What a video becomes: another video, only its sound, an animated GIF, or one still frame.
export type VideoOutput="video"|"audio"|"gif"|"frame"
export type AudioFormat="mp3"|"m4a"|"aac"|"ogg"|"opus"|"flac"|"wav"
export type StillFormat="image/jpeg"|"image/png"|"image/webp"
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
  output:VideoOutput
  format:VideoFormat
  codec:VideoCodecChoice
  quality:VideoQuality
  // output height in px, null keeps the original resolution
  maxHeight:number|null
  removeAudio:boolean
  target:Target
  // used when output is "audio"
  audioFormat:AudioFormat
  audioBitrate:number
  // used when output is "gif"
  gifFps:number
  gifWidth:number
  // used when output is "frame": where in the clip, 0–1
  framePosition:number
  frameFormat:StillFormat
}

export type AudioSettings={
  format:AudioFormat
  // kbps, ignored for WAV
  bitrate:number
  target:Target
}

export type PdfSettings={
  format:StillFormat
  quality:number
  // render scale: 1 = 72 dpi, 2 = 144 dpi, 3 = 216 dpi
  scale:number
}

export type AllSettings={ image:Settings; video:VideoSettings; audio:AudioSettings; pdf:PdfSettings }

export type ErrorCode="decode"|"encode"|"unsupported-output"|"too-large"|"no-track"|"codec"|"not-animated"

export type EncodeResult={
  blob:Blob
  width:number
  height:number
  sourceWidth:number
  sourceHeight:number
  // the file could not get down to the target size; this is the smallest result
  missed?:boolean
  // set when a WebAssembly encoder was used instead of the canvas
  engine?:string
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
  // PDF input: how many pages were turned into images
  pages?:number
}

export type ItemStatus="queued"|"working"|"done"|"error"

export type Item={
  id:string
  kind:MediaKind
  file:File
  previewUrl:string
  // true once a HEIC or SVG preview was swapped for its decoded PNG
  converted?:boolean
  // when the current conversion started and how long it took, in milliseconds
  startedAt?:number
  ms?:number
  // which part of the browser did the work, e.g. "Canvas" or "WebCodecs"
  engine?:string
  status:ItemStatus
  // 0–1 while a video or audio file is converting
  progress?:number
  result?:MediaResult
  error?:ErrorCode
  // bumps every time settings change, so stale results can be dropped
  version:number
}
