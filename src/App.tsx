import { useCallback, useEffect, useRef, useState } from "react"
import { Binary, ChartScatter, Copy, Crop, Files, Info, Palette, Scissors, SlidersHorizontal, SplitSquareHorizontal, Star } from "lucide-react"
import { Dock } from "@/components/Dock"
import { CompareDialog } from "@/components/CompareDialog"
import { DropCard, type DragState } from "@/components/DropCard"
import { EditDialog } from "@/components/EditDialog"
import { MediaEditDialog } from "@/components/MediaEditDialog"
import { FileSettingsDialog } from "@/components/FileSettingsDialog"
import { FormatsDialog } from "@/components/FormatsDialog"
import { MergeDialog } from "@/components/MergeDialog"
import { PdfPagesDialog } from "@/components/PdfPagesDialog"
import { FileList } from "@/components/FileList"
import { Header } from "@/components/Header"
import { InfoDialog, type InfoPage } from "@/components/InfoDialog"
import { KindTabs } from "@/components/KindTabs"
import { OptionsDialog } from "@/components/OptionsDialog"
import { PaletteDialog } from "@/components/PaletteDialog"
import { PhotoInfoDialog } from "@/components/PhotoInfoDialog"
import { SettingsStrip } from "@/components/SettingsStrip"
import { useConverter } from "@/hooks/useConverter"
import { useGeneral } from "@/hooks/useGeneral"
import { canCopyImages, copyImage, copyText } from "@/lib/clipboard"
import { dataUrl, faviconPack } from "@/lib/imagetools"
import { collectDrop, expandZips } from "@/lib/collect"
import type { RowAction } from "@/components/RowMenu"
import { useI18n } from "@/i18n/I18nProvider"
import { EXTENSIONS } from "@/lib/files"
import type { Item, MediaKind, OutputFormat } from "@/lib/types"

let pasteCounter=0

function namePasted(blob:Blob) {
  const ext=EXTENSIONS[blob.type as OutputFormat]??"png"
  return new File([blob],"pasted-"+(++pasteCounter)+"."+ext,{ type:blob.type })
}

