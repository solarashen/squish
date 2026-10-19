import { Logo } from "@/components/Header"
import type { InfoPage } from "@/components/InfoDialog"
import { useI18n } from "@/i18n/I18nProvider"
import { cn } from "@/lib/utils"

const REPO="https://github.com/solarashen/squish"

const link="cursor-pointer rounded-md text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"

export function Footer({ onOpen, className }:{ onOpen:(page:InfoPage)=>void; className?:string }) {
  const { t }=useI18n()
  return (
    <footer className={cn("mx-auto mt-14 max-w-[940px] px-4 sm:px-6", className)}>
      <div className="flex flex-col gap-5 border-t border-border pt-7 text-[13px] sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <span className="flex items-baseline gap-3">
            <Logo className="text-xl" />
            <span className="text-muted-foreground">{t.footerThesis}</span>
          </span>
          <p className="flex items-center gap-2 text-muted-foreground">
            <span aria-hidden className="size-1.5 rounded-full bg-primary" />
            {t.footerPrivacy}
          </p>
          <p className="text-muted-foreground/70">{t.footerTech}</p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2 font-semibold">
          <button type="button" aria-haspopup="dialog" onClick={()=>onOpen("how")} className={link}>{t.navHow}</button>
          <button type="button" aria-haspopup="dialog" onClick={()=>onOpen("about")} className={link}>{t.navAbout}</button>
          <a href={REPO} target="_blank" rel="noreferrer" className={link}>{t.footerSource}</a>
        </nav>
      </div>
    </footer>
  )
}
