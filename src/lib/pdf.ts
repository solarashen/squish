import { getDocument, GlobalWorkerOptions } from "pdfjs-dist"
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url"
import { zipSync } from "fflate"
import type { MediaResult, PdfSettings, StillFormat } from "./types"

// PDF pages are drawn by pdf.js (the renderer Firefox uses) onto a canvas, then saved as images.
GlobalWorkerOptions.workerSrc=workerUrl

const EXT:Record<StillFormat,string>={ "image/jpeg":"jpg", "image/png":"png", "image/webp":"webp" }
const LABEL:Record<StillFormat,string>={ "image/jpeg":"JPEG", "image/png":"PNG", "image/webp":"WebP" }

export class PdfError extends Error {}

function pageBlob(canvas:HTMLCanvasElement,type:string,quality:number):Promise<Blob> {
  return new Promise((resolve,reject)=>canvas.toBlob((b)=>b?resolve(b):reject(new PdfError("encode")),type,quality))
}

// One page gives one image; more pages come back as a ZIP of numbered images.
export async function pdfToImages(file:Blob,settings:PdfSettings,onProgress:(p:number)=>void,signal:AbortSignal):Promise<MediaResult> {
  const task=getDocument({ data:new Uint8Array(await file.arrayBuffer()) })
  let doc
  try {
    doc=await task.promise
  } catch {
    throw new PdfError("decode")
  }
  try {
    const pages:Blob[]=[]
    let width=0
    let height=0
    for (let n=1;n<=doc.numPages;n++) {
      if (signal.aborted) throw new DOMException("aborted","AbortError")
      const page=await doc.getPage(n)
      const viewport=page.getViewport({ scale:settings.scale })
      const canvas=document.createElement("canvas")
      canvas.width=Math.floor(viewport.width)
      canvas.height=Math.floor(viewport.height)
      const ctx=canvas.getContext("2d")!
      // Pages without a background would come out transparent, and black in a JPEG.
      ctx.fillStyle="#ffffff"
      ctx.fillRect(0,0,canvas.width,canvas.height)
      await page.render({ canvas, canvasContext:ctx, viewport }).promise
      pages.push(await pageBlob(canvas,settings.format,settings.quality/100))
      if (n===1) {
        width=canvas.width
        height=canvas.height
      }
      page.cleanup()
      onProgress(n/doc.numPages)
    }
    const ext=EXT[settings.format]
    if (pages.length===1) return { blob:pages[0], ext, label:LABEL[settings.format], width, height, pages:1 }
    const digits=String(pages.length).length
    const files:Record<string,[Uint8Array,{ level:0 }]>={}
    for (let i=0;i<pages.length;i++) {
      files["page-"+String(i+1).padStart(digits,"0")+"."+ext]=[new Uint8Array(await pages[i].arrayBuffer()),{ level:0 }]
    }
    const zip=new Blob([zipSync(files) as BlobPart],{ type:"application/zip" })
    return { blob:zip, ext:"zip", label:LABEL[settings.format]+" × "+pages.length, width, height, pages:pages.length }
  } finally {
    await task.destroy()
  }
}
