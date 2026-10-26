import { unzip } from "fflate"

// Turns whatever was dropped into a flat list of files: folders are walked, ZIP archives are
// unpacked, and everything else is passed through as it is.

const MIME:Record<string,string>={
  jpg:"image/jpeg", jpeg:"image/jpeg", png:"image/png", webp:"image/webp", gif:"image/gif", avif:"image/avif",
  bmp:"image/bmp", svg:"image/svg+xml", heic:"image/heic", heif:"image/heif", ico:"image/x-icon", tif:"image/tiff", tiff:"image/tiff",
  mp4:"video/mp4", m4v:"video/mp4", mov:"video/quicktime", webm:"video/webm", mkv:"video/x-matroska", ts:"video/mp2t",
  mp3:"audio/mpeg", m4a:"audio/mp4", aac:"audio/aac", wav:"audio/wav", ogg:"audio/ogg", opus:"audio/ogg", flac:"audio/flac",
  pdf:"application/pdf",
}

function mimeOf(name:string) {
  return MIME[name.split(".").pop()?.toLowerCase()??""]??""
}

function readEntry(entry:FileSystemEntry):Promise<File[]> {
  if (entry.isFile) {
    return new Promise((resolve)=>(entry as FileSystemFileEntry).file((f)=>resolve([f]),()=>resolve([])))
  }
  if (!entry.isDirectory) return Promise.resolve([])
  const reader=(entry as FileSystemDirectoryEntry).createReader()
  // readEntries returns at most 100 entries per call, so keep reading until it comes back empty.
  return new Promise((resolve)=>{
    const all:FileSystemEntry[]=[]
    const next=()=>reader.readEntries(async (batch)=>{
      if (!batch.length) {
        const nested=await Promise.all(all.map(readEntry))
        resolve(nested.flat())
        return
      }
      all.push(...batch)
      next()
    },()=>resolve([]))
    next()
  })
}

export function isZip(file:File) {
  return file.type==="application/zip"||file.type==="application/x-zip-compressed"||/\.zip$/i.test(file.name)
}

async function unzipFile(file:File):Promise<File[]> {
  const data=new Uint8Array(await file.arrayBuffer())
  const entries=await new Promise<Record<string,Uint8Array>>((resolve,reject)=>unzip(data,(err,out)=>err?reject(err):resolve(out)))
  return Object.entries(entries)
    // Skip folders and the hidden files macOS adds to archives.
    .filter(([path,bytes])=>bytes.length&&!path.endsWith("/")&&!path.includes("__MACOSX")&&!path.split("/").pop()!.startsWith("."))
    .map(([path,bytes])=>{
      const name=path.split("/").pop()!
      return new File([bytes as BlobPart],name,{ type:mimeOf(name) })
    })
}

// Unpacks ZIP archives among the given files; nested archives are not opened.
export async function expandZips(files:File[]) {
  const out:File[]=[]
  for (const file of files) {
    if (!isZip(file)) {
      out.push(file)
      continue
    }
    try {
      out.push(...await unzipFile(file))
    } catch {
      out.push(file)
    }
  }
  return out
}

// Reads a drop, including whole folders, then unpacks any ZIP files in it.
export async function collectDrop(transfer:DataTransfer) {
  const entries=Array.from(transfer.items??[])
    .map((item)=>item.kind==="file"?item.webkitGetAsEntry?.():null)
    .filter((e):e is FileSystemEntry=>!!e)
  const files=entries.length&&entries.some((e)=>e.isDirectory)
    ?(await Promise.all(entries.map(readEntry))).flat()
    :Array.from(transfer.files??[])
  return expandZips(files)
}
