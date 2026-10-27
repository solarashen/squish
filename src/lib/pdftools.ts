import { degrees, PDFDocument, StandardFonts, type PDFPage } from "pdf-lib"
import { getDocument } from "pdfjs-dist"
import { zipSync } from "fflate"
import { PdfError } from "./pdf"
import type { MediaResult, PdfEdit, PdfSettings } from "./types"

// Page tools built on pdf-lib, which edits the PDF structure itself: pages are copied, turned and
// numbered without being redrawn, so text stays selectable. Only "compress" redraws pages as images.

const pdfBlob=(bytes:Uint8Array)=>new Blob([bytes as BlobPart],{ type:"application/pdf" })

async function open(file:Blob) {
  try {
    return await PDFDocument.load(await file.arrayBuffer(),{ ignoreEncryption:true })
  } catch {
    throw new PdfError("decode")
  }
}

export async function pageCount(file:Blob) {
  return (await open(file)).getPageCount()
}

// The pages the editor kept, in its order and with its turns.
export async function applyPdfEdit(file:Blob,edit:PdfEdit|undefined):Promise<Blob> {
  if (!edit) return file
  const source=await open(file)
  const doc=await PDFDocument.create()
  const pages=await doc.copyPages(source,edit.pages.map((p)=>p.index))
  pages.forEach((page,i)=>{
    const turn=edit.pages[i].rotate
    if (turn) page.setRotation(degrees((page.getRotation().angle+turn)%360))
    doc.addPage(page)
  })
  return pdfBlob(await doc.save())
}

// "3 / 12" at the bottom centre of each page as it is shown, so turned pages are numbered upright.
async function numberPages(doc:PDFDocument) {
  const font=await doc.embedFont(StandardFonts.Helvetica)
  const pages=doc.getPages()
  pages.forEach((page:PDFPage,i)=>{
    const text=(i+1)+" / "+pages.length
    const size=10
    const half=font.widthOfTextAtSize(text,size)/2
    const { width:w, height:h }=page.getSize()
    const turn=((page.getRotation().angle%360)+360)%360
    const m=22
    // Where the bottom centre of the shown page sits on the unturned page, and which way text runs.
    const spots:Record<number,{ x:number; y:number; dx:number; dy:number }>={
      0:{ x:w/2, y:m, dx:1, dy:0 },
      90:{ x:w-m, y:h/2, dx:0, dy:1 },
      180:{ x:w/2, y:h-m, dx:-1, dy:0 },
      270:{ x:m, y:h/2, dx:0, dy:-1 },
    }
    const s=spots[turn]??spots[0]
    page.drawText(text,{ x:s.x-s.dx*half, y:s.y-s.dy*half, size, font, rotate:degrees(turn) })
  })
}

// Each page drawn by pdf.js and saved as a JPEG. Scanned documents shrink a lot; text stops being
// selectable, so this is offered as a separate choice.
async function rasterise(file:Blob,settings:PdfSettings,onProgress:(p:number)=>void,signal:AbortSignal) {
  const task=getDocument({ data:new Uint8Array(await file.arrayBuffer()) })
  const doc=await task.promise.catch(()=>{
    throw new PdfError("decode")
  })
  try {
    const out=await PDFDocument.create()
    for (let n=1;n<=doc.numPages;n++) {
      if (signal.aborted) throw new DOMException("aborted","AbortError")
      const page=await doc.getPage(n)
      const size=page.getViewport({ scale:1 })
      const viewport=page.getViewport({ scale:settings.scale })
      const canvas=document.createElement("canvas")
      canvas.width=Math.floor(viewport.width)
      canvas.height=Math.floor(viewport.height)
      const ctx=canvas.getContext("2d")!
      ctx.fillStyle="#ffffff"
      ctx.fillRect(0,0,canvas.width,canvas.height)
      await page.render({ canvas, canvasContext:ctx, viewport }).promise
      const jpeg=await new Promise<Blob>((resolve,reject)=>canvas.toBlob((b)=>b?resolve(b):reject(new PdfError("encode")),"image/jpeg",settings.quality/100))
      const image=await out.embedJpg(await jpeg.arrayBuffer())
      const target=out.addPage([size.width,size.height])
      target.drawImage(image,{ x:0, y:0, width:size.width, height:size.height })
      page.cleanup()
      onProgress(n/doc.numPages*0.95)
    }
    return out
  } finally {
    await task.destroy()
  }
}

