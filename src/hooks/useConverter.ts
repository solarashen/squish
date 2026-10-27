import { useCallback, useEffect, useRef, useState } from "react"
import { avifNative, detectEncoders, EncodeError } from "@/lib/encode"
import { EXTENSIONS, FORMAT_LABELS, kindOf } from "@/lib/files"
import { encode } from "@/lib/pool"
import { prepareImage } from "@/lib/prepare"
import { forget, load, mergeDefaults, save } from "@/lib/storage"
import type { AllSettings, AudioFormat, ImageEdit, Item, MediaEdit, PdfEdit, MediaKind, MediaResult, OutputFormat, VideoCodecChoice, VideoFormat } from "@/lib/types"

export const MAX_FILES=50

const DEFAULT_TARGET={ mode:"quality" as const, sizeKb:500, percent:50 }

const DEFAULT_SETTINGS:AllSettings={
  image:{
    format:"image/webp", quality:78, maxWidth:1920, maxHeight:null, target:DEFAULT_TARGET,
    adjust:{ brightness:0, contrast:0, saturation:0, grayscale:false, sharpen:0 },
    watermark:{ text:"", logo:null, position:"br", opacity:60, size:6 },
    optimized:false,
  },
  video:{
    output:"video", format:"mp4", codec:"auto", quality:"medium", maxHeight:720, removeAudio:false, target:{ ...DEFAULT_TARGET, sizeKb:10240 },
    audioFormat:"mp3", audioBitrate:192, gifFps:12, gifWidth:480, framePosition:0.5, frameFormat:"image/jpeg",
    rotate:0, flip:false, fps:null, speed:1,
  },
  audio:{ format:"mp3", bitrate:128, target:{ ...DEFAULT_TARGET, sizeKb:2048 }, fadeIn:0, fadeOut:0, normalize:false, mono:false, sampleRate:null },
  pdf:{ output:"images", compress:false, pageNumbers:false, format:"image/jpeg", quality:85, scale:2 },
}

export type Encoders={
  image:Record<OutputFormat,boolean>
  video:Record<VideoFormat,boolean>
  codecs:Record<VideoCodecChoice,boolean>
  audio:Record<AudioFormat,boolean>
  // false when AVIF is written by the slower WebAssembly encoder
  avifNative:boolean
}

// Image outputs that are videos (from animated GIF, WebP or APNG) go through WebCodecs, not the canvas.
const isVideoOutput=(format:OutputFormat)=>format==="video/mp4"||format==="video/webm"

export type AddReport={ skipped:number; skippedOverLimit:number; firstKind:MediaKind|null }

// The media module (WebCodecs + muxers) is only downloaded once someone adds audio or video.
const loadMedia=()=>import("@/lib/media")

let idCounter=0

const SETTINGS_KEY="squish-settings"

// Totals for everything converted since the page opened, kept even after files are removed.
export type SessionStats={ files:number; bytesIn:number; bytesOut:number; ms:number; engines:Record<string,number> }

