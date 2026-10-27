import { Range } from "@/components/ImageExtras"
import { Segmented } from "@/components/ui/segmented"
import { useI18n } from "@/i18n/I18nProvider"
import type { AllSettings, VideoSettings } from "@/lib/types"
import { cn } from "@/lib/utils"

type Video=AllSettings["video"]
type Audio=AllSettings["audio"]

// Size limits of the places people most often send video to.
const VIDEO_PRESETS:Record<string,Partial<VideoSettings>>={
  discord:{ output:"video", format:"mp4", codec:"auto", maxHeight:720, target:{ mode:"size", sizeKb:9800, percent:50 } },
  whatsapp:{ output:"video", format:"mp4", codec:"avc", maxHeight:720, target:{ mode:"size", sizeKb:15800, percent:50 } },
  email:{ output:"video", format:"mp4", codec:"auto", maxHeight:1080, target:{ mode:"size", sizeKb:24500, percent:50 } },
  web:{ output:"video", format:"webm", codec:"auto", maxHeight:1080, target:{ mode:"quality", sizeKb:9800, percent:50 }, quality:"medium" },
}

export function VideoPresets({ settings, set }:{ settings:Video; set:(s:Video)=>void }) {
  const { t }=useI18n()
  const names=t.videoPresetNames as Record<string,string>
  return (
    <div className="col-span-full flex flex-wrap items-center gap-2">
      <span className="mr-1 text-xs font-semibold text-muted-foreground">{t.presets}</span>
      {Object.entries(VIDEO_PRESETS).map(([key,preset])=>{
        const active=Object.entries(preset).every(([k,v])=>JSON.stringify(settings[k as keyof Video])===JSON.stringify(v))
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

export function Toggle({ label, checked, onChange }:{ label:string; checked:boolean; onChange:(v:boolean)=>void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 self-end pb-1">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <input type="checkbox" checked={checked} onChange={(e)=>onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden
        className={"relative h-8 w-14 flex-none rounded-full border border-border bg-white/8 transition-colors peer-checked:bg-primary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary after:absolute after:top-[3px] after:left-[3px] after:size-6 after:rounded-full after:bg-foreground after:transition-transform after:duration-200 "+(checked?"after:translate-x-6":"")}
      />
    </label>
  )
}

function Panel({ title, active, children }:{ title:string; active:boolean; children:React.ReactNode }) {
  const { t }=useI18n()
  return (
    <details className="group col-span-full rounded-2xl border border-border bg-white/[0.03] open:bg-white/[0.04]">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="text-muted-foreground transition-transform group-open:rotate-90">›</span>
        {title}
        {active&&<span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">{t.adjustOn}</span>}
      </summary>
      <div className="grid gap-x-5 gap-y-5 px-4 pt-1 pb-4 md:grid-cols-3">{children}</div>
    </details>
  )
}

const ROTATIONS:Video["rotate"][]=[0,90,180,270]
const FRAME_RATES=[null,60,30,24,15]
const SPEEDS=[0.5,0.75,1,1.5,2]

export function VideoTools({ settings, set }:{ settings:Video; set:(s:Video)=>void }) {
  const { t }=useI18n()
  const active=settings.rotate!==0||settings.flip||settings.fps!==null||settings.speed!==1
  return (
    <Panel title={t.videoTools} active={active}>
      <Segmented
        label={t.rotate}
        value={String(settings.rotate)}
        onChange={(v)=>set({ ...settings, rotate:Number(v) as Video["rotate"] })}
        options={ROTATIONS.map((r)=>({ value:String(r), label:r+"°" }))}
      />
      <Segmented
        label={t.frameRate}
        value={String(settings.fps??"orig")}
        onChange={(v)=>set({ ...settings, fps:v==="orig"?null:Number(v) })}
        options={FRAME_RATES.map((f)=>({ value:String(f??"orig"), label:f?String(f):t.original }))}
      />
      <Segmented
        label={t.speed}
        value={String(settings.speed)}
        onChange={(v)=>set({ ...settings, speed:Number(v) })}
        options={SPEEDS.map((s)=>({ value:String(s), label:s+"×" }))}
      />
      <Toggle label={t.flipH} checked={settings.flip} onChange={(flip)=>set({ ...settings, flip })} />
      <p className="col-span-full -mt-2 text-xs text-muted-foreground md:col-span-2">{t.videoToolsHint}</p>
    </Panel>
  )
}

const SAMPLE_RATES=[null,48000,44100,22050]

export function AudioTools({ settings, set }:{ settings:Audio; set:(s:Audio)=>void }) {
  const { t }=useI18n()
  const active=!!settings.fadeIn||!!settings.fadeOut||settings.normalize||settings.mono||settings.sampleRate!==null
  return (
    <Panel title={t.audioTools} active={active}>
      <Range id="fade-in" label={t.fadeIn} value={settings.fadeIn} min={0} max={10} step={0.5} display={settings.fadeIn+" s"} onChange={(fadeIn)=>set({ ...settings, fadeIn })} />
      <Range id="fade-out" label={t.fadeOut} value={settings.fadeOut} min={0} max={10} step={0.5} display={settings.fadeOut+" s"} onChange={(fadeOut)=>set({ ...settings, fadeOut })} />
      <Segmented
        label={t.sampleRate}
        value={String(settings.sampleRate??"orig")}
        onChange={(v)=>set({ ...settings, sampleRate:v==="orig"?null:Number(v) })}
        options={SAMPLE_RATES.map((r)=>({ value:String(r??"orig"), label:r?r/1000+" kHz":t.original }))}
      />
      <Toggle label={t.normalize} checked={settings.normalize} onChange={(normalize)=>set({ ...settings, normalize })} />
      <Toggle label={t.mono} checked={settings.mono} onChange={(mono)=>set({ ...settings, mono })} />
      <p className="self-end text-xs text-muted-foreground">{t.audioToolsHint}</p>
    </Panel>
  )
}
