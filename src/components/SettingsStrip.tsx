import { useState } from "react"
import { Segmented } from "@/components/ui/segmented"
import type { Encoders } from "@/hooks/useConverter"
import { useI18n } from "@/i18n/I18nProvider"
import { FORMAT_LABELS } from "@/lib/files"
import type { AllSettings, AudioFormat, MediaKind, OutputFormat, VideoFormat, VideoQuality } from "@/lib/types"
import { cn } from "@/lib/utils"

const IMAGE_FORMATS:OutputFormat[]=["image/jpeg","image/webp","image/png","image/avif"]
const VIDEO_FORMATS:VideoFormat[]=["mp4","webm"]
const VIDEO_LABELS:Record<VideoFormat,string>={ mp4:"MP4", webm:"WebM" }
const AUDIO_FORMATS:AudioFormat[]=["mp3","m4a","ogg","wav"]
const AUDIO_LABELS:Record<AudioFormat,string>={ mp3:"MP3", m4a:"M4A", ogg:"OGG", wav:"WAV" }
const RESOLUTIONS=[null,1080,720,480]
const BITRATES=[64,128,192,320]
const SIZE_PRESETS=[1920,1280]

const caption="mb-2 block text-xs font-semibold text-muted-foreground"

function Note({ children }:{ children:string }) {
  return <p className="col-span-full -mt-2 text-[13px] text-muted-foreground">{children}</p>
}

function SizeInput({ id, label, value, onChange }:{ id:string; label:string; value:number|null; onChange:(v:number|null)=>void }) {
  const { t }=useI18n()
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={caption}>{label}</label>
      <div className="flex h-11 items-center rounded-[14px] border border-border bg-white/[0.05] pr-3 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary">
        <input
          id={id}
          inputMode="numeric"
          placeholder={t.auto}
          value={value??""}
          onChange={(e)=>{
            const digits=e.target.value.replace(/\D/g,"").slice(0,5)
            onChange(digits?Number(digits):null)
          }}
          className="h-full w-full min-w-0 bg-transparent pl-3.5 text-sm font-semibold tabular-nums outline-none placeholder:font-medium placeholder:text-muted-foreground"
        />
        <span aria-hidden className="text-xs text-muted-foreground">{t.px}</span>
      </div>
    </div>
  )
}

function unavailable<T extends string>(all:T[],support:Record<T,boolean>|undefined,labels:Record<T,string>) {
  return support?all.filter((f)=>!support[f]).map((f)=>labels[f]):[]
}

function ImageSettings({ settings, set, encoders }:{ settings:AllSettings["image"]; set:(s:AllSettings["image"])=>void; encoders?:Record<OutputFormat,boolean> }) {
  const { t }=useI18n()
  const lossless=settings.format==="image/png"
  const missing=unavailable(IMAGE_FORMATS,encoders,FORMAT_LABELS)
  // Presets cover the common case; "Custom" opens free width and height fields.
  const [custom,setCustom]=useState(false)
  const preset=settings.maxHeight===null&&(settings.maxWidth===null||SIZE_PRESETS.includes(settings.maxWidth))
  const size=custom||!preset?"custom":settings.maxWidth===null?"orig":String(settings.maxWidth)
  return (
    <>
      <div>
        <Segmented
          label={t.convertTo}
          value={settings.format}
          onChange={(format)=>set({ ...settings, format })}
          options={IMAGE_FORMATS.map((f)=>({ value:f, label:FORMAT_LABELS[f], disabled:encoders?!encoders[f]:false, title:encoders&&!encoders[f]?t.notSupported:undefined }))}
        />
        {missing.length>0&&<p className="mt-1.5 text-xs text-muted-foreground">{t.formatsUnavailable(missing.join(", "))}</p>}
      </div>
      <div>
        <div className="mb-0.5 flex items-baseline justify-between">
          <label htmlFor="quality" className="text-xs font-semibold text-muted-foreground">{t.quality}</label>
          <output htmlFor="quality" className="text-sm font-bold tabular-nums">{lossless?"–":settings.quality}</output>
        </div>
        <input
          id="quality"
          type="range"
          min={1}
          max={100}
          value={settings.quality}
          disabled={lossless}
          onChange={(e)=>set({ ...settings, quality:Number(e.target.value) })}
          className="squish-range"
          style={{ ["--fill" as string]:((settings.quality-1)/99)*100+"%" }}
        />
        {lossless&&<p className="text-xs text-muted-foreground">{t.qualityLossless}</p>}
      </div>
      <div className="grid gap-3">
        <Segmented
          label={t.maxSize}
          value={size}
          onChange={(v)=>{
            setCustom(v==="custom")
            if (v!=="custom") set({ ...settings, maxWidth:v==="orig"?null:Number(v), maxHeight:null })
          }}
          options={[
            { value:"orig", label:t.original },
            ...SIZE_PRESETS.map((w)=>({ value:String(w), label:String(w) })),
            { value:"custom", label:t.custom },
          ]}
        />
        {size==="custom"&&(
          <div className="grid grid-cols-2 gap-3">
            <SizeInput id="max-w" label={t.maxWidth} value={settings.maxWidth} onChange={(maxWidth)=>set({ ...settings, maxWidth })} />
            <SizeInput id="max-h" label={t.maxHeight} value={settings.maxHeight} onChange={(maxHeight)=>set({ ...settings, maxHeight })} />
          </div>
        )}
      </div>
    </>
  )
}

