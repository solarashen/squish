import { useEffect, useRef } from "react"
import { X } from "lucide-react"
import type { SessionStats } from "@/hooks/useConverter"
import { useI18n } from "@/i18n/I18nProvider"
import { formatChange, patternName } from "@/lib/files"
import type { Item } from "@/lib/types"

const field="h-11 w-full rounded-[14px] border border-border bg-white/[0.05] px-3.5 text-sm font-semibold outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"

// Settings that apply to the whole site: how downloads are named, whether settings are remembered,
// the keyboard shortcuts, and what this session has converted so far.
export function OptionsDialog({ open, onClose, pattern, setPattern, remember, setRemember, stats }:{
  open:boolean
  onClose:()=>void
  pattern:string
  setPattern:(p:string)=>void
  remember:boolean
  setRemember:(r:boolean)=>void
  stats:SessionStats
}) {
  const { t, formatBytes }=useI18n()
  const ref=useRef<HTMLDialogElement>(null)

  useEffect(()=>{
    const dialog=ref.current
    if (!dialog) return
    if (open&&!dialog.open) dialog.showModal()
    if (!open&&dialog.open) dialog.close()
  },[open])

  const sample:Item={ id:"x", kind:"image", file:new File([],"holiday.jpg"), previewUrl:"", status:"done", version:0, result:{ blob:new Blob(), ext:"webp", label:"WebP" } }
  const saved=stats.bytesIn?(1-stats.bytesOut/stats.bytesIn)*100:0

  return (
    <dialog
      ref={ref}
      aria-labelledby="options-title"
      onClose={onClose}
      onClick={(e)=>{
        if (e.target===e.currentTarget) onClose()
      }}
      className="info-dialog m-auto max-h-[min(88dvh,760px)] w-[min(100%-2rem,640px)] overflow-y-auto rounded-[24px] border border-edge bg-popover/85 p-0 text-foreground shadow-[0_30px_80px_rgb(0_0_0/0.5)] backdrop-blur-2xl"
    >
      <div className="relative grid gap-8 p-6 sm:p-9">
        <button type="button" onClick={onClose} aria-label={t.close} className="absolute top-5 right-5 grid size-10 cursor-pointer place-items-center rounded-full border border-border bg-secondary transition-colors hover:bg-white/12">
          <X aria-hidden className="size-5" strokeWidth={2.2} />
        </button>
        <h2 id="options-title" className="pr-12 font-display text-[32px] font-bold tracking-[-0.035em]">{t.optionsTitle}</h2>

        <section className="grid gap-2">
          <label htmlFor="naming" className="text-lg font-bold">{t.namingTitle}</label>
          <input id="naming" value={pattern} placeholder="{name}" onChange={(e)=>setPattern(e.target.value)} className={field} spellCheck={false} />
          <p className="text-[13px] text-muted-foreground">{t.namingHint}</p>
          <p className="text-[13px] font-semibold tabular-nums">{t.namingExample(patternName(pattern,sample,2,12))}</p>
        </section>

        <section className="grid gap-1.5">
          <label className="flex cursor-pointer items-center justify-between gap-4">
            <span className="text-lg font-bold">{t.rememberLabel}</span>
            <input type="checkbox" checked={remember} onChange={(e)=>setRemember(e.target.checked)} className="peer sr-only" />
            <span
              aria-hidden
              className={"relative h-8 w-14 flex-none rounded-full border border-border bg-white/8 transition-colors peer-checked:bg-primary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary after:absolute after:top-[3px] after:left-[3px] after:size-6 after:rounded-full after:bg-foreground after:transition-transform after:duration-200 "+(remember?"after:translate-x-6":"")}
            />
          </label>
          <p className="text-[13px] text-muted-foreground">{t.rememberHint}</p>
        </section>

        <section className="grid gap-3">
          <h3 className="text-lg font-bold">{t.statsTitle}</h3>
          {stats.files===0
            ?<p className="text-sm text-muted-foreground">{t.statsEmpty}</p>
            :(
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  [t.statsFiles,String(stats.files)],
                  [t.statsSaved,formatChange(saved)+" · "+formatBytes(Math.max(0,stats.bytesIn-stats.bytesOut))],
                  [t.statsTime,t.seconds(stats.ms/1000)],
                  [t.statsAverage,t.seconds(stats.ms/stats.files/1000)],
                ].map(([k,v])=>(
                  <div key={k} className="rounded-2xl border border-border bg-white/[0.04] px-3.5 py-3">
                    <dt className="text-xs font-semibold text-muted-foreground">{k}</dt>
                    <dd className="mt-1 text-[15px] font-bold tabular-nums">{v}</dd>
                  </div>
                ))}
              </dl>
            )}
          {stats.files>0&&(
            <p className="text-[13px] text-muted-foreground">
              {t.statsEngines+": "+Object.entries(stats.engines).map(([e,n])=>e+" ("+n+")").join(", ")}
            </p>
          )}
        </section>

        <section className="grid gap-3">
          <h3 className="text-lg font-bold">{t.shortcutsTitle}</h3>
          <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-sm">
            {t.shortcuts.map(([key,label])=>(
              <div key={key} className="contents">
                <dt><kbd className="inline-block min-w-8 rounded-lg border border-edge bg-white/6 px-2 py-0.5 text-center font-sans text-xs font-bold">{key}</kbd></dt>
                <dd className="text-muted-foreground">{label}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </dialog>
  )
}
