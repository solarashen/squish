// Image formats the canvas cannot write itself. GIF uses the small gifenc library, PDF uses pdf-lib,
// and BMP and ICO are simple enough to assemble byte by byte.

type Ctx=OffscreenCanvasRenderingContext2D|CanvasRenderingContext2D
type AnyCanvas=OffscreenCanvas|HTMLCanvasElement

function pixels(canvas:AnyCanvas) {
  const ctx=canvas.getContext("2d") as Ctx|null
  if (!ctx) throw new Error("no context")
  return ctx.getImageData(0,0,canvas.width,canvas.height)
}

function canvasBlob(canvas:AnyCanvas,type:string,quality?:number):Promise<Blob> {
  if ("convertToBlob" in canvas) return canvas.convertToBlob({ type, quality })
  return new Promise((resolve,reject)=>canvas.toBlob((b)=>b?resolve(b):reject(new Error("encode")),type,quality))
}

function makeCanvas(width:number,height:number):AnyCanvas {
  if (typeof OffscreenCanvas!=="undefined") return new OffscreenCanvas(width,height)
  const canvas=document.createElement("canvas")
  canvas.width=width
  canvas.height=height
  return canvas
}

// GIF holds at most 256 colours. Quality picks how many are used (16–256), which is the lever
// the target-size search turns, since fewer colours compress better.
export async function writeGif(canvas:AnyCanvas,quality:number) {
  const { GIFEncoder, quantize, applyPalette }=await import("gifenc")
  const { data, width, height }=pixels(canvas)
  const colors=Math.max(16,Math.round(16+quality*240))
  const palette=quantize(data,colors,{ format:"rgba4444", oneBitAlpha:true })
  const index=applyPalette(data,palette,"rgba4444")
  const transparent=palette.findIndex((c)=>c[3]===0)
  const gif=GIFEncoder()
  gif.writeFrame(index,width,height,{ palette, transparent:transparent>=0, transparentIndex:Math.max(0,transparent) })
  gif.finish()
  return new Blob([gif.bytes() as BlobPart],{ type:"image/gif" })
}

// 24-bit BMP, bottom-up rows padded to four bytes. The canvas was drawn on white, so no alpha is lost.
export function writeBmp(canvas:AnyCanvas) {
  const { data, width, height }=pixels(canvas)
  const row=Math.ceil(width*3/4)*4
  const size=54+row*height
  const buffer=new ArrayBuffer(size)
  const view=new DataView(buffer)
  view.setUint8(0,0x42)
  view.setUint8(1,0x4d)
  view.setUint32(2,size,true)
  view.setUint32(10,54,true)
  view.setUint32(14,40,true)
  view.setInt32(18,width,true)
  view.setInt32(22,height,true)
  view.setUint16(26,1,true)
  view.setUint16(28,24,true)
  view.setUint32(34,row*height,true)
  // 2835 pixels per metre is 72 dpi.
  view.setInt32(38,2835,true)
  view.setInt32(42,2835,true)
  const bytes=new Uint8Array(buffer)
  for (let y=0;y<height;y++) {
    const out=54+(height-1-y)*row
    for (let x=0;x<width;x++) {
      const i=(y*width+x)*4
      bytes[out+x*3]=data[i+2]
      bytes[out+x*3+1]=data[i+1]
      bytes[out+x*3+2]=data[i]
    }
  }
  return new Blob([buffer],{ type:"image/bmp" })
}

const ICON_SIZES=[16,32,48,64,128,256]

// A favicon file: the image fitted into squares of every common icon size, each stored as a PNG.
export async function writeIco(source:CanvasImageSource,width:number,height:number) {
  const sizes=ICON_SIZES.filter((s)=>s<=Math.max(width,height,16))
  const images:Uint8Array[]=[]
  for (const s of sizes) {
    const canvas=makeCanvas(s,s)
    const ctx=canvas.getContext("2d") as Ctx|null
    if (!ctx) throw new Error("no context")
    const scale=Math.min(s/width,s/height)
    const w=Math.max(1,Math.round(width*scale))
    const h=Math.max(1,Math.round(height*scale))
    ctx.imageSmoothingQuality="high"
    ctx.drawImage(source,Math.round((s-w)/2),Math.round((s-h)/2),w,h)
    images.push(new Uint8Array(await (await canvasBlob(canvas,"image/png")).arrayBuffer()))
  }
  const headerSize=6+16*sizes.length
  const total=headerSize+images.reduce((sum,img)=>sum+img.length,0)
  const out=new Uint8Array(total)
  const view=new DataView(out.buffer)
  view.setUint16(2,1,true)
  view.setUint16(4,sizes.length,true)
  let offset=headerSize
  sizes.forEach((s,i)=>{
    const entry=6+i*16
    // 0 stands for 256 in the one-byte width and height fields.
    out[entry]=s>=256?0:s
    out[entry+1]=s>=256?0:s
    view.setUint16(entry+4,1,true)
    view.setUint16(entry+6,32,true)
    view.setUint32(entry+8,images[i].length,true)
    view.setUint32(entry+12,offset,true)
    out.set(images[i],offset)
    offset+=images[i].length
  })
  return new Blob([out],{ type:"image/x-icon" })
}

// A one-page PDF holding the image as a JPEG, with the page sized to the image at 96 dpi.
export async function writePdf(canvas:AnyCanvas,quality:number) {
  const { PDFDocument }=await import("pdf-lib")
  const jpeg=await canvasBlob(canvas,"image/jpeg",quality)
  const doc=await PDFDocument.create()
  const image=await doc.embedJpg(await jpeg.arrayBuffer())
  const page=doc.addPage([canvas.width*0.75,canvas.height*0.75])
  page.drawImage(image,{ x:0, y:0, width:page.getWidth(), height:page.getHeight() })
  const bytes=await doc.save()
  return new Blob([bytes as BlobPart],{ type:"application/pdf" })
}

// Joins one-page (or longer) PDFs into a single document, in the given order.
export async function mergePdfs(files:Blob[]) {
  const { PDFDocument }=await import("pdf-lib")
  const doc=await PDFDocument.create()
  for (const file of files) {
    const part=await PDFDocument.load(await file.arrayBuffer())
    const pages=await doc.copyPages(part,part.getPageIndices())
    pages.forEach((p)=>doc.addPage(p))
  }
  const bytes=await doc.save()
  return new Blob([bytes as BlobPart],{ type:"application/pdf" })
}
