import { renderEdit } from "./edit"
import type { ImageEdit } from "./types"

// How close a compressed picture is to the original, measured two standard ways:
// PSNR (peak signal-to-noise ratio, in dB) compares pixel values directly; higher is better and
// above about 40 dB the difference is hard to see. SSIM (structural similarity, 0–1) compares
// brightness, contrast and structure in small windows, which follows what people notice more
// closely; 1 means identical. Both are measured on at most METRIC_SIDE pixels on the long side.

const METRIC_SIDE=1024

export type Quality={ psnr:number; ssim:number }

// Pixels of a picture scaled to the given size, on a white background like a JPEG would have.
async function pixels(source:Blob|ImageBitmap,width:number,height:number,edit?:ImageEdit) {
  const bitmap=source instanceof Blob?await createImageBitmap(source,{ imageOrientation:"from-image" }):source
  const picture=edit?renderEdit(bitmap,edit):bitmap
  const canvas=new OffscreenCanvas(width,height)
  const ctx=canvas.getContext("2d",{ willReadFrequently:true })!
  ctx.fillStyle="#ffffff"
  ctx.fillRect(0,0,width,height)
  ctx.imageSmoothingQuality="high"
  ctx.drawImage(picture,0,0,width,height)
  if (source instanceof Blob) bitmap.close()
  return ctx.getImageData(0,0,width,height).data
}

function psnr(a:Uint8ClampedArray,b:Uint8ClampedArray) {
  let sum=0
  let n=0
  for (let i=0;i<a.length;i+=4) {
    for (let c=0;c<3;c++) {
      const d=a[i+c]-b[i+c]
      sum+=d*d
    }
    n+=3
  }
  const mse=sum/n
  return mse===0?Infinity:10*Math.log10(255*255/mse)
}

const luma=(d:Uint8ClampedArray,i:number)=>0.299*d[i]+0.587*d[i+1]+0.114*d[i+2]

// Mean SSIM over 8×8 windows moved 4 pixels at a time, on brightness (luma).
function ssim(a:Uint8ClampedArray,b:Uint8ClampedArray,width:number,height:number) {
  const C1=(0.01*255)**2
  const C2=(0.03*255)**2
  const size=8
  const step=4
  let total=0
  let windows=0
  for (let y=0;y+size<=height;y+=step) {
    for (let x=0;x+size<=width;x+=step) {
      let ma=0
      let mb=0
      let va=0
      let vb=0
      let cov=0
      for (let dy=0;dy<size;dy++) {
        for (let dx=0;dx<size;dx++) {
          const i=((y+dy)*width+x+dx)*4
          const pa=luma(a,i)
          const pb=luma(b,i)
          ma+=pa
          mb+=pb
          va+=pa*pa
          vb+=pb*pb
          cov+=pa*pb
        }
      }
      const n=size*size
      ma/=n
      mb/=n
      va=va/n-ma*ma
      vb=vb/n-mb*mb
      cov=cov/n-ma*mb
      total+=((2*ma*mb+C1)*(2*cov+C2))/((ma*ma+mb*mb+C1)*(va+vb+C2))
      windows++
    }
  }
  return windows?total/windows:1
}

// The original is cropped and turned like the result, then both are scaled to the same size.
export async function measure(original:Blob|ImageBitmap,result:Blob,edit?:ImageEdit):Promise<Quality> {
  const out=await createImageBitmap(result)
  const scale=Math.min(1,METRIC_SIDE/Math.max(out.width,out.height))
  const width=Math.max(8,Math.round(out.width*scale))
  const height=Math.max(8,Math.round(out.height*scale))
  const b=await pixels(out,width,height)
  out.close()
  const a=await pixels(original,width,height,edit)
  return { psnr:psnr(a,b), ssim:ssim(a,b,width,height) }
}