export function useConverter(remember:boolean) {
  const [items,setItemsState]=useState<Item[]>([])
  const [settings,setAllSettings]=useState<AllSettings>(()=>{
    if (!remember) return DEFAULT_SETTINGS
    const merged=mergeDefaults(DEFAULT_SETTINGS,load<AllSettings>(SETTINGS_KEY))
    // Nested groups saved by an older version may miss fields, so fill those in too.
    merged.image={ ...merged.image, adjust:{ ...DEFAULT_SETTINGS.image.adjust, ...merged.image.adjust }, watermark:{ ...DEFAULT_SETTINGS.image.watermark, ...merged.image.watermark, logo:null } }
    return merged
  })
  const [encoders,setEncoders]=useState<Partial<Encoders>>({})
  const [stats,setStats]=useState<SessionStats>({ files:0, bytesIn:0, bytesOut:0, ms:0, engines:{} })

  useEffect(()=>{
    // A logo is a file and cannot be stored as JSON, so it is left out.
    if (remember) save(SETTINGS_KEY,{ ...settings, image:{ ...settings.image, watermark:{ ...settings.image.watermark, logo:null } } })
    else forget(SETTINGS_KEY)
  },[settings,remember])

  // Mirrors of the latest state, so callbacks never read a stale list or stale settings.
  const itemsRef=useRef<Item[]>([])
  const settingsRef=useRef(settings)
  settingsRef.current=settings
  const aborts=useRef(new Map<string,AbortController>())
  // Video and audio run one at a time: each conversion already uses the hardware encoder fully.
  const mediaQueue=useRef<Promise<unknown>>(Promise.resolve())

  const setItems=useCallback((next:Item[])=>{
    itemsRef.current=next
    setItemsState(next)
  },[])

  const patch=useCallback((id:string,version:number,change:Partial<Item>)=>{
    const list=itemsRef.current
    const current=list.find((it)=>it.id===id&&it.version===version)
    if (!current) return
    let next={ ...current, ...change }
    if (change.status==="working"&&current.status!=="working") next.startedAt=performance.now()
    if (change.status==="done"&&next.result) {
      const ms=Math.round(performance.now()-(next.startedAt??performance.now()))
      next={ ...next, ms }
      const engine=next.engine??"?"
      const bytesOut=change.result?.blob.size??0
      setStats((s)=>({ files:s.files+1, bytesIn:s.bytesIn+next.file.size, bytesOut:s.bytesOut+bytesOut, ms:s.ms+ms, engines:{ ...s.engines, [engine]:(s.engines[engine]??0)+1 } }))
    }
    setItems(list.map((it)=>it.id===id?next:it))
  },[setItems])

  useEffect(()=>{
    detectEncoders().then((image)=>setEncoders((e)=>({ ...e, image, avifNative })))
  },[])

  const ensureMediaEncoders=useCallback(()=>{
    if (encoders.video) return
    loadMedia()
      .then((m)=>m.detectMediaEncoders())
      .then(({ video, codecs, audio })=>setEncoders((e)=>({ ...e, video, codecs, audio })))
  },[encoders.video])

  const process=useCallback((item:Item)=>{
    const { id, version, kind }=item
    aborts.current.get(id)?.abort()

    if (kind==="image"&&!isVideoOutput(settingsRef.current.image.format)) {
      const s=settingsRef.current.image
      patch(id,version,{ status:"working" })
      prepareImage(item.file)
        .then((blob)=>{
          // HEIC and SVG previews cannot show in an <img> everywhere, so the decoded PNG becomes the thumbnail.
          if (blob!==item.file) {
            const current=itemsRef.current.find((it)=>it.id===id)
            if (current&&current.previewUrl.startsWith("blob:")&&!current.converted) {
              URL.revokeObjectURL(current.previewUrl)
              patch(id,version,{ previewUrl:URL.createObjectURL(blob), converted:true })
            }
          }
          return encode(blob,s,item.file.size,item.edit)
        })
        .then((r)=>patch(id,version,{ status:"done", error:undefined, result:{ ...r, ext:EXTENSIONS[s.format], label:FORMAT_LABELS[s.format] }, engine:r.engine??"Canvas" }))
        .catch((error)=>{
          const code=error instanceof EncodeError?error.code:"decode"
          patch(id,version,{ status:"error", error:code, result:undefined })
        })
      return
    }

    const controller=new AbortController()
    aborts.current.set(id,controller)
    const job=async ()=>{
      if (controller.signal.aborted) return
      patch(id,version,{ status:"working", progress:0 })
      const media=await loadMedia()
      try {
        const onProgress=(p:number)=>patch(id,version,{ progress:p })
        const all=settingsRef.current
        let result:MediaResult
        let engine="WebCodecs"
        if (kind==="image") {
          result=await media.animatedToVideo(item.file,all.image.format==="video/webm"?"webm":"mp4",onProgress,controller.signal)
        } else if (kind==="pdf") {
          const { pdfToImages }=await import("@/lib/pdf")
          const tools=await import("@/lib/pdftools")
          const source=await tools.applyPdfEdit(item.file,item.pdfEdit)
          const output=all.pdf.output
          engine=output==="images"||output==="text"||all.pdf.compress?"pdf.js":"pdf-lib"
          if (output==="pdf") result=await tools.rebuildPdf(source,all.pdf,onProgress,controller.signal)
          else if (output==="split") result=await tools.splitPdf(source,onProgress)
          else if (output==="text") result=await tools.pdfText(source,onProgress,controller.signal)
          else result=await pdfToImages(source,all.pdf,onProgress,controller.signal)
        } else if (kind==="audio") {
          result=await media.convertAudio(item.file,all.audio,onProgress,controller.signal,item.mediaEdit)
        } else if (all.video.output==="audio") {
          result=await media.extractAudio(item.file,all.video,onProgress,controller.signal,item.mediaEdit)
        } else if (all.video.output==="gif") {
          engine="WebCodecs + gifenc"
          result=await media.videoToGif(item.file,all.video,onProgress,controller.signal,item.mediaEdit)
        } else if (all.video.output==="frame") {
          result=await media.videoFrame(item.file,all.video,item.mediaEdit)
        } else {
          result=await media.convertVideo(item.file,all.video,onProgress,controller.signal,item.mediaEdit)
        }
        patch(id,version,{ status:"done", error:undefined, result, progress:1, engine })
      } catch (error) {
        if (error instanceof media.Canceled||controller.signal.aborted) return
        const code=error instanceof media.MediaError?error.code:"decode"
        patch(id,version,{ status:"error", error:code, result:undefined })
      } finally {
        if (aborts.current.get(id)===controller) aborts.current.delete(id)
      }
    }
    mediaQueue.current=mediaQueue.current.then(job,job)
  },[patch])

  const addFiles=useCallback((files:File[]):AddReport=>{
    const sorted=files.map((file)=>({ file, kind:kindOf(file) }))
    const usable=sorted.filter((f)=>f.kind!==null) as { file:File; kind:MediaKind }[]
    const room=Math.max(0,MAX_FILES-itemsRef.current.length)
    const accepted=usable.slice(0,room)
    const fresh:Item[]=accepted.map(({ file, kind })=>({ id:"f"+(++idCounter), kind, file, previewUrl:URL.createObjectURL(file), status:"queued", version:0 }))
    setItems([...itemsRef.current,...fresh])
    if (fresh.some((it)=>it.kind!=="image")) ensureMediaEncoders()
    fresh.forEach(process)
    return { skipped:files.length-usable.length, skippedOverLimit:usable.length-accepted.length, firstKind:fresh[0]?.kind??null }
  },[process,setItems,ensureMediaEncoders])

  // Re-run the files of one kind when its settings change, debounced so sliders stay smooth.
  const changed=useRef<MediaKind|null>(null)
  useEffect(()=>{
    const kind=changed.current
    if (!kind) return
    const timer=setTimeout(()=>{
      changed.current=null
      const bumped=itemsRef.current.map((it)=>it.kind===kind?{ ...it, version:it.version+1, status:"queued" as const, progress:undefined }:it)
      setItems(bumped)
      bumped.filter((it)=>it.kind===kind).forEach(process)
    },kind==="image"?350:700)
    return ()=>clearTimeout(timer)
  },[settings,process,setItems])

  const setSettings=useCallback(<K extends MediaKind>(kind:K,next:AllSettings[K])=>{
    changed.current=kind
    setAllSettings((s)=>({ ...s, [kind]:next }))
  },[])

  const retry=useCallback((id:string)=>{
    const target=itemsRef.current.find((it)=>it.id===id)
    if (!target) return
    const next={ ...target, version:target.version+1, status:"queued" as const, progress:undefined }
    setItems(itemsRef.current.map((it)=>it.id===id?next:it))
    process(next)
  },[process,setItems])

  // Saves the editor's changes for one file and converts just that file again.
  const setEdit=useCallback((id:string,edit:ImageEdit|undefined)=>{
    const target=itemsRef.current.find((it)=>it.id===id)
    if (!target) return
    const next={ ...target, edit, version:target.version+1, status:"queued" as const, progress:undefined }
    setItems(itemsRef.current.map((it)=>it.id===id?next:it))
    process(next)
  },[process,setItems])

  const setPdfEdit=useCallback((id:string,pdfEdit:PdfEdit|undefined)=>{
    const target=itemsRef.current.find((it)=>it.id===id)
    if (!target) return
    const next={ ...target, pdfEdit, version:target.version+1, status:"queued" as const, progress:undefined }
    setItems(itemsRef.current.map((it)=>it.id===id?next:it))
    process(next)
  },[process,setItems])

  const setMediaEdit=useCallback((id:string,mediaEdit:MediaEdit|undefined)=>{
    const target=itemsRef.current.find((it)=>it.id===id)
    if (!target) return
    const next={ ...target, mediaEdit, version:target.version+1, status:"queued" as const, progress:undefined }
    setItems(itemsRef.current.map((it)=>it.id===id?next:it))
    process(next)
  },[process,setItems])

  const remove=useCallback((id:string)=>{
    aborts.current.get(id)?.abort()
    const target=itemsRef.current.find((it)=>it.id===id)
    if (target) URL.revokeObjectURL(target.previewUrl)
    setItems(itemsRef.current.filter((it)=>it.id!==id))
  },[setItems])

  const clear=useCallback((kind:MediaKind)=>{
    itemsRef.current.filter((it)=>it.kind===kind).forEach((it)=>{
      aborts.current.get(it.id)?.abort()
      URL.revokeObjectURL(it.previewUrl)
    })
    setItems(itemsRef.current.filter((it)=>it.kind!==kind))
  },[setItems])

  return { items, settings, setSettings, encoders, addFiles, retry, remove, clear, stats, setEdit, setMediaEdit, setPdfEdit }
}
