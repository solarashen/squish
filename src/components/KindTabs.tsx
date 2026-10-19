import { useRef, type KeyboardEvent } from "react"
import { useI18n } from "@/i18n/I18nProvider"
import type { MediaKind } from "@/lib/types"
import { cn } from "@/lib/utils"

const KINDS:MediaKind[]=["image","video","audio"]

export function KindTabs({ value, onChange, counts }:{
  value:MediaKind
  onChange:(kind:MediaKind)=>void
  counts:Record<MediaKind,number>
}) {
  const { t }=useI18n()
  const refs=useRef<(HTMLButtonElement|null)[]>([])
  const labels={ image:t.tabImages, video:t.tabVideo, audio:t.tabAudio }

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
    <div role="tablist" aria-label={t.tabsLabel} className="glass flex w-full gap-1 rounded-full p-1 sm:w-max">
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
            className={cn("inline-flex h-9 min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full px-2 text-sm font-semibold transition-colors sm:flex-none sm:px-4", active?"bg-white/12 text-foreground":"text-muted-foreground hover:text-foreground")}
          >
            {labels[kind]}
            {counts[kind]>0&&(
              <span className={cn("grid h-[18px] min-w-[18px] place-items-center rounded-full px-1.5 text-[11px] font-bold tabular-nums", active?"bg-primary text-primary-foreground":"bg-white/10 text-foreground")}>
                {counts[kind]}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
