import { useEffect, useRef } from "react"
import { X } from "lucide-react"
import { useI18n } from "@/i18n/I18nProvider"

export type InfoPage="how"|"about"

// "How it works" and "About" open as a pop-out sheet over the tool, using the native <dialog>
// element, which handles focus, Esc and the backdrop for free.
export function InfoDialog({ page, onClose }:{ page:InfoPage|null; onClose:()=>void }) {
  const { t }=useI18n()
  const ref=useRef<HTMLDialogElement>(null)

  useEffect(()=>{
    const dialog=ref.current
    if (!dialog) return
    if (page&&!dialog.open) dialog.showModal()
    if (!page&&dialog.open) dialog.close()
  },[page])

  return (
    <dialog
      ref={ref}
      aria-labelledby="info-title"
      onClose={onClose}
      onClick={(e)=>{
        // A click on the backdrop lands on the dialog element itself.
        if (e.target===e.currentTarget) onClose()
      }}
      className="info-dialog m-auto max-h-[min(88dvh,760px)] w-[min(100%-2rem,720px)] overflow-y-auto rounded-[24px] border border-edge bg-popover/85 p-0 text-foreground shadow-[0_30px_80px_rgb(0_0_0/0.5)] backdrop-blur-2xl"
    >
      <div className="relative p-6 sm:p-10">
        <button type="button" onClick={onClose} aria-label={t.close} className="absolute top-5 right-5 grid size-10 cursor-pointer place-items-center rounded-full border border-border bg-secondary transition-colors hover:bg-white/12">
          <X aria-hidden className="size-5" strokeWidth={2.2} />
        </button>

        {page==="how"&&(
          <>
            <h2 id="info-title" className="pr-12 font-display text-[32px] font-bold tracking-[-0.035em]">{t.howTitle}</h2>
            <h3 className="mt-7 text-lg font-bold">{t.howImagesTitle}</h3>
            <ol className="mt-4 grid gap-5">
              {t.howSteps.map(([title,text],i)=>(
                <li key={title} className="flex gap-4">
                  <span aria-hidden className="grid size-10 flex-none place-items-center rounded-full border border-edge bg-white/6 font-bold text-primary">{i+1}</span>
                  <div>
                    <h4 className="font-semibold">{title}</h4>
                    <p className="text-muted-foreground">{text}</p>
                  </div>
                </li>
              ))}
            </ol>
            <h3 className="mt-8 text-lg font-bold">{t.howMediaTitle}</h3>
            <p className="mt-2 max-w-[65ch] text-muted-foreground">{t.howMediaText}</p>
            <p className="mt-6 max-w-[65ch] rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 font-semibold">{t.howPrivacy}</p>
          </>
        )}

        {page==="about"&&(
          <>
            <h2 id="info-title" className="pr-12 font-display text-[32px] font-bold tracking-[-0.035em]">{t.aboutTitle}</h2>
            <p className="mt-5 max-w-[65ch] text-[17px] leading-relaxed">{t.aboutText}</p>
            <ul className="mt-6 grid gap-2 text-muted-foreground">
              {t.aboutFacts.map((fact)=>(
                <li key={fact} className="flex gap-2.5">
                  <span aria-hidden className="mt-2 size-2 flex-none rounded-full bg-primary" />
                  {fact}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </dialog>
  )
}