export async function rebuildPdf(file:Blob,settings:PdfSettings,onProgress:(p:number)=>void,signal:AbortSignal):Promise<MediaResult> {
  const doc=settings.compress?await rasterise(file,settings,onProgress,signal):await open(file)
  if (settings.pageNumbers) await numberPages(doc)
  const pages=doc.getPageCount()
  const blob=pdfBlob(await doc.save({ useObjectStreams:true }))
  onProgress(1)
  return { blob, ext:"pdf", label:"PDF", pages }
}

// One PDF per page, in a ZIP.
export async function splitPdf(file:Blob,onProgress:(p:number)=>void):Promise<MediaResult> {
  const source=await open(file)
  const count=source.getPageCount()
  const digits=String(count).length
  const files:Record<string,Uint8Array>={}
  for (let i=0;i<count;i++) {
    const doc=await PDFDocument.create()
    const [page]=await doc.copyPages(source,[i])
    doc.addPage(page)
    files["page-"+String(i+1).padStart(digits,"0")+".pdf"]=await doc.save()
    onProgress((i+1)/count)
  }
  const blob=new Blob([zipSync(files) as BlobPart],{ type:"application/zip" })
  return { blob, ext:"zip", label:"PDF × "+count, pages:count }
}

// Plain text of every page, pages separated by a form feed line. Scanned pages have no text.
export async function pdfText(file:Blob,onProgress:(p:number)=>void,signal:AbortSignal):Promise<MediaResult> {
  const task=getDocument({ data:new Uint8Array(await file.arrayBuffer()) })
  const doc=await task.promise.catch(()=>{
    throw new PdfError("decode")
  })
  try {
    const parts:string[]=[]
    for (let n=1;n<=doc.numPages;n++) {
      if (signal.aborted) throw new DOMException("aborted","AbortError")
      const page=await doc.getPage(n)
      const content=await page.getTextContent()
      let text=""
      for (const item of content.items) {
        if (!("str" in item)) continue
        text+=item.str+(item.hasEOL?"\n":"")
      }
      parts.push(text.trim())
      page.cleanup()
      onProgress(n/doc.numPages)
    }
    const blob=new Blob([parts.join("\n\n\f\n")],{ type:"text/plain;charset=utf-8" })
    return { blob, ext:"txt", label:"Text", pages:doc.numPages }
  } finally {
    await task.destroy()
  }
}

// Small pictures of each page for the page editor.
export async function thumbnails(file:Blob,width:number,onPage:(index:number,url:string,count:number)=>void,signal:AbortSignal) {
  const task=getDocument({ data:new Uint8Array(await file.arrayBuffer()) })
  const doc=await task.promise
  try {
    for (let n=1;n<=doc.numPages;n++) {
      if (signal.aborted) return
      const page=await doc.getPage(n)
      const base=page.getViewport({ scale:1 })
      const viewport=page.getViewport({ scale:width/base.width })
      const canvas=document.createElement("canvas")
      canvas.width=Math.floor(viewport.width)
      canvas.height=Math.floor(viewport.height)
      const ctx=canvas.getContext("2d")!
      ctx.fillStyle="#ffffff"
      ctx.fillRect(0,0,canvas.width,canvas.height)
      await page.render({ canvas, canvasContext:ctx, viewport }).promise
      onPage(n-1,canvas.toDataURL("image/jpeg",0.7),doc.numPages)
      page.cleanup()
    }
  } finally {
    await task.destroy()
  }
}
