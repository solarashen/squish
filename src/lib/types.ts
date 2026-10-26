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

// Colour and sharpness changes applied to every image; all zero means untouched.
export type Adjust={
  // -100 to 100
  brightness:number
  contrast:number
  saturation:number
  grayscale:boolean
  // 0 to 100
  sharpen:number
}

export type WatermarkPosition="tl"|"tr"|"bl"|"br"|"center"|"tile"
export type Watermark={
  text:string
  // a logo image; not kept between visits
  logo:Blob|null
  position:WatermarkPosition
  // 5 to 100, percent
  opacity:number
  // size relative to the image width, 2 to 30 percent
  size:number
}

export type Settings={
  format:OutputFormat
  // 1–100, ignored for PNG
  quality:number
  // null means "keep original"
  maxWidth:number|null
  maxHeight:number|null
  target:Target
  adjust:Adjust
  watermark:Watermark
  // MozJPEG and OxiPNG instead of the canvas encoders: smaller files, slower
  optimized:boolean
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
  // turn the picture, in degrees
  rotate:0|90|180|270
  // mirror left to right
  flip:boolean
  // frames per second, null keeps the original
  fps:number|null
  // playback speed: 0.5 is slow motion, 2 is twice as fast
  speed:number
}

export type AudioSettings={
  format:AudioFormat
  // kbps, ignored for WAV
  bitrate:number
  target:Target
  // seconds of fade at the start and end, 0 for none
  fadeIn:number
  fadeOut:number
  // raise the loudest peak to -1 dBFS
  normalize:boolean
  mono:boolean
  // Hz, null keeps the original
  sampleRate:number|null
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

// Changes made to one image in the editor. The picture is rotated and flipped first, then cropped;
// the crop is a fraction (0–1) of the rotated picture, so it does not depend on its pixel size.
export type ImageEdit={
  rotate:0|90|180|270
  flipH:boolean
  flipV:boolean
  crop:{ x:number; y:number; w:number; h:number }|null
}

// Changes made to one video or audio file in the editor.
export type MediaEdit={
  // seconds from the start of the file
  start:number
  end:number|null
  // crop a video to this shape, centred; null keeps the full frame
  aspect:string|null
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
  // crop, rotation and flip set in the editor for this one file
  edit?:ImageEdit
  // trim (and for video, crop shape) set in the editor for this one file
  mediaEdit?:MediaEdit
}