function VideoSettings({ settings, set, encoders }:{ settings:AllSettings["video"]; set:(s:AllSettings["video"])=>void; encoders?:Record<VideoFormat,boolean> }) {
  const { t }=useI18n()
  const missing=unavailable(VIDEO_FORMATS,encoders,VIDEO_LABELS)
  const qualities:VideoQuality[]=["low","medium","high"]
  return (
    <>
      <Segmented
        label={t.convertTo}
        value={settings.format}
        onChange={(format)=>set({ ...settings, format })}
        options={VIDEO_FORMATS.map((f)=>({ value:f, label:VIDEO_LABELS[f], disabled:encoders?!encoders[f]:false }))}
      />
      <Segmented
        label={t.quality}
        value={settings.quality}
        onChange={(quality)=>set({ ...settings, quality })}
        options={qualities.map((q)=>({ value:q, label:t.videoQuality[q] }))}
      />
      <Segmented
        label={t.resolution}
        value={String(settings.maxHeight??"original")}
        onChange={(v)=>set({ ...settings, maxHeight:v==="original"?null:Number(v) })}
        options={RESOLUTIONS.map((r)=>({ value:String(r??"original"), label:r?r+"p":t.original }))}
      />
      <label className="flex cursor-pointer items-center justify-between gap-3 lg:flex-col lg:items-start lg:gap-2">
        <span className="text-xs font-semibold text-muted-foreground">{t.removeAudio}</span>
        <input type="checkbox" checked={settings.removeAudio} onChange={(e)=>set({ ...settings, removeAudio:e.target.checked })} className="peer sr-only" />
        <span
          aria-hidden
          className={cn(
            "relative h-8 w-14 flex-none rounded-full lg:mt-[7px] border border-border bg-white/8 transition-colors peer-checked:bg-primary",
            "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary",
            "after:absolute after:top-[3px] after:left-[3px] after:size-6 after:rounded-full after:bg-foreground after:shadow-[0_2px_6px_rgb(0_0_0/0.4)] after:transition-transform after:duration-200",
            settings.removeAudio&&"after:translate-x-6",
          )}
        />
      </label>
      {missing.length>0&&<Note>{t.formatsUnavailable(missing.join(", "))}</Note>}
      <Note>{t.mediaNote}</Note>
    </>
  )
}

function AudioSettings({ settings, set, encoders }:{ settings:AllSettings["audio"]; set:(s:AllSettings["audio"])=>void; encoders?:Record<AudioFormat,boolean> }) {
  const { t }=useI18n()
  const missing=unavailable(AUDIO_FORMATS,encoders,AUDIO_LABELS)
  const wav=settings.format==="wav"
  return (
    <>
      <Segmented
        label={t.convertTo}
        value={settings.format}
        onChange={(format)=>set({ ...settings, format })}
        options={AUDIO_FORMATS.map((f)=>({ value:f, label:AUDIO_LABELS[f], disabled:encoders?!encoders[f]:false }))}
      />
      <Segmented
        label={t.bitrate+" ("+t.kbps+")"}
        value={String(settings.bitrate)}
        onChange={(v)=>set({ ...settings, bitrate:Number(v) })}
        options={BITRATES.map((b)=>({ value:String(b), label:String(b), disabled:wav }))}
      />
      {missing.length>0&&<Note>{t.formatsUnavailable(missing.join(", "))}</Note>}
      {wav&&<Note>{t.wavNote}</Note>}
    </>
  )
}

const COLUMNS:Record<MediaKind,string>={
  image:"md:grid-cols-[1.2fr_1fr_1fr]",
  video:"sm:grid-cols-2 lg:grid-cols-[0.8fr_1.2fr_1.5fr_auto]",
  audio:"md:grid-cols-[1.2fr_1fr]",
}

// One horizontal glass strip holding the settings of the active kind.
export function SettingsStrip({ kind, settings, setSettings, encoders }:{
  kind:MediaKind
  settings:AllSettings
  setSettings:<K extends MediaKind>(kind:K,next:AllSettings[K])=>void
  encoders:Partial<Encoders>
}) {
  const { t }=useI18n()
  return (
    <section aria-label={t.settingsLabel} className={cn("glass grid items-start gap-x-5 gap-y-5 px-5 py-[18px] sm:px-[22px]",COLUMNS[kind])}>
      {kind==="image"&&<ImageSettings settings={settings.image} set={(s)=>setSettings("image",s)} encoders={encoders.image} />}
      {kind==="video"&&<VideoSettings settings={settings.video} set={(s)=>setSettings("video",s)} encoders={encoders.video} />}
      {kind==="audio"&&<AudioSettings settings={settings.audio} set={(s)=>setSettings("audio",s)} encoders={encoders.audio} />}
    </section>
  )
}
