import { targetBytes } from "./target"
import type { CanvasFormat, EncodeResult, ErrorCode, OutputFormat, Settings } from "./types"
import { applyAdjust, drawWatermark, hasWatermark } from "./effects"
import { writeBmp, writeGif, writeIco, writePdf } from "./writers"
import type { Adjust, Watermark } from "./types"

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

function canvasToBlob(canvas:AnyCanvas,type:string,quality:number):Promise<Blob> {
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

// What gets painted on top of the plain resize: colour changes and a watermark.
type Effects={ adjust:Adjust; watermark:Watermark; logo:ImageBitmap|null }

function draw(bitmap:ImageBitmap,width:number,height:number,format:OutputFormat,fx?:Effects):AnyCanvas {
  const canvas=makeCanvas(width,height)
  const ctx=canvas.getContext("2d") as OffscreenCanvasRenderingContext2D|CanvasRenderingContext2D|null
  if (!ctx) throw new EncodeError("encode")
  // JPEG, BMP and the JPEG inside a PDF have no alpha channel, so transparent pixels would turn
  // black without a white backdrop.
  if (format==="image/jpeg"||format==="image/bmp"||format==="application/pdf") {
    ctx.fillStyle="#ffffff"
    ctx.fillRect(0,0,width,height)
  }
  ctx.imageSmoothingEnabled=true
  ctx.imageSmoothingQuality="high"
  ctx.drawImage(bitmap,0,0,width,height)
  if (fx) {
    applyAdjust(ctx,width,height,fx.adjust)
    drawWatermark(ctx,width,height,fx.watermark,fx.logo)
  }
  return canvas
}

const CANVAS_FORMATS:OutputFormat[]=["image/jpeg","image/webp","image/png","image/avif"]
// Formats where quality has no effect, so only the pixel count can bring the size down.
const LOSSLESS:OutputFormat[]=["image/png","image/bmp"]

async function toBlob(canvas:AnyCanvas,format:OutputFormat,quality:number) {
  if (format==="image/gif") return writeGif(canvas,quality)
  if (format==="image/bmp") return writeBmp(canvas)
  if (format==="application/pdf") return writePdf(canvas,quality)
  if (!CANVAS_FORMATS.includes(format)) throw new EncodeError("unsupported-output")
  const blob=await canvasToBlob(canvas,format,quality)
  // Browsers silently fall back to PNG when they cannot encode the requested type.
  if (blob.type!==format) throw new EncodeError("unsupported-output")
  return blob
}

// Highest quality whose output still fits the budget, by binary search. Null when even the lowest is too big.
async function fitQuality(canvas:AnyCanvas,format:OutputFormat,budget:number) {
  const top=await toBlob(canvas,format,1)
  if (top.size<=budget) return top
  let low=0.04
  let high=1
  let best:Blob|null=null
  for (let i=0;i<7;i++) {
    const mid=(low+high)/2
    const blob=await toBlob(canvas,format,mid)
    if (blob.size<=budget) {
      best=blob
      low=mid
    } else {
      high=mid
    }
  }
  return best
}

// Aims the image at a byte budget: first lower the quality, then shrink the pixels until it fits.
async function encodeToBudget(bitmap:ImageBitmap,width:number,height:number,format:OutputFormat,budget:number,fx:Effects) {
  const lossless=LOSSLESS.includes(format)
  let w=width
  let h=height
  let smallest:{ blob:Blob; width:number; height:number }|null=null
  const attempt=async (aw:number,ah:number)=>{
    const canvas=draw(bitmap,aw,ah,format,fx)
    return lossless?await toBlob(canvas,format,1):await fitQuality(canvas,format,budget)
  }
  for (let round=0;round<10;round++) {
    const blob=await attempt(w,h)
    if (blob&&blob.size<=budget) {
      if (round===0) return { blob, width:w, height:h, missed:false }
      // The last step shrank too far: search between the size that fits and the one that did not.
      let best={ blob, width:w, height:h }
      let low=w/width
      let high=smallest!.width/width
      for (let i=0;i<7;i++) {
        const mid=(low+high)/2
        const mw=Math.round(width*mid)
        const mh=Math.round(height*mid)
        const tryBlob=await attempt(mw,mh)
        if (tryBlob&&tryBlob.size<=budget) {
          best={ blob:tryBlob, width:mw, height:mh }
          low=mid
        } else {
          high=mid
        }
      }
      return { ...best, missed:false }
    }
    const sized=blob??await toBlob(draw(bitmap,w,h,format,fx),format,0.04)
    if (!smallest||sized.size<smallest.blob.size) smallest={ blob:sized, width:w, height:h }
    // File size grows roughly with the pixel count, so scale both sides by the square root of the overshoot.
    const scale=Math.min(0.9,Math.sqrt(budget/sized.size)*0.95)
    const nw=Math.round(w*scale)
    const nh=Math.round(h*scale)
    if (nw<16||nh<16) break
    w=nw
    h=nh
  }
  return { ...smallest!, missed:true }
}

// The whole pipeline: decode → draw on canvas at the new size → encode to the chosen format.
// sourceSize is the size of the file the person dropped, which differs from the blob when a HEIC or
// SVG was turned into a PNG first; percentage targets are measured against it.
export async function encodeImage(file:Blob,settings:Settings,sourceSize=file.size):Promise<EncodeResult> {
  let bitmap:ImageBitmap
  try {
    bitmap=await createImageBitmap(file,{ imageOrientation:"from-image" })
  } catch {
    throw new EncodeError("decode")
  }

  try {
    const sourceWidth=bitmap.width
    const sourceHeight=bitmap.height
    const { width, height }=targetSize(sourceWidth,sourceHeight,settings.maxWidth,settings.maxHeight)
    if (width*height>MAX_PIXELS) throw new EncodeError("too-large")

    // An icon file holds fixed sizes (16–256 px), so resizing and targets do not apply.
    if (settings.format==="image/x-icon") {
      const blob=await writeIco(bitmap,sourceWidth,sourceHeight)
      const side=Math.min(256,Math.max(sourceWidth,sourceHeight))
      return { blob, width:side, height:side, sourceWidth, sourceHeight }
    }

    const logo=settings.watermark.logo&&hasWatermark(settings.watermark)?await createImageBitmap(settings.watermark.logo).catch(()=>null):null
    const fx:Effects={ adjust:settings.adjust, watermark:settings.watermark, logo }

    const budget=targetBytes(settings.target,sourceSize)
    if (budget!==null) {
      const hit=await encodeToBudget(bitmap,width,height,settings.format,budget,fx)
      return { ...hit, sourceWidth, sourceHeight }
    }

    const blob=await toBlob(draw(bitmap,width,height,settings.format,fx),settings.format,settings.quality/100)
    return { blob, width, height, sourceWidth, sourceHeight }
  } finally {
    bitmap.close()
  }
}

// Encodes a 1 × 1 canvas to find out which output formats this browser can actually write.
export async function detectEncoders():Promise<Record<OutputFormat,boolean>> {
  const formats:CanvasFormat[]=["image/jpeg","image/png","image/webp","image/avif"]
  // GIF, BMP, ICO and PDF are written in JavaScript and always work; animated video needs WebCodecs.
  const video=typeof VideoEncoder!=="undefined"
  const result:Record<OutputFormat,boolean>={
    "image/jpeg":false, "image/png":false, "image/webp":false, "image/avif":false,
    "image/gif":true, "image/bmp":true, "image/x-icon":true, "application/pdf":true,
    "video/mp4":video, "video/webm":video,
  }
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
