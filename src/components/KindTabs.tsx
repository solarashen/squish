import { useRef, type KeyboardEvent } from "react"
import { useI18n } from "@/i18n/I18nProvider"
import type { MediaKind } from "@/lib/types"
import { cn } from "@/lib/utils"

const KINDS:MediaKind[]=["image","video","audio","pdf"]

export function KindTabs({ value, onChange, counts }:{
  value:MediaKind
  onChange:(kind:MediaKind)=>void
  counts:Record<MediaKind,number>
}) {
  const { t }=useI18n()
  const refs=useRef<(HTMLButtonElement|null)[]>([])
  const labels={ image:t.tabImages, video:t.tabVideo, audio:t.tabAudio, pdf:t.tabPdf }

  // Arrow keys move between tabs, as in any tab list.
  const onKey=(e:KeyboardEvent,i:number)=>{
    const step=e.key==="ArrowRight"?1:e.key==="ArrowLeft"?-1:0
    if (!step) return
    e.preventDefault()
    const next=(i+step+KINDS.length)%KINDS.length
    onChange(KINDS[next])
    refs.current[next]?.focus()
  }

  return (
    <div role="tablist" aria-label={t.tabsLabel} className="glass flex w-full gap-1.5 rounded-full p-1.5">
      {KINDS.map((kind,i)=>{
        const active=value===kind
        return (
          <button
            key={kind}
            ref={(el)=>{
              refs.current[i]=el
            }}
            type="button"
            role="tab"
            id={"tab-"+kind}
            aria-selected={active}
            aria-controls="kind-panel"
            tabIndex={active?0:-1}
            onClick={()=>onChange(kind)}
            onKeyDown={(e)=>onKey(e,i)}
            className={cn("inline-flex h-12 min-w-0 flex-1 cursor-pointer items-center justify-center gap-1 rounded-full px-1 text-[15px] font-semibold transition-colors sm:h-14 sm:gap-2 sm:px-2 sm:text-lg", active?"bg-foreground text-background":"text-muted-foreground hover:bg-white/6 hover:text-foreground")}
          >
            {labels[kind]}
            {counts[kind]>0&&(
              <span className={cn("grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-bold tabular-nums sm:h-6 sm:min-w-6 sm:px-1.5 sm:text-xs", active?"bg-primary text-primary-foreground":"bg-white/10 text-foreground")}>
                {counts[kind]}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
