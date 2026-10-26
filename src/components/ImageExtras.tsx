import { useRef } from "react"
import { Segmented } from "@/components/ui/segmented"
import { useI18n } from "@/i18n/I18nProvider"
import { hasWatermark, isNeutral } from "@/lib/effects"
import type { AllSettings, Settings, WatermarkPosition } from "@/lib/types"
import { cn } from "@/lib/utils"

type ImageSettings=AllSettings["image"]

// One click sets format, quality and size for a common job.
const PRESETS:Record<string,Partial<Settings>>={
  web:{ format:"image/webp", quality:78, maxWidth:1920, maxHeight:null, target:{ mode:"quality", sizeKb:500, percent:50 } },
  email:{ format:"image/jpeg", quality:72, maxWidth:1280, maxHeight:null, target:{ mode:"quality", sizeKb:500, percent:50 } },
  social:{ format:"image/jpeg", quality:85, maxWidth:1080, maxHeight:null, target:{ mode:"quality", sizeKb:500, percent:50 } },
  thumb:{ format:"image/webp", quality:70, maxWidth:320, maxHeight:null, target:{ mode:"quality", sizeKb:500, percent:50 } },
  lossless:{ format:"image/png", quality:100, maxWidth:null, maxHeight:null, target:{ mode:"quality", sizeKb:500, percent:50 } },
  small:{ format:"image/webp", quality:78, maxWidth:1920, maxHeight:null, target:{ mode:"size", sizeKb:200, percent:50 } },
}

export function Presets({ settings, set }:{ settings:ImageSettings; set:(s:ImageSettings)=>void }) {
  const { t }=useI18n()
  const names=t.presetNames as Record<string,string>
  return (
    <div className="col-span-full flex flex-wrap items-center gap-2">
      <span className="mr-1 text-xs font-semibold text-muted-foreground">{t.presets}</span>
      {Object.entries(PRESETS).map(([key,preset])=>{
        const active=Object.entries(preset).every(([k,v])=>JSON.stringify(settings[k as keyof Settings])===JSON.stringify(v))
        return (
          <button
            key={key}
            type="button"
            aria-pressed={active}
            onClick={()=>set({ ...settings, ...preset })}
            className={cn("h-8 cursor-pointer rounded-full border px-3 text-[13px] font-semibold transition-colors", active?"border-transparent bg-foreground text-background":"border-border bg-secondary text-muted-foreground hover:text-foreground")}
          >
            {names[key]}
          </button>
        )
      })}
    </div>
  )
}

function Range({ id, label, value, min, max, step=1, display, onChange }:{
  id:string; label:string; value:number; min:number; max:number; step?:number; display?:string; onChange:(v:number)=>void
}) {
  return (
    <div>
      <div className="mb-0.5 flex items-baseline justify-between">
        <label htmlFor={id} className="text-xs font-semibold text-muted-foreground">{label}</label>
        <output htmlFor={id} className="text-sm font-bold tabular-nums">{display??(value>0?"+"+value:value)}</output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e)=>onChange(Number(e.target.value))}
        className="squish-range"
        style={{ ["--fill" as string]:((value-min)/(max-min))*100+"%" }}
      />
    </div>
  )
}

const POSITIONS:WatermarkPosition[]=["tl","tr","bl","br","center","tile"]

