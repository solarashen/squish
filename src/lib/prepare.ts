import { isHeic, isSvg } from "./files"

// Some images cannot go straight into the worker: SVG must be drawn by an <img> on the page, and
// HEIC (iPhone photos) only decodes natively in Safari. Both are turned into a PNG here first.

// Vector art has no fixed size, so small SVGs are drawn larger; the max-size setting scales them back.
const SVG_MIN_SIDE=1024
const SVG_MAX_SIDE=4096

async function rasterizeSvg(file:Blob) {
  const url=URL.createObjectURL(file)
  try {
    const img=new Image()
    img.src=url
    await img.decode()
    let w=img.naturalWidth||SVG_MIN_SIDE
    let h=img.naturalHeight||SVG_MIN_SIDE
    const longest=Math.max(w,h)
    const scale=Math.min(SVG_MAX_SIDE,Math.max(SVG_MIN_SIDE,longest))/longest
    w=Math.round(w*scale)
    h=Math.round(h*scale)
    const canvas=document.createElement("canvas")
    canvas.width=w
    canvas.height=h
    canvas.getContext("2d")!.drawImage(img,0,0,w,h)
    return await new Promise<Blob>((resolve,reject)=>canvas.toBlob((b)=>b?resolve(b):reject(new Error("svg")),"image/png"))
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function decodeHeic(file:File) {
  // Safari reads HEIC itself, which skips downloading the 3 MB decoder.
  try {
    const bitmap=await createImageBitmap(file)
    bitmap.close()
    return file
  } catch {
    const { heicTo }=await import("heic-to")
    return heicTo({ blob:file, type:"image/png" })
  }
}

// Returns something createImageBitmap can read in a worker.
export async function prepareImage(file:File):Promise<Blob> {
  if (isSvg(file)) return rasterizeSvg(file)
  if (isHeic(file)) return decodeHeic(file)
  return file
}
