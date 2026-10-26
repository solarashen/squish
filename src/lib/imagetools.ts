import { zipSync } from "fflate"
import { downloadBlob } from "./files"
import { writeIco } from "./writers"

// Extra things to do with one image, all on the page itself.

async function canvasPng(canvas:HTMLCanvasElement) {
  return new Promise<Blob>((resolve,reject)=>canvas.toBlob((b)=>b?resolve(b):reject(new Error("png")),"image/png"))
}

// The image fitted, centred and transparent-padded into a square of the given size.
function square(bitmap:ImageBitmap,size:number) {
  const canvas=document.createElement("canvas")
  canvas.width=size
  canvas.height=size
  const ctx=canvas.getContext("2d")!
  const scale=Math.min(size/bitmap.width,size/bitmap.height)
  const w=Math.round(bitmap.width*scale)
  const h=Math.round(bitmap.height*scale)
  ctx.imageSmoothingQuality="high"
  ctx.drawImage(bitmap,Math.round((size-w)/2),Math.round((size-h)/2),w,h)
  return canvas
}

export const FAVICON_SNIPPET=`<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">`

// Everything a website needs for its icon: favicon.ico, PNG sizes, the Apple touch icon and a manifest.
export async function faviconPack(source:Blob,name:string) {
  const bitmap=await createImageBitmap(source)
  try {
    const files:Record<string,Uint8Array>={}
    const png=async (size:number,file:string)=>{
      files[file]=new Uint8Array(await (await canvasPng(square(bitmap,size))).arrayBuffer())
    }
    await png(16,"favicon-16.png")
    await png(32,"favicon-32.png")
    await png(180,"apple-touch-icon.png")
    await png(192,"icon-192.png")
    await png(512,"icon-512.png")
    files["favicon.ico"]=new Uint8Array(await (await writeIco(bitmap,bitmap.width,bitmap.height)).arrayBuffer())
    const manifest={
      name, short_name:name,
      icons:[{ src:"/icon-192.png", sizes:"192x192", type:"image/png" },{ src:"/icon-512.png", sizes:"512x512", type:"image/png" }],
      display:"standalone",
    }
    files["site.webmanifest"]=new TextEncoder().encode(JSON.stringify(manifest,null,2))
    files["head.html"]=new TextEncoder().encode(FAVICON_SNIPPET+"\n")
    downloadBlob(new Blob([zipSync(files) as BlobPart],{ type:"application/zip" }),"favicon-pack.zip")
  } finally {
    bitmap.close()
  }
}

export type Swatch={ hex:string; share:number }

const hex=(r:number,g:number,b:number)=>"#"+[r,g,b].map((v)=>Math.round(v).toString(16).padStart(2,"0")).join("")

// The main colours, found with k-means clustering on a 64 × 64 copy of the image. Starting points are
// spread across the brightness range so the result is the same every time.
export async function palette(source:Blob,count=6):Promise<Swatch[]> {
  const bitmap=await createImageBitmap(source,{ resizeWidth:64, resizeHeight:64, resizeQuality:"medium" })
  const canvas=new OffscreenCanvas(64,64)
  const ctx=canvas.getContext("2d")!
  ctx.drawImage(bitmap,0,0)
  bitmap.close()
  const data=ctx.getImageData(0,0,64,64).data
  const px:number[][]=[]
  for (let i=0;i<data.length;i+=4) if (data[i+3]>128) px.push([data[i],data[i+1],data[i+2]])
  if (!px.length) return []
  const sorted=[...px].sort((a,b)=>(a[0]+a[1]+a[2])-(b[0]+b[1]+b[2]))
  let centres=Array.from({ length:count },(_,i)=>[...sorted[Math.floor((i+0.5)*sorted.length/count)]])
  let labels=new Array<number>(px.length).fill(0)
  for (let round=0;round<12;round++) {
    labels=px.map((p)=>{
      let best=0
      let dist=Infinity
      centres.forEach((c,i)=>{
        const d=(p[0]-c[0])**2+(p[1]-c[1])**2+(p[2]-c[2])**2
        if (d<dist) {
          dist=d
          best=i
        }
      })
      return best
    })
    centres=centres.map((c,i)=>{
      const members=px.filter((_,j)=>labels[j]===i)
      if (!members.length) return c
      return [0,1,2].map((ch)=>members.reduce((s,m)=>s+m[ch],0)/members.length)
    })
  }
  const counts=centres.map((_,i)=>labels.filter((l)=>l===i).length)
  return centres
    .map((c,i)=>({ hex:hex(c[0],c[1],c[2]), share:counts[i]/px.length }))
    .filter((s)=>s.share>0)
    .sort((a,b)=>b.share-a.share)
}

export function dataUrl(blob:Blob) {
  return new Promise<string>((resolve,reject)=>{
    const reader=new FileReader()
    reader.onload=()=>resolve(reader.result as string)
    reader.onerror=()=>reject(reader.error)
    reader.readAsDataURL(blob)
  })
}