// Colour adjustments and a watermark, folded away until someone needs them.
export function AdjustPanel({ settings, set }:{ settings:ImageSettings; set:(s:ImageSettings)=>void }) {
  const { t }=useI18n()
  const logoInput=useRef<HTMLInputElement>(null)
  const a=settings.adjust
  const w=settings.watermark
  const setA=(change:Partial<typeof a>)=>set({ ...settings, adjust:{ ...a, ...change } })
  const setW=(change:Partial<typeof w>)=>set({ ...settings, watermark:{ ...w, ...change } })
  const active=!isNeutral(a)||hasWatermark(w)
  const logoName=w.logo instanceof File?w.logo.name:"logo"

  return (
    <details className="group col-span-full rounded-2xl border border-border bg-white/[0.03] open:bg-white/[0.04]">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="text-muted-foreground transition-transform group-open:rotate-90">›</span>
        {t.adjustTitle}
        {active&&<span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">{t.adjustOn}</span>}
      </summary>
      <div className="grid gap-x-5 gap-y-5 px-4 pt-1 pb-4 md:grid-cols-3">
        <Range id="adj-brightness" label={t.brightness} value={a.brightness} min={-100} max={100} onChange={(brightness)=>setA({ brightness })} />
        <Range id="adj-contrast" label={t.contrast} value={a.contrast} min={-100} max={100} onChange={(contrast)=>setA({ contrast })} />
        <Range id="adj-saturation" label={t.saturation} value={a.saturation} min={-100} max={100} onChange={(saturation)=>setA({ saturation })} />
        <Range id="adj-sharpen" label={t.sharpen} value={a.sharpen} min={0} max={100} display={String(a.sharpen)} onChange={(sharpen)=>setA({ sharpen })} />
        <label className="flex cursor-pointer items-center justify-between gap-3 self-end pb-1">
          <span className="text-xs font-semibold text-muted-foreground">{t.grayscale}</span>
          <input type="checkbox" checked={a.grayscale} onChange={(e)=>setA({ grayscale:e.target.checked })} className="peer sr-only" />
          <span
            aria-hidden
            className={"relative h-8 w-14 flex-none rounded-full border border-border bg-white/8 transition-colors peer-checked:bg-primary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary after:absolute after:top-[3px] after:left-[3px] after:size-6 after:rounded-full after:bg-foreground after:transition-transform after:duration-200 "+(a.grayscale?"after:translate-x-6":"")}
          />
        </label>
        <div className="flex items-end">
          <button
            type="button"
            disabled={isNeutral(a)}
            onClick={()=>setA({ brightness:0, contrast:0, saturation:0, grayscale:false, sharpen:0 })}
            className="h-9 cursor-pointer rounded-full border border-border bg-secondary px-4 text-[13px] font-semibold transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t.reset}
          </button>
        </div>

        <h4 className="col-span-full -mb-2 border-t border-border pt-4 text-sm font-bold">{t.watermark}</h4>
        <div className="min-w-0">
          <label htmlFor="wm-text" className="mb-2 block text-xs font-semibold text-muted-foreground">{t.watermarkText}</label>
          <input
            id="wm-text"
            value={w.text}
            disabled={!!w.logo}
            placeholder={t.watermarkPlaceholder}
            onChange={(e)=>setW({ text:e.target.value })}
            className="h-11 w-full rounded-[14px] border border-border bg-white/[0.05] px-3.5 text-sm font-semibold outline-none placeholder:font-medium placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-40"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            {w.logo
              ?<>
                <span className="truncate text-muted-foreground">{t.logoChosen(logoName)}</span>
                <button type="button" onClick={()=>setW({ logo:null })} className="cursor-pointer font-semibold text-primary underline-offset-4 hover:underline">{t.removeLogo}</button>
              </>
              :<button type="button" onClick={()=>logoInput.current?.click()} className="cursor-pointer font-semibold text-primary underline-offset-4 hover:underline">{t.chooseLogo}</button>}
            <input
              ref={logoInput}
              type="file"
              accept="image/png,image/svg+xml,image/webp,image/jpeg"
              hidden
              onChange={(e)=>{
                const file=e.target.files?.[0]
                if (file) setW({ logo:file })
                e.target.value=""
              }}
            />
          </div>
        </div>
        <Segmented
          label={t.position}
          value={w.position}
          columns={3}
          onChange={(position)=>setW({ position })}
          options={POSITIONS.map((p)=>({ value:p, label:t.positions[p] }))}
        />
        <div className="grid gap-4">
          <Range id="wm-opacity" label={t.opacity} value={w.opacity} min={5} max={100} display={w.opacity+"%"} onChange={(opacity)=>setW({ opacity })} />
          <Range id="wm-size" label={t.markSize} value={w.size} min={2} max={30} display={w.size+"%"} onChange={(size)=>setW({ size })} />
        </div>
      </div>
    </details>
  )
}