export default function App() {
  const { t }=useI18n()
  const general=useGeneral()
  const { items, settings, setSettings, encoders, addFiles, retry, remove, clear, stats, setEdit, setMediaEdit, setPdfEdit, setOverride }=useConverter(general.remember)
  const [options,setOptions]=useState(false)
  const [comparing,setComparing]=useState<Item|null>(null)
  const [inspecting,setInspecting]=useState<Item|null>(null)
  const [colours,setColours]=useState<Item|null>(null)
  const [editing,setEditing]=useState<Item|null>(null)
  const [trimming,setTrimming]=useState<Item|null>(null)
  const [paging,setPaging]=useState<Item|null>(null)
  const [merging,setMerging]=useState(false)
  const [benchmarking,setBenchmarking]=useState<Item|null>(null)
  const [tuning,setTuning]=useState<Item|null>(null)
  // A short message at the bottom of the screen, e.g. after copying.
  const [toast,setToast]=useState<string|null>(null)
  useEffect(()=>{
    if (!toast) return
    const timer=setTimeout(()=>setToast(null),2200)
    return ()=>clearTimeout(timer)
  },[toast])
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
      if (e.dataTransfer) collectDrop(e.dataTransfer).then(take)
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
    // Single-key shortcuts, ignored while typing or while a window is open.
    const key=(e:KeyboardEvent)=>{
      const target=e.target as HTMLElement|null
      if (e.ctrlKey||e.metaKey||e.altKey||target?.closest("input, textarea, select, dialog[open]")) return
      const kinds:MediaKind[]=["image","video","audio","pdf"]
      if (/^[1-4]$/.test(e.key)) setKind(kinds[Number(e.key)-1])
      else if (e.key==="o"||e.key==="O") document.getElementById("file-input")?.click()
      else if (e.key==="d"||e.key==="D") document.getElementById("download-all")?.click()
      else if (e.key==="?") setOptions(true)
      else return
      e.preventDefault()
    }
    window.addEventListener("keydown",key)
    window.addEventListener("dragenter",enter)
    window.addEventListener("dragover",over)
    window.addEventListener("dragleave",leave)
    window.addEventListener("drop",drop)
    window.addEventListener("paste",paste)
    return ()=>{
      window.removeEventListener("keydown",key)
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
  const counts={ image:0, video:0, audio:0, pdf:0 }
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

  const actionsFor=(item:Item,_name:string):RowAction[]=>{
    const actions:RowAction[]=[]
    const blob=item.result?.blob
    if (item.kind==="image"&&!/^video\//.test(settings.image.format)) {
      actions.push({ id:"edit", label:t.edit, icon:Crop, onSelect:()=>setEditing(item) })
    }
    if (item.kind==="image"&&!/^video\//.test(settings.image.format)) {
      actions.push({ id:"own", label:t.fileSettings, icon:SlidersHorizontal, onSelect:()=>setTuning(item) })
      actions.push({ id:"formats", label:t.compareFormats, icon:ChartScatter, onSelect:()=>setBenchmarking(item) })
    }
    if (item.kind==="pdf") {
      actions.push({ id:"pages", label:t.pagesAction, icon:Files, onSelect:()=>setPaging(item) })
    }
    if (item.kind==="video"||item.kind==="audio") {
      actions.push({ id:"trim", label:item.kind==="video"?t.trimVideo:t.trimAudio, icon:Scissors, onSelect:()=>setTrimming(item) })
    }
    // Side-by-side only makes sense when the result is a picture the browser can show.
    if (item.kind==="image"&&blob&&/^image\/(jpeg|png|webp|avif|gif|bmp)$/.test(blob.type)) {
      actions.push({ id:"compare", label:t.compare, icon:SplitSquareHorizontal, onSelect:()=>setComparing(item) })
    }
    if (item.kind==="image"&&/^image\/(jpeg|heic|heif|tiff|png|webp|avif)$/.test(item.file.type||"image/heic")) {
      actions.push({ id:"info", label:t.photoInfo, icon:Info, onSelect:()=>setInspecting(item) })
    }
    if (blob&&blob.type.startsWith("image/")&&blob.type!=="image/x-icon"&&canCopyImages()) {
      actions.push({ id:"copy", label:t.copy, icon:Copy, onSelect:()=>copyImage(blob).then(()=>setToast(t.copied),()=>setToast(t.copyFailed)) })
    }
    if (item.kind==="image"&&blob) {
      actions.push({ id:"palette", label:t.palette, icon:Palette, onSelect:()=>setColours(item) })
      actions.push({
        id:"favicon",
        label:t.faviconPack,
        icon:Star,
        onSelect:()=>fetch(item.previewUrl).then((r)=>r.blob()).then((b)=>faviconPack(b,item.file.name.replace(/\.[^.]+$/,""))),
      })
      if (blob.type.startsWith("image/")) {
        actions.push({
          id:"base64",
          label:t.base64,
          icon:Binary,
          onSelect:()=>dataUrl(blob).then(copyText).then(()=>setToast(blob.size>500*1024?t.base64Large:t.copied),()=>setToast(t.copyFailed)),
        })
      }
    }
    return actions
  }

  const tally=t.tally(
    visible.filter((it)=>it.status==="done").length,
    visible.filter((it)=>it.status==="working"||it.status==="queued").length,
    visible.filter((it)=>it.status==="error").length,
  )

  return (
    <>
      <Header onOpen={setInfo} onOptions={()=>setOptions(true)} />
      <main id="top" className={"mx-auto flex max-w-[940px] flex-col gap-3.5 px-4 pt-2 sm:px-6 "+(visible.length?"pb-36":"pb-16")}>
        <DropCard drag={drag} notice={notice} onFiles={(files)=>expandZips(files).then(take)} onPaste={pasteFromButton} />
        <KindTabs value={kind} onChange={setKind} counts={counts} />
        <SettingsStrip kind={kind} settings={settings} setSettings={setSettings} encoders={encoders} />
        <div id="kind-panel" role="tabpanel" aria-labelledby={"tab-"+kind}>
          {tally&&<p className="mb-2 px-1 text-right text-sm text-muted-foreground tabular-nums">{tally}</p>}
          {visible.length>0
            ?<FileList items={visible} onRetry={retry} onRemove={remove} pattern={general.pattern} actionsFor={actionsFor} />
            :<p className="glass px-5 py-6 text-center text-sm text-muted-foreground">{t.listEmpty}</p>}
        </div>
      </main>
      {visible.length>0&&<Dock kind={kind} items={visible} onClear={()=>clear(kind)} onMerge={kind==="pdf"?()=>setMerging(true):undefined} pattern={general.pattern} />}
      <p role="status" aria-live="polite" className={toast?"glass fixed bottom-28 left-1/2 z-40 -translate-x-1/2 rounded-full px-5 py-2.5 text-sm font-semibold sm:bottom-32":"sr-only"}>{toast}</p>
      <InfoDialog page={info} onClose={()=>setInfo(null)} />
      <CompareDialog item={comparing} onClose={()=>setComparing(null)} />
      <PhotoInfoDialog item={inspecting} onClose={()=>setInspecting(null)} />
      <EditDialog item={editing} onClose={()=>setEditing(null)} onApply={(edit)=>editing&&setEdit(editing.id,edit)} />
      <FormatsDialog item={benchmarking} settings={settings.image} onClose={()=>setBenchmarking(null)} />
      <FileSettingsDialog item={tuning} shared={settings.image} encoders={encoders.image} onClose={()=>setTuning(null)} onApply={(o)=>tuning&&setOverride(tuning.id,o)} />
      <PdfPagesDialog item={paging} onClose={()=>setPaging(null)} onApply={(edit)=>paging&&setPdfEdit(paging.id,edit)} />
      <MergeDialog items={items.filter((it)=>it.kind==="pdf")} open={merging} onClose={()=>setMerging(false)} />
      <MediaEditDialog item={trimming} onClose={()=>setTrimming(null)} onApply={(edit)=>trimming&&setMediaEdit(trimming.id,edit)} />
      <PaletteDialog item={colours} onClose={()=>setColours(null)} onCopied={(hex)=>setToast(t.copied+": "+hex)} />
      <OptionsDialog
        open={options}
        onClose={()=>setOptions(false)}
        pattern={general.pattern}
        setPattern={general.setPattern}
        remember={general.remember}
        setRemember={general.setRemember}
        stats={stats}
      />
    </>
  )
}
