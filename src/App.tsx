import { useCallback, useEffect, useRef, useState } from "react"
import { Dock } from "@/components/Dock"
import { DropCard, type DragState } from "@/components/DropCard"
import { FileList } from "@/components/FileList"
import { Header } from "@/components/Header"
import { InfoDialog, type InfoPage } from "@/components/InfoDialog"
import { KindTabs } from "@/components/KindTabs"
import { SettingsStrip } from "@/components/SettingsStrip"
import { useConverter } from "@/hooks/useConverter"
import { useI18n } from "@/i18n/I18nProvider"
import { EXTENSIONS } from "@/lib/files"
import type { MediaKind, OutputFormat } from "@/lib/types"

let pasteCounter=0

function namePasted(blob:Blob) {
  const ext=EXTENSIONS[blob.type as OutputFormat]??"png"
  return new File([blob],"pasted-"+(++pasteCounter)+"."+ext,{ type:blob.type })
}

export default function App() {
  const { t }=useI18n()
  const { items, settings, setSettings, encoders, addFiles, retry, remove, clear }=useConverter()
  const [drag,setDrag]=useState<DragState>("idle")
  const [notice,setNotice]=useState<string|null>(null)
  const [kind,setKind]=useState<MediaKind>("image")
  const [info,setInfo]=useState<InfoPage|null>(null)
  const depth=useRef(0)

  const take=useCallback((files:File[])=>{
    if (!files.length) return
    const report=addFiles(files)
    const parts:string[]=[]
    if (report.skipped) parts.push(t.skipped(report.skipped))
    if (report.skippedOverLimit) parts.push(t.tooMany(report.skippedOverLimit))
    setNotice(parts.length?parts.join(" "):null)
    // Show the tab the new files went to.
    if (report.firstKind) setKind(report.firstKind)
    setDrag("landed")
    setTimeout(()=>setDrag((d)=>d==="landed"?"idle":d),800)
  },[addFiles,t])

  // The whole window is a drop target, so nobody has to aim at the card.
  useEffect(()=>{
    const hasFiles=(e:DragEvent)=>Array.from(e.dataTransfer?.types??[]).includes("Files")
    const enter=(e:DragEvent)=>{
      if (!hasFiles(e)) return
      e.preventDefault()
      depth.current++
      setDrag("over")
    }
    const over=(e:DragEvent)=>{
      if (hasFiles(e)) e.preventDefault()
    }
    const leave=(e:DragEvent)=>{
      if (!hasFiles(e)) return
      depth.current=Math.max(0,depth.current-1)
      if (depth.current===0) setDrag("idle")
    }
    const drop=(e:DragEvent)=>{
      if (!hasFiles(e)) return
      e.preventDefault()
      depth.current=0
      setDrag("idle")
      take(Array.from(e.dataTransfer?.files??[]))
    }
    const paste=(e:ClipboardEvent)=>{
      const target=e.target as HTMLElement|null
      if (target?.closest("input, textarea")) return
      const files=Array.from(e.clipboardData?.files??[])
      if (files.length) {
        e.preventDefault()
        take(files)
      }
    }
    window.addEventListener("dragenter",enter)
    window.addEventListener("dragover",over)
    window.addEventListener("dragleave",leave)
    window.addEventListener("drop",drop)
    window.addEventListener("paste",paste)
    return ()=>{
      window.removeEventListener("dragenter",enter)
      window.removeEventListener("dragover",over)
      window.removeEventListener("dragleave",leave)
      window.removeEventListener("drop",drop)
      window.removeEventListener("paste",paste)
    }
  },[take])

  const pasteFromButton=useCallback(async ()=>{
    if (!navigator.clipboard?.read) {
      setNotice(t.pasteHint)
      return
    }
    try {
      const entries=await navigator.clipboard.read()
      const files:File[]=[]
      for (const entry of entries) {
        const type=entry.types.find((ty)=>ty.startsWith("image/"))
        if (type) files.push(namePasted(await entry.getType(type)))
      }
      if (files.length) take(files)
      else setNotice(t.pasteEmpty)
    } catch {
      setNotice(t.pasteDenied)
    }
  },[take,t])

  const visible=items.filter((it)=>it.kind===kind)
  const counts={ image:0, video:0, audio:0 }
  for (const it of items) counts[it.kind]++

  // The aurora behind the page answers what happens: it brightens while files are dragged over
  // the window and glows once when a batch finishes.
  useEffect(()=>{
    document.documentElement.dataset.drag=drag
  },[drag])
  const busy=items.some((it)=>it.status==="queued"||it.status==="working")
  const wasBusy=useRef(false)
  useEffect(()=>{
    const finished=wasBusy.current&&!busy&&items.some((it)=>it.status==="done")
    wasBusy.current=busy
    if (!finished) return
    const root=document.documentElement
    delete root.dataset.pulse
    // Re-adding the attribute on the next frame restarts the animation.
    const frame=requestAnimationFrame(()=>{
      root.dataset.pulse=""
    })
    const timer=setTimeout(()=>delete root.dataset.pulse,1900)
    return ()=>{
      cancelAnimationFrame(frame)
      clearTimeout(timer)
    }
  },[busy,items])

  const tally=t.tally(
    visible.filter((it)=>it.status==="done").length,
    visible.filter((it)=>it.status==="working"||it.status==="queued").length,
    visible.filter((it)=>it.status==="error").length,
  )

  return (
    <>
      <Header onOpen={setInfo} />
      <main id="top" className={"mx-auto flex max-w-[940px] flex-col gap-3.5 px-4 pt-2 sm:px-6 "+(visible.length?"pb-36":"pb-16")}>
        <DropCard drag={drag} notice={notice} onFiles={take} onPaste={pasteFromButton} />
        <KindTabs value={kind} onChange={setKind} counts={counts} />
        <SettingsStrip kind={kind} settings={settings} setSettings={setSettings} encoders={encoders} />
        <div id="kind-panel" role="tabpanel" aria-labelledby={"tab-"+kind}>
          {tally&&<p className="mb-2 px-1 text-right text-sm text-muted-foreground tabular-nums">{tally}</p>}
          {visible.length>0
            ?<FileList items={visible} onRetry={retry} onRemove={remove} />
            :<p className="glass px-5 py-6 text-center text-sm text-muted-foreground">{t.listEmpty}</p>}
        </div>
      </main>
      {visible.length>0&&<Dock kind={kind} items={visible} onClear={()=>clear(kind)} />}
      <InfoDialog page={info} onClose={()=>setInfo(null)} />
    </>
  )
}
