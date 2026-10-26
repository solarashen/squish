import { useEffect, useRef, type ReactNode } from "react"
import { X } from "lucide-react"
import { useI18n } from "@/i18n/I18nProvider"
import { cn } from "@/lib/utils"

// The shared pop-out window: a native <dialog>, which handles focus, Esc and the backdrop.
export function Sheet({ open, onClose, title, children, wide }:{ open:boolean; onClose:()=>void; title:string; children:ReactNode; wide?:boolean }) {
  const { t }=useI18n()
  const ref=useRef<HTMLDialogElement>(null)

  useEffect(()=>{
    const dialog=ref.current
    if (!dialog) return
    if (open&&!dialog.open) dialog.showModal()
    if (!open&&dialog.open) dialog.close()
  },[open])

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={(e)=>{
        if (e.target===e.currentTarget) onClose()
      }}
      className={cn("info-dialog m-auto max-h-[min(92dvh,900px)] overflow-y-auto rounded-[24px] border border-edge bg-popover/90 p-0 text-foreground shadow-[0_30px_80px_rgb(0_0_0/0.5)] backdrop-blur-2xl", wide?"w-[min(100%-2rem,1100px)]":"w-[min(100%-2rem,640px)]")}
    >
      {open&&(
        <div className="relative grid gap-6 p-5 sm:p-8">
          <button type="button" onClick={onClose} aria-label={t.close} className="absolute top-4 right-4 z-10 grid size-10 cursor-pointer place-items-center rounded-full border border-border bg-secondary transition-colors hover:bg-white/12 sm:top-5 sm:right-5">
            <X aria-hidden className="size-5" strokeWidth={2.2} />
          </button>
          <h2 className="pr-12 font-display text-[26px] font-bold tracking-[-0.035em] sm:text-[32px]">{title}</h2>
          {children}
        </div>
      )}
    </dialog>
  )
}
