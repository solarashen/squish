import { useRef } from "react"
import { ArrowUp, ClipboardPaste } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/i18n/I18nProvider"
import { cn } from "@/lib/utils"

export type DragState="idle"|"over"|"landed"

export function DropCard({ drag, notice, onFiles, onPaste, className }:{
  className?:string
  drag:DragState
  notice:string|null
  onFiles:(files:File[])=>void
  onPaste:()=>void
}) {
  const { t }=useI18n()
  const input=useRef<HTMLInputElement>(null)
  const over=drag==="over"
  const pick=()=>input.current?.click()

  return (
    <section aria-labelledby="drop-title" data-drag={drag} className={cn("glass px-5 py-6 sm:px-8 sm:py-7", className)}>
      <h1 id="drop-title" className="text-center font-display text-[28px] leading-[1.05] font-bold tracking-[-0.035em] text-balance sm:text-[34px]">
        {t.dropTitle}
      </h1>
      <ol className="mt-2 flex flex-col items-center gap-x-1.5 gap-y-0.5 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:justify-center">
        {t.steps.map((step,i)=>(
          <li key={step} className="flex items-center gap-1.5">
            {i>0&&<span aria-hidden className="mr-0.5 hidden sm:inline">·</span>}
            <span className="font-semibold text-foreground tabular-nums">{i+1}</span>
            {step}
          </li>
        ))}
      </ol>

      {/* The drop zone: the whole area opens the picker, the button says so in words */}
      <div
        onClick={pick}
        className={cn(
          "mt-5 flex cursor-pointer flex-col items-center gap-4 rounded-[18px] border-[1.5px] border-dashed px-5 py-6 text-center transition-[background-color,border-color] duration-200 sm:flex-row sm:gap-[18px] sm:py-[22px] sm:text-left",
          over?"border-primary bg-primary/10":"border-white/22 hover:border-white/40 hover:bg-white/[0.03]",
        )}
      >
        <span aria-hidden className="grid size-[52px] flex-none place-items-center rounded-2xl border border-edge bg-white/8 text-primary">
          <ArrowUp className="size-6" strokeWidth={2.4} />
        </span>
        <span className="min-w-0">
          <strong className="block text-lg font-semibold">{over?t.dropZoneActive:t.dropZoneTitle}</strong>
          <span className="text-sm text-muted-foreground">{t.dropZoneSub}</span>
        </span>
        <span className="flex flex-wrap items-center justify-center gap-2 sm:ml-auto sm:flex-nowrap">
          <Button
            size="sm"
            className="h-11"
            onClick={(e)=>{
              e.stopPropagation()
              onPaste()
            }}
          >
            <ClipboardPaste aria-hidden className="size-4" strokeWidth={2.2} />
            {t.paste}
          </Button>
          <Button
            variant="primary"
            onClick={(e)=>{
              e.stopPropagation()
              pick()
            }}
          >
            {t.chooseFiles}
          </Button>
        </span>
      </div>

      <p role="status" aria-live="polite" className={notice?"mt-3 text-center text-sm font-semibold text-warn":"sr-only"}>
        {notice}
      </p>

      <input
        ref={input}
        type="file"
        accept="image/*,video/*,audio/*,application/pdf,.pdf,.svg,.heic,.heif,.mkv,.flac,.opus"
        multiple
        hidden
        onChange={(e)=>{
          onFiles(Array.from(e.target.files??[]))
          e.target.value=""
        }}
      />
    </section>
  )
}
