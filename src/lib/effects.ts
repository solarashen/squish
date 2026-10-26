import type { Adjust, Watermark } from "./types"

// Colour changes and the watermark, applied to the drawn canvas before it is encoded. The pixel
// maths is done by hand rather than with ctx.filter, because Safari's OffscreenCanvas ignores filters.

type Ctx=OffscreenCanvasRenderingContext2D|CanvasRenderingContext2D

export function isNeutral(a:Adjust) {
  return !a.brightness&&!a.contrast&&!a.saturation&&!a.grayscale&&!a.sharpen
}

export function hasWatermark(w:Watermark) {
  return !!w.text.trim()||!!w.logo
}

const clamp=(v:number)=>v<0?0:v>255?255:v

export function applyAdjust(ctx:Ctx,width:number,height:number,a:Adjust) {
  if (isNeutral(a)) return
  const image=ctx.getImageData(0,0,width,height)
  const d=image.data
  const bright=a.brightness/100*255*0.5
  // Standard contrast curve: pixels move away from (or towards) the middle grey.
  const c=a.contrast*2.55
  const factor=259*(c+255)/(255*(259-c))
  const sat=1+a.saturation/100
  for (let i=0;i<d.length;i+=4) {
    let r=d[i]+bright
    let g=d[i+1]+bright
    let b=d[i+2]+bright
    r=factor*(r-128)+128
    g=factor*(g-128)+128
    b=factor*(b-128)+128
    // Perceived brightness (Rec. 709 weights) is the pivot for saturation and greyscale.
    const lum=0.2126*r+0.7152*g+0.0722*b
    if (a.grayscale) {
      r=g=b=lum
    } else if (sat!==1) {
      r=lum+(r-lum)*sat
      g=lum+(g-lum)*sat
      b=lum+(b-lum)*sat
    }
    d[i]=clamp(r)
    d[i+1]=clamp(g)
    d[i+2]=clamp(b)
  }
  if (a.sharpen>0) sharpen(image,a.sharpen/100)
  ctx.putImageData(image,0,0)
}

// Unsharp mask with a 3 × 3 kernel: each pixel is pushed away from the average of its four neighbours.
function sharpen(image:ImageData,amount:number) {
  const { data, width, height }=image
  const src=new Uint8ClampedArray(data)
  const k=amount*1.5
  for (let y=1;y<height-1;y++) {
    for (let x=1;x<width-1;x++) {
      const i=(y*width+x)*4
      for (let ch=0;ch<3;ch++) {
        const p=i+ch
        const around=src[p-4]+src[p+4]+src[p-width*4]+src[p+width*4]
        data[p]=clamp(src[p]*(1+4*k)-around*k)
      }
    }
  }
}

export function drawWatermark(ctx:Ctx,width:number,height:number,w:Watermark,logo:ImageBitmap|null) {
  if (!hasWatermark(w)) return
  ctx.save()
  ctx.globalAlpha=w.opacity/100
  const unit=Math.max(8,width*w.size/100)
  const margin=Math.round(Math.min(width,height)*0.03)

  // The mark is a logo (scaled to the size setting) or a line of text with a soft shadow for contrast.
  let markW:number
  let markH:number
  if (logo) {
    markW=unit*2
    markH=markW*logo.height/logo.width
  } else {
    ctx.font="700 "+Math.round(unit*0.6)+"px system-ui, sans-serif"
    markW=ctx.measureText(w.text).width
    markH=unit*0.6
  }
  const paint=(x:number,y:number)=>{
    if (logo) {
      ctx.drawImage(logo,x,y,markW,markH)
      return
    }
    ctx.textBaseline="top"
    ctx.shadowColor="rgba(0,0,0,0.55)"
    ctx.shadowBlur=unit*0.12
    ctx.fillStyle="#ffffff"
    ctx.fillText(w.text,x,y)
  }

  if (w.position==="tile") {
    // Diagonal rows across the whole picture, so cropping cannot remove it.
    ctx.translate(width/2,height/2)
    ctx.rotate(-Math.PI/6)
    const stepX=markW+unit*2
    const stepY=markH+unit*2
    const span=Math.hypot(width,height)
    for (let y=-span/2;y<span/2;y+=stepY) {
      for (let x=-span/2;x<span/2;x+=stepX) paint(x,y)
    }
  } else {
    const left=w.position==="tl"||w.position==="bl"
    const top=w.position==="tl"||w.position==="tr"
    const x=w.position==="center"?(width-markW)/2:left?margin:width-margin-markW
    const y=w.position==="center"?(height-markH)/2:top?margin:height-margin-markH
    paint(x,y)
  }
  ctx.restore()
}
