import { useCallback, useEffect, useRef, useState } from "react"
import { detectEncoders, EncodeError } from "@/lib/encode"
import { EXTENSIONS, FORMAT_LABELS, kindOf } from "@/lib/files"
import { encode } from "@/lib/pool"
import type { AllSettings, AudioFormat, Item, MediaKind, OutputFormat, VideoFormat } from "@/lib/types"

export const MAX_FILES=50

const DEFAULT_SETTINGS:AllSettings={
  image:{ format:"image/webp", quality:78, maxWidth:1920, maxHeight:null },
  video:{ format:"mp4", quality:"medium", maxHeight:720, removeAudio:false },
  audio:{ format:"mp3", bitrate:128 },
}

export type Encoders={
  image:Record<OutputFormat,boolean>
  video:Record<VideoFormat,boolean>
  audio:Record<AudioFormat,boolean>
}

export type AddReport={ skipped:number; skippedOverLimit:number; firstKind:MediaKind|null }

// The media module (WebCodecs + muxers) is only downloaded once someone adds audio or video.
const loadMedia=()=>import("@/lib/media")

let idCounter=0

export function useConverter() {
  const [items,setItemsState]=useState<Item[]>([])
  const [settings,setAllSettings]=useState<AllSettings>(DEFAULT_SETTINGS)
  const [encoders,setEncoders]=useState<Partial<Encoders>>({})

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
    if (!list.some((it)=>it.id===id&&it.version===version)) return
    setItems(list.map((it)=>it.id===id?{ ...it, ...change }:it))
  },[setItems])

  useEffect(()=>{
    detectEncoders().then((image)=>setEncoders((e)=>({ ...e, image })))
  },[])

  const ensureMediaEncoders=useCallback(()=>{
    if (encoders.video) return
    loadMedia()
      .then((m)=>m.detectMediaEncoders())
      .then(({ video, audio })=>setEncoders((e)=>({ ...e, video, audio })))
  },[encoders.video])

  const process=useCallback((item:Item)=>{
    const { id, version, kind }=item
    aborts.current.get(id)?.abort()

    if (kind==="image") {
      const s=settingsRef.current.image
      patch(id,version,{ status:"working" })
      encode(item.file,s)
        .then((r)=>patch(id,version,{ status:"done", error:undefined, result:{ ...r, ext:EXTENSIONS[s.format], label:FORMAT_LABELS[s.format] } }))
        .catch((error)=>{
          const code=error instanceof EncodeError?error.code:"encode"
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
        const result=kind==="video"
          ?await media.convertVideo(item.file,settingsRef.current.video,onProgress,controller.signal)
          :await media.convertAudio(item.file,settingsRef.current.audio,onProgress,controller.signal)
        patch(id,version,{ status:"done", error:undefined, result, progress:1 })
      } catch (error) {
        if (error instanceof media.Canceled) return
        const code=error instanceof media.MediaError?error.code:"encode"
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

  return { items, settings, setSettings, encoders, addFiles, retry, remove, clear }
}
