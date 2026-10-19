import type { EncodeResult, ErrorCode, OutputFormat, Settings } from "./types"

// Largest canvas area that every current browser can allocate safely (16 384 × 16 384 is the iOS limit).
const MAX_PIXELS=16384*16384

export class EncodeError extends Error {
  code:ErrorCode
  constructor(code:ErrorCode) {
    super(code)
    this.code=code
  }
}

type AnyCanvas=OffscreenCanvas|HTMLCanvasElement

function makeCanvas(width:number,height:number):AnyCanvas {
  if (typeof OffscreenCanvas!=="undefined") return new OffscreenCanvas(width,height)
  const canvas=document.createElement("canvas")
  canvas.width=width
  canvas.height=height
  return canvas
}

function canvasToBlob(canvas:AnyCanvas,type:OutputFormat,quality:number):Promise<Blob> {
  if ("convertToBlob" in canvas) return canvas.convertToBlob({ type, quality })
  return new Promise((resolve,reject)=>{
    canvas.toBlob((blob)=>blob?resolve(blob):reject(new EncodeError("encode")),type,quality)
  })
}

// Fits the source into the max box without ever upscaling.
export function targetSize(width:number,height:number,maxWidth:number|null,maxHeight:number|null) {
  let scale=1
  if (maxWidth&&width>maxWidth) scale=Math.min(scale,maxWidth/width)
  if (maxHeight&&height>maxHeight) scale=Math.min(scale,maxHeight/height)
  return {
    width:Math.max(1,Math.round(width*scale)),
    height:Math.max(1,Math.round(height*scale)),
  }
}

// The whole pipeline: decode → draw on canvas at the new size → encode to the chosen format.
export async function encodeImage(file:Blob,settings:Settings):Promise<EncodeResult> {
  let bitmap:ImageBitmap
  try {
    bitmap=await createImageBitmap(file,{ imageOrientation:"from-image" })
  } catch {
    throw new EncodeError("decode")
  }

  const sourceWidth=bitmap.width
  const sourceHeight=bitmap.height
  const { width, height }=targetSize(sourceWidth,sourceHeight,settings.maxWidth,settings.maxHeight)
  if (width*height>MAX_PIXELS) {
    bitmap.close()
    throw new EncodeError("too-large")
  }

  const canvas=makeCanvas(width,height)
  const ctx=canvas.getContext("2d") as OffscreenCanvasRenderingContext2D|CanvasRenderingContext2D|null
  if (!ctx) {
    bitmap.close()
    throw new EncodeError("encode")
  }

  // JPEG has no alpha channel, so transparent pixels would turn black without a white backdrop.
  if (settings.format==="image/jpeg") {
    ctx.fillStyle="#ffffff"
    ctx.fillRect(0,0,width,height)
  }
  ctx.imageSmoothingEnabled=true
  ctx.imageSmoothingQuality="high"
  ctx.drawImage(bitmap,0,0,width,height)
  bitmap.close()

  const blob=await canvasToBlob(canvas,settings.format,settings.quality/100)
  // Browsers silently fall back to PNG when they cannot encode the requested type.
  if (blob.type!==settings.format) throw new EncodeError("unsupported-output")

  return { blob, width, height, sourceWidth, sourceHeight }
}

// Encodes a 1 × 1 canvas to find out which output formats this browser can actually write.
export async function detectEncoders():Promise<Record<OutputFormat,boolean>> {
  const formats:OutputFormat[]=["image/jpeg","image/png","image/webp","image/avif"]
  const result={} as Record<OutputFormat,boolean>
  await Promise.all(formats.map(async (type)=>{
    try {
      const canvas=makeCanvas(2,2)
      // Some browsers refuse to export a canvas that never had a context.
      const ctx=canvas.getContext("2d") as OffscreenCanvasRenderingContext2D|CanvasRenderingContext2D|null
      ctx?.fillRect(0,0,1,1)
      const blob=await canvasToBlob(canvas,type,0.8)
      result[type]=blob.type===type
    } catch {
      result[type]=false
    }
  }))
  return result
}
