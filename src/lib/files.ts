import { zipSync } from "fflate"
import type { Item, MediaKind, OutputFormat } from "./types"

export const EXTENSIONS:Record<OutputFormat,string>={
  "image/jpeg":"jpg",
  "image/webp":"webp",
  "image/png":"png",
  "image/avif":"avif",
  "image/gif":"gif",
  "image/bmp":"bmp",
  "image/x-icon":"ico",
  "application/pdf":"pdf",
  "video/mp4":"mp4",
  "video/webm":"webm",
}

export const FORMAT_LABELS:Record<OutputFormat,string>={
  "image/jpeg":"JPEG",
  "image/webp":"WebP",
  "image/png":"PNG",
  "image/avif":"AVIF",
  "image/gif":"GIF",
  "image/bmp":"BMP",
  "image/x-icon":"ICO",
  "application/pdf":"PDF",
  "video/mp4":"MP4",
  "video/webm":"WebM",
}

const VIDEO_EXT=/\.(mp4|m4v|mov|webm|mkv|avi|ogv|3gp|ts|mts)$/i
const AUDIO_EXT=/\.(mp3|m4a|aac|wav|ogg|oga|opus|flac|weba|wma|aiff?)$/i
const IMAGE_EXT=/\.(heic|heif|avif|jxl|svg)$/i
const HEIC_EXT=/\.(heic|heif)$/i

// Sorts a dropped file into a tab by MIME type, falling back to the extension.
export function kindOf(file:File):MediaKind|null {
  if (file.type==="application/pdf"||/\.pdf$/i.test(file.name)) return "pdf"
  if (file.type.startsWith("image/")||IMAGE_EXT.test(file.name)) return "image"
  if (file.type.startsWith("video/")||VIDEO_EXT.test(file.name)) return "video"
  if (file.type.startsWith("audio/")||AUDIO_EXT.test(file.name)) return "audio"
  return null
}

export function isHeic(file:File) {
  return file.type==="image/heic"||file.type==="image/heif"||HEIC_EXT.test(file.name)
}

export function isSvg(file:File) {
  return file.type==="image/svg+xml"||/\.svg$/i.test(file.name)
}

// GIF, WebP and PNG (APNG) are the image formats that can hold animation.
export function mayBeAnimated(file:File) {
  return /^image\/(gif|webp|png|apng)$/.test(file.type)||/\.(gif|webp|apng)$/i.test(file.name)
}

export function outputName(name:string,ext:string) {
  const dot=name.lastIndexOf(".")
  const base=dot>0?name.slice(0,dot):name
  return base+"."+ext
}

// Short label for the source format, taken from the extension or the MIME type.
export function sourceLabel(file:File) {
  const fromName=file.name.includes(".")?file.name.split(".").pop():""
  const raw=fromName||file.type.split("/")[1]||""
  return raw.replace("jpeg","jpg").toUpperCase()
}

// Saving shown as "−71%", growth as "+12%", and no sign when nothing changed.
export function formatChange(percent:number) {
  const r=Math.round(percent)
  if (r===0) return "0%"
  return (r>0?"−":"+")+Math.abs(r)+"%"
}

export function formatDuration(seconds:number) {
  const s=Math.round(seconds)
  const m=Math.floor(s/60)
  return m+":"+String(s%60).padStart(2,"0")
}

export function downloadBlob(blob:Blob,name:string) {
  const url=URL.createObjectURL(blob)
  const a=document.createElement("a")
  a.href=url
  a.download=name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(()=>URL.revokeObjectURL(url),1000)
}

// Media is already compressed, so the ZIP only stores files (level 0) and stays fast.
export async function downloadZip(items:Item[],zipName:string) {
  const files:Record<string,[Uint8Array,{ level:0 }]>={}
  const used=new Set<string>()
  for (const item of items) {
    if (!item.result) continue
    const base=outputName(item.file.name,item.result.ext)
    const dot=base.lastIndexOf(".")
    let name=base
    let n=2
    while (used.has(name)) name=base.slice(0,dot)+"-"+(n++)+base.slice(dot)
    used.add(name)
    files[name]=[new Uint8Array(await item.result.blob.arrayBuffer()),{ level:0 }]
  }
  const zipped=zipSync(files)
  downloadBlob(new Blob([zipped as BlobPart],{ type:"application/zip" }),zipName)
}
