import type { InfoPage } from "@/components/InfoDialog"
import { useI18n } from "@/i18n/I18nProvider"
import type { Lang } from "@/i18n/strings"
import { cn } from "@/lib/utils"

export function Logo({ className }:{ className?:string }) {
  return (
    <span className={cn("inline-flex items-baseline font-display text-[26px] leading-none font-extrabold tracking-[-0.04em]", className)}>
      squish
      <span aria-hidden className="ml-[3px] inline-block size-[9px] rounded-full bg-primary" />
    </span>
  )
}

const chip="inline-flex h-9 cursor-pointer items-center rounded-full border border-border bg-secondary px-3.5 text-[13px] font-semibold transition-colors hover:bg-white/10"

export function Header({ onOpen, onOptions }:{ onOpen:(page:InfoPage)=>void; onOptions:()=>void }) {
  const { t, lang, setLang }=useI18n()
  const langs:Lang[]=["en","hr"]
  return (
    <header className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-3 gap-y-3 px-4 pt-5 pb-2 sm:px-10">
      <a href="#top" aria-label="squish" className="mr-2 rounded-lg">
        <Logo />
      </a>
      <nav aria-label="Main" className="order-3 flex w-full gap-2 sm:order-none sm:w-auto">
        <button type="button" aria-haspopup="dialog" onClick={()=>onOpen("how")} className={chip}>
          {t.navHow}
        </button>
        <button type="button" aria-haspopup="dialog" onClick={()=>onOpen("about")} className={chip}>
          {t.navAbout}
        </button>
        <button type="button" aria-haspopup="dialog" aria-keyshortcuts="?" onClick={onOptions} className={chip}>
          {t.navOptions}
        </button>
      </nav>
      <div role="group" aria-label={t.langLabel} className="ml-auto flex rounded-full border border-border bg-secondary p-[3px]">
        {langs.map((l)=>(
          <button
            key={l}
            type="button"
            aria-pressed={lang===l}
            onClick={()=>setLang(l)}
            className={cn("h-7 cursor-pointer rounded-full px-3 text-xs font-bold uppercase transition-colors", lang===l?"bg-foreground text-background":"text-muted-foreground hover:text-foreground")}
          >
            {l}
          </button>
        ))}
      </div>
    </header>
  )
}
