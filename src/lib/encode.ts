import { targetBytes } from "./target"
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

function draw(bitmap:ImageBitmap,width:number,height:number,format:OutputFormat):AnyCanvas {
  const canvas=makeCanvas(width,height)
  const ctx=canvas.getContext("2d") as OffscreenCanvasRenderingContext2D|CanvasRenderingContext2D|null
  if (!ctx) throw new EncodeError("encode")
  // JPEG has no alpha channel, so transparent pixels would turn black without a white backdrop.
  if (format==="image/jpeg") {
    ctx.fillStyle="#ffffff"
    ctx.fillRect(0,0,width,height)
  }
  ctx.imageSmoothingEnabled=true
  ctx.imageSmoothingQuality="high"
  ctx.drawImage(bitmap,0,0,width,height)
  return canvas
}

async function toBlob(canvas:AnyCanvas,format:OutputFormat,quality:number) {
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
async function encodeToBudget(bitmap:ImageBitmap,width:number,height:number,format:OutputFormat,budget:number) {
  const lossless=format==="image/png"
  let w=width
  let h=height
  let smallest:{ blob:Blob; width:number; height:number }|null=null
  const attempt=async (aw:number,ah:number)=>{
    const canvas=draw(bitmap,aw,ah,format)
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
    const sized=blob??await toBlob(draw(bitmap,w,h,format),format,0.04)
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
export async function encodeImage(file:Blob,settings:Settings):Promise<EncodeResult> {
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

    const budget=targetBytes(settings.target,file.size)
    if (budget!==null) {
      const hit=await encodeToBudget(bitmap,width,height,settings.format,budget)
      return { ...hit, sourceWidth, sourceHeight }
    }

    const blob=await toBlob(draw(bitmap,width,height,settings.format),settings.format,settings.quality/100)
    return { blob, width, height, sourceWidth, sourceHeight }
  } finally {
    bitmap.close()
  }
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
