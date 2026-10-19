import { useState, type ReactNode } from "react"
import { Download, Film, ImageOff, Music, RotateCcw, X } from "lucide-react"
import { useI18n } from "@/i18n/I18nProvider"
import { downloadBlob, formatChange, formatDuration, outputName, sourceLabel } from "@/lib/files"
import type { Item } from "@/lib/types"
import { cn } from "@/lib/utils"

function Thumb({ item }:{ item:Item }) {
  const [broken,setBroken]=useState(false)
  if (item.kind==="audio"||broken) {
    const Icon=item.kind==="audio"?Music:item.kind==="video"?Film:ImageOff
    return (
      <span className={cn("grid size-11 flex-none place-items-center rounded-[14px] bg-muted", item.kind==="audio"?"text-primary":"text-muted-foreground")}>
        <Icon aria-hidden className="size-5" strokeWidth={2.2} />
      </span>
    )
  }
  if (item.kind==="video") {
    // #t=0.1 asks the browser for a frame just after the start, which works as a poster.
    return <video src={item.previewUrl+"#t=0.1"} muted playsInline preload="metadata" onError={()=>setBroken(true)} className="size-11 flex-none rounded-[14px] bg-muted object-cover" />
  }
  return <img src={item.previewUrl} alt="" onError={()=>setBroken(true)} className="size-11 flex-none rounded-[14px] object-cover" />
}

const iconBtn="grid size-9 cursor-pointer place-items-center rounded-full border border-border bg-secondary transition-colors hover:bg-white/12"

function Row({ item, onRetry, onRemove }:{ item:Item; onRetry:()=>void; onRemove:()=>void }) {
  const { t, formatBytes }=useI18n()
  const before=item.file.size
  const after=item.result?.blob.size
  const change=after!==undefined?Math.round((1-after/before)*100):null
  const name=item.result?outputName(item.file.name,item.result.ext):item.file.name

  const errors={ decode:t.errDecode, encode:t.errEncode, "unsupported-output":t.errUnsupported, "too-large":t.errTooLarge, "no-track":t.errNoTrack, codec:t.errCodec }
  // Each "A → B" pair is one no-wrap unit, so narrow screens only break between pairs.
  const pair=(a:string|number,b:string|number,join=" → ")=><span className="whitespace-nowrap">{a+join+b}</span>
  let detail:ReactNode=formatBytes(before)
  let dims:ReactNode=null
  if (item.result) {
    const r=item.result
    detail=<>{pair(formatBytes(before),formatBytes(r.blob.size))} · {pair(sourceLabel(item.file),r.label)}</>
    const length=r.duration?formatDuration(r.duration):null
    if (r.width&&r.height&&r.sourceWidth&&r.sourceHeight) {
      dims=r.width!==r.sourceWidth
        ?<>{pair(r.sourceWidth,r.sourceHeight," × ")} → {pair(r.width,r.height+" px"," × ")}</>
        :<>{pair(r.width,r.height+" px"," × ")} · <span className="whitespace-nowrap">{t.noResize}</span></>
      if (length) dims=<>{dims} · {length}</>
    } else if (length) {
      dims=length
    }
  }

  const status={
    queued:{ label:t.statusQueued, cls:"text-muted-foreground" },
    working:{ label:t.statusWorking, cls:"text-warn" },
    done:{ label:t.statusDone, cls:"text-primary" },
    error:{ label:t.statusFailed, cls:"text-destructive" },
  }[item.status]

  return (
    <li className="grid grid-cols-[44px_1fr_auto] items-center gap-x-4 gap-y-2 border-b border-border py-[11px] last:border-0 md:grid-cols-[44px_minmax(0,1.6fr)_minmax(80px,1fr)_64px_auto_auto]">
      <Thumb item={item} />
      <div className="min-w-0">
        <p className="truncate text-[15px] font-semibold" title={item.file.name}>{item.file.name}</p>
        <p className="my-1 flex items-center gap-2 md:hidden">
          {change!==null&&<span className={cn("text-sm font-bold tabular-nums",change<0?"text-warn":"text-primary")}>{formatChange(change)}</span>}
          <span className={cn("inline-flex h-6 items-center rounded-full border border-current px-2.5 text-[12px] font-semibold",status.cls)}>{status.label}</span>
        </p>
        <p className="text-xs break-words text-muted-foreground tabular-nums md:truncate">{detail}</p>
        {dims&&<p className="text-xs break-words text-muted-foreground tabular-nums md:truncate">{dims}</p>}
        {item.status==="error"&&item.error&&<p className="mt-0.5 text-xs font-semibold text-destructive">{errors[item.error]}</p>}
        {item.result?.missed&&<p className="mt-0.5 text-xs font-semibold text-warn">{t.targetMissed}</p>}
        {change!==null&&change<0&&!item.result?.missed&&<p className="mt-0.5 text-xs font-semibold text-warn">{t.larger}</p>}
      </div>

      <div className="col-span-3 h-1.5 overflow-hidden rounded-full bg-white/8 md:col-span-1" aria-hidden>
        {item.status==="working"&&(item.progress!==undefined
          ?<div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width:Math.max(4,item.progress*100)+"%" }} />
          :<div className="working-bar h-full w-full" />)}
        {item.status==="done"&&<div className="h-full w-full rounded-full bg-primary" />}
      </div>

      <p className={cn("hidden text-right text-[15px] font-bold tabular-nums md:block",change!==null&&change<0?"text-warn":"text-primary")}>
        {change!==null?formatChange(change):item.status==="working"&&item.progress!==undefined?<span className="text-muted-foreground">{Math.round(item.progress*100)+"%"}</span>:"–"}
      </p>

      <span className={cn("hidden h-7 items-center justify-self-end rounded-full border border-current px-2.5 text-xs font-semibold md:inline-flex",status.cls)}>
        <span className="sr-only">{change!==null?(change>0?"−":"+")+Math.abs(change)+"% · ":""}</span>
        {status.label}
      </span>

      <div className="col-start-3 row-start-1 flex gap-1.5 md:col-start-auto md:row-start-auto">
        {item.status==="done"&&item.result&&(
          <button type="button" aria-label={t.download(name)} title={t.downloadOne} onClick={()=>downloadBlob(item.result!.blob,name)} className={iconBtn}>
            <Download aria-hidden className="size-4" strokeWidth={2.2} />
          </button>
        )}
        {item.status==="error"&&(
          <button type="button" aria-label={t.retry} title={t.retry} onClick={onRetry} className={cn(iconBtn,"text-destructive")}>
            <RotateCcw aria-hidden className="size-4" strokeWidth={2.2} />
          </button>
        )}
        <button type="button" aria-label={t.remove(item.file.name)} onClick={onRemove} className={iconBtn}>
          <X aria-hidden className="size-4" strokeWidth={2.4} />
        </button>
      </div>
    </li>
  )
}

export function FileList({ items, onRetry, onRemove }:{
  items:Item[]
  onRetry:(id:string)=>void
  onRemove:(id:string)=>void
}) {
  const { t }=useI18n()
  if (!items.length) return null
  return (
    <section aria-label={t.files} className="glass px-4 py-1 sm:px-5">
      <ul>
        {items.map((item)=>(
          <Row key={item.id} item={item} onRetry={()=>onRetry(item.id)} onRemove={()=>onRemove(item.id)} />
        ))}
      </ul>
    </section>
  )
}
