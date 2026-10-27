import { useState } from "react"
import { AdjustPanel, Presets } from "@/components/ImageExtras"
import { AudioTools, Toggle, VideoPresets, VideoTools } from "@/components/MediaExtras"
import { Segmented } from "@/components/ui/segmented"
import type { Encoders } from "@/hooks/useConverter"
import { useI18n } from "@/i18n/I18nProvider"
import { FORMAT_LABELS } from "@/lib/files"
import type { AllSettings, AudioFormat, MediaKind, OutputFormat, PdfOutput, StillFormat, Target, TargetMode, VideoCodecChoice, VideoFormat, VideoOutput, VideoQuality } from "@/lib/types"
import { cn } from "@/lib/utils"

const IMAGE_FORMATS:OutputFormat[]=["image/jpeg","image/webp","image/png","image/avif","image/gif","image/bmp","image/x-icon","application/pdf","video/mp4","video/webm"]
const STILL_FORMATS:StillFormat[]=["image/jpeg","image/png","image/webp"]
const VIDEO_FORMATS:VideoFormat[]=["mp4","webm","mov","mkv","ts"]
const VIDEO_LABELS:Record<VideoFormat,string>={ mp4:"MP4", webm:"WebM", mov:"MOV", mkv:"MKV", ts:"TS" }
const CODECS:VideoCodecChoice[]=["auto","avc","hevc","vp9","av1"]
const CODEC_LABELS:Record<VideoCodecChoice,string>={ auto:"Auto", avc:"H.264", hevc:"HEVC", vp9:"VP9", av1:"AV1" }
const AUDIO_FORMATS:AudioFormat[]=["mp3","m4a","aac","ogg","opus","flac","wav"]
const AUDIO_LABELS:Record<AudioFormat,string>={ mp3:"MP3", m4a:"M4A", aac:"AAC", ogg:"OGG", opus:"Opus", flac:"FLAC", wav:"WAV" }
const LOSSLESS_AUDIO:AudioFormat[]=["flac","wav"]
const RESOLUTIONS=[null,1080,720,480]
const BITRATES=[64,128,192,320]
const SIZE_PRESETS=[1920,1280]
const GIF_FPS=[8,12,15,24]
const GIF_WIDTHS=[320,480,640,960]
const PDF_SCALES=[1,2,3]

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

type Unit="KB"|"MB"

// Shared by all kinds: compress by the quality controls, to a fixed size, or by a percentage.
function TargetControl({ kind, target, set, note }:{ kind:MediaKind; target:Target; set:(t:Target)=>void; note?:string }) {
  const { t }=useI18n()
  const [unit,setUnit]=useState<Unit>(kind==="image"?"KB":"MB")
  const modes:TargetMode[]=["quality","size","percent"]
  const labels={ quality:t.targetQuality, size:t.targetSize, percent:t.targetPercent }
  const factor=unit==="MB"?1024:1
  const shown=Math.round(target.sizeKb/factor*100)/100
  const id="target-"+kind
  return (
    <div className="col-span-full grid items-start gap-x-5 gap-y-4 border-t border-border pt-4 md:grid-cols-[1.2fr_2fr]">
      <Segmented
        label={t.compressBy}
        value={target.mode}
        onChange={(mode)=>set({ ...target, mode })}
        options={modes.map((m)=>({ value:m, label:labels[m] }))}
      />
      {target.mode==="size"&&(
        <div className="min-w-0">
          <label htmlFor={id} className={caption}>{t.targetSizeLabel}</label>
          <div className="flex gap-2">
            <div className="flex h-11 min-w-0 flex-1 items-center rounded-[14px] border border-border bg-white/[0.05] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary">
              <input
                id={id}
                // Uncontrolled, so half-typed numbers like "1." survive; the key resets it when the unit changes.
                key={unit}
                inputMode="decimal"
                defaultValue={shown}
                onChange={(e)=>{
                  const value=Number(e.target.value.replace(",",".").replace(/[^\d.]/g,""))
                  if (Number.isFinite(value)&&value>0) set({ ...target, sizeKb:value*factor })
                }}
                className="h-full w-full min-w-0 bg-transparent pl-3.5 text-sm font-semibold tabular-nums outline-none"
              />
            </div>
            <div className="flex rounded-[14px] border border-border bg-white/[0.05] p-1">
              {(["KB","MB"] as Unit[]).map((u)=>(
                <button
                  key={u}
                  type="button"
                  aria-pressed={unit===u}
                  onClick={()=>setUnit(u)}
                  className={cn("h-9 cursor-pointer rounded-[10px] px-3 text-[13px] font-semibold transition-colors", unit===u?"bg-foreground text-background":"text-muted-foreground hover:text-foreground")}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">{note??(kind==="image"?t.targetHintImage:t.targetHintMedia)}</p>
        </div>
      )}
      {target.mode==="percent"&&(
        <div className="min-w-0">
          <div className="mb-0.5 flex items-baseline justify-between">
            <label htmlFor={id} className="text-xs font-semibold text-muted-foreground">{t.targetPercentLabel}</label>
            <output htmlFor={id} className="text-sm font-bold tabular-nums">{"−"+target.percent+"%"}</output>
          </div>
          <input
            id={id}
            type="range"
            min={10}
            max={90}
            step={5}
            value={target.percent}
            onChange={(e)=>set({ ...target, percent:Number(e.target.value) })}
            className="squish-range"
            style={{ ["--fill" as string]:((target.percent-10)/80)*100+"%" }}
          />
          <p className="text-xs text-muted-foreground">{note??(kind==="image"?t.targetHintImage:t.targetHintMedia)}</p>
        </div>
      )}
    </div>
  )
}

function unavailable<T extends string>(all:T[],support:Record<T,boolean>|undefined,labels:Record<T,string>) {
  return support?all.filter((f)=>!support[f]).map((f)=>labels[f]):[]
}

function Hint({ children }:{ children:string }) {
  return <p className="mt-1.5 text-xs text-muted-foreground">{children}</p>
}

function QualitySlider({ id, value, disabled, onChange, note }:{ id:string; value:number; disabled?:boolean; onChange:(v:number)=>void; note?:string }) {
  const { t }=useI18n()
  return (
    <div>
      <div className="mb-0.5 flex items-baseline justify-between">
        <label htmlFor={id} className="text-xs font-semibold text-muted-foreground">{t.quality}</label>
        <output htmlFor={id} className="text-sm font-bold tabular-nums">{disabled?"–":value}</output>
      </div>
      <input
        id={id}
        type="range"
        min={1}
        max={100}
        value={value}
        disabled={disabled}
        onChange={(e)=>onChange(Number(e.target.value))}
        className="squish-range"
        style={{ ["--fill" as string]:((value-1)/99)*100+"%" }}
      />
      {note&&<p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  )
}

function ImageSettings({ settings, set, encoders, avifNative }:{ settings:AllSettings["image"]; set:(s:AllSettings["image"])=>void; encoders?:Record<OutputFormat,boolean>; avifNative?:boolean }) {
  const { t }=useI18n()
  const f=settings.format
  const animated=f==="video/mp4"||f==="video/webm"
  const icon=f==="image/x-icon"
  const lossless=f==="image/png"||f==="image/bmp"
  const targeted=settings.target.mode!=="quality"
  const missing=unavailable(IMAGE_FORMATS,encoders,FORMAT_LABELS)
  // Presets cover the common case; "Custom" opens free width and height fields.
  const [custom,setCustom]=useState(false)
  const preset=settings.maxHeight===null&&(settings.maxWidth===null||SIZE_PRESETS.includes(settings.maxWidth))
  const size=custom||!preset?"custom":settings.maxWidth===null?"orig":String(settings.maxWidth)
  const formatNote=animated?t.animatedNote:icon?t.icoNote:f==="application/pdf"?t.pdfOutNote:missing.length?t.formatsUnavailable(missing.join(", ")):null
  const canOptimize=f==="image/jpeg"||f==="image/png"
  return (
    <>
      <Presets settings={settings} set={set} />
      <div>
        <Segmented
          label={t.convertTo}
          value={f}
          columns={5}
          onChange={(format)=>set({ ...settings, format })}
          options={IMAGE_FORMATS.map((o)=>({ value:o, label:FORMAT_LABELS[o], disabled:encoders?!encoders[o]:false, title:encoders&&!encoders[o]?t.notSupported:undefined }))}
        />
        {formatNote&&<Hint>{formatNote}</Hint>}
        {f==="image/avif"&&avifNative===false&&<Hint>{t.avifWasm}</Hint>}
      </div>
      <QualitySlider
        id="quality"
        value={settings.quality}
        disabled={lossless||targeted||animated||icon}
        onChange={(quality)=>set({ ...settings, quality })}
        note={f==="image/png"&&!targeted?t.qualityLossless:undefined}
      />
      {!animated&&!icon&&(
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
      )}
      {animated||icon
        ?<Note>{t.targetOff}</Note>
        :<TargetControl kind="image" target={settings.target} set={(target)=>set({ ...settings, target })} />}
      {canOptimize&&(
        <label className="col-span-full flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-border bg-white/[0.03] px-4 py-3">
          <span>
            <span className="block text-sm font-semibold">{t.optimized}</span>
            <span className="block text-xs text-muted-foreground">{t.optimizedHint}</span>
          </span>
          <input type="checkbox" checked={settings.optimized} onChange={(e)=>set({ ...settings, optimized:e.target.checked })} className="peer sr-only" />
          <span
            aria-hidden
            className={"relative h-8 w-14 flex-none rounded-full border border-border bg-white/8 transition-colors peer-checked:bg-primary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary after:absolute after:top-[3px] after:left-[3px] after:size-6 after:rounded-full after:bg-foreground after:transition-transform after:duration-200 "+(settings.optimized?"after:translate-x-6":"")}
          />
        </label>
      )}
      {!animated&&!icon&&<AdjustPanel settings={settings} set={set} />}
      {!animated&&<Note>{t.metadataNote}</Note>}
    </>
  )
}

// Which codecs each container can hold.
const CONTAINER_CODECS:Record<VideoFormat,VideoCodecChoice[]>={
  mp4:["avc","hevc","vp9","av1"],
  mov:["avc","hevc","vp9","av1"],
  webm:["vp9","av1"],
  mkv:["avc","hevc","vp9","av1"],
  ts:["avc","hevc"],
}

function VideoSettings({ settings, set, encoders, codecs, audio }:{
  settings:AllSettings["video"]
  set:(s:AllSettings["video"])=>void
  encoders?:Record<VideoFormat,boolean>
  codecs?:Record<VideoCodecChoice,boolean>
  audio?:Record<AudioFormat,boolean>
}) {
  const { t }=useI18n()
  const outputs:VideoOutput[]=["video","audio","gif","frame"]
  const outputLabels={ video:t.outputVideo, audio:t.outputAudio, gif:t.outputGif, frame:t.outputFrame }
  const turnInto=(
    <Segmented
      label={t.output}
      value={settings.output}
      columns={2}
      onChange={(output)=>set({ ...settings, output })}
      options={outputs.map((o)=>({ value:o, label:outputLabels[o] }))}
    />
  )

  if (settings.output==="audio") {
    const lossless=LOSSLESS_AUDIO.includes(settings.audioFormat)
    return (
      <>
        {turnInto}
        <div>
          <Segmented
            label={t.convertTo}
            value={settings.audioFormat}
            columns={4}
            onChange={(audioFormat)=>set({ ...settings, audioFormat })}
            options={AUDIO_FORMATS.map((a)=>({ value:a, label:AUDIO_LABELS[a], disabled:audio?!audio[a]:false }))}
          />
        </div>
        <div>
          <Segmented
            label={t.bitrate+" ("+t.kbps+")"}
            value={String(settings.audioBitrate)}
            onChange={(v)=>set({ ...settings, audioBitrate:Number(v) })}
            options={BITRATES.map((b)=>({ value:String(b), label:String(b), disabled:lossless||settings.target.mode!=="quality" }))}
          />
          {lossless&&<Hint>{t.losslessAudio}</Hint>}
        </div>
        <TargetControl kind="video" target={settings.target} set={(target)=>set({ ...settings, target })} note={lossless?t.targetWav:t.targetHintMedia} />
      </>
    )
  }

  if (settings.output==="gif") {
    return (
      <>
        {turnInto}
        <Segmented
          label={t.gifFps}
          value={String(settings.gifFps)}
          onChange={(v)=>set({ ...settings, gifFps:Number(v) })}
          options={GIF_FPS.map((n)=>({ value:String(n), label:String(n) }))}
        />
        <div>
          <Segmented
            label={t.gifWidth+" ("+t.px+")"}
            value={String(settings.gifWidth)}
            onChange={(v)=>set({ ...settings, gifWidth:Number(v) })}
            options={GIF_WIDTHS.map((n)=>({ value:String(n), label:String(n) }))}
          />
          <Hint>{t.gifNote}</Hint>
        </div>
      </>
    )
  }

  if (settings.output==="frame") {
    const positions=[{ value:"0", label:t.frameStart }, { value:"0.5", label:t.frameMiddle }, { value:"1", label:t.frameEnd }]
    return (
      <>
        {turnInto}
        <Segmented
          label={t.framePosition}
          value={String(settings.framePosition)}
          onChange={(v)=>set({ ...settings, framePosition:Number(v) })}
          options={positions}
        />
        <Segmented
          label={t.convertTo}
          value={settings.frameFormat}
          onChange={(frameFormat)=>set({ ...settings, frameFormat })}
          options={STILL_FORMATS.map((s)=>({ value:s, label:FORMAT_LABELS[s] }))}
        />
      </>
    )
  }

  const missing=unavailable(VIDEO_FORMATS,encoders,VIDEO_LABELS)
  const qualities:VideoQuality[]=["low","medium","high"]
  const allowed=CONTAINER_CODECS[settings.format]
  // A codec the new container cannot hold falls back to Auto.
  const setFormat=(format:VideoFormat)=>set({ ...settings, format, codec:settings.codec==="auto"||CONTAINER_CODECS[format].includes(settings.codec)?settings.codec:"auto" })
  return (
    <>
      <VideoPresets settings={settings} set={set} />
      {turnInto}
      <Segmented
        label={t.convertTo}
        value={settings.format}
        onChange={setFormat}
        options={VIDEO_FORMATS.map((v)=>({ value:v, label:VIDEO_LABELS[v], disabled:encoders?!encoders[v]:false }))}
      />
      <Segmented
        label={t.codec}
        value={settings.codec}
        onChange={(codec)=>set({ ...settings, codec })}
        options={CODECS.map((c)=>({ value:c, label:c==="auto"?t.codecAuto:CODEC_LABELS[c], disabled:c!=="auto"&&(!allowed.includes(c)||(codecs?!codecs[c]:false)) }))}
      />
      <Segmented
        label={t.quality}
        value={settings.quality}
        onChange={(quality)=>set({ ...settings, quality })}
        options={qualities.map((q)=>({ value:q, label:t.videoQuality[q], disabled:settings.target.mode!=="quality" }))}
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
      <TargetControl kind="video" target={settings.target} set={(target)=>set({ ...settings, target })} />
      <VideoTools settings={settings} set={set} />
    </>
  )
}

function AudioSettings({ settings, set, encoders }:{ settings:AllSettings["audio"]; set:(s:AllSettings["audio"])=>void; encoders?:Record<AudioFormat,boolean> }) {
  const { t }=useI18n()
  const missing=unavailable(AUDIO_FORMATS,encoders,AUDIO_LABELS)
  const lossless=LOSSLESS_AUDIO.includes(settings.format)
  return (
    <>
      <div>
        <Segmented
          label={t.convertTo}
          value={settings.format}
          columns={4}
          onChange={(format)=>set({ ...settings, format })}
          options={AUDIO_FORMATS.map((a)=>({ value:a, label:AUDIO_LABELS[a], disabled:encoders?!encoders[a]:false }))}
        />
        {missing.length>0&&<Hint>{t.formatsUnavailable(missing.join(", "))}</Hint>}
      </div>
      <div>
        <Segmented
          label={t.bitrate+" ("+t.kbps+")"}
          value={String(settings.bitrate)}
          onChange={(v)=>set({ ...settings, bitrate:Number(v) })}
          options={BITRATES.map((b)=>({ value:String(b), label:String(b), disabled:lossless||settings.target.mode!=="quality" }))}
        />
        {lossless&&<Hint>{t.losslessAudio}</Hint>}
      </div>
      <TargetControl kind="audio" target={settings.target} set={(target)=>set({ ...settings, target })} note={lossless?t.targetWav:undefined} />
      <AudioTools settings={settings} set={set} />
    </>
  )
}

function PdfSettings({ settings, set }:{ settings:AllSettings["pdf"]; set:(s:AllSettings["pdf"])=>void }) {
  const { t }=useI18n()
  const outputs:PdfOutput[]=["images","pdf","split","text"]
  const turnInto=(
    <Segmented
      label={t.output}
      value={settings.output}
      columns={2}
      onChange={(output)=>set({ ...settings, output })}
      options={outputs.map((o)=>({ value:o, label:t.pdfOutputs[o] }))}
    />
  )
  const scale=(
    <Segmented
      label={t.pdfScale}
      value={String(settings.scale)}
      onChange={(v)=>set({ ...settings, scale:Number(v) })}
      options={PDF_SCALES.map((n)=>({ value:String(n), label:n*72+" dpi" }))}
    />
  )

  if (settings.output==="pdf") {
    return (
      <>
        {turnInto}
        <Toggle label={t.pdfCompress} checked={settings.compress} onChange={(compress)=>set({ ...settings, compress })} />
        <Toggle label={t.pageNumbers} checked={settings.pageNumbers} onChange={(pageNumbers)=>set({ ...settings, pageNumbers })} />
        {settings.compress&&(
          <>
            <QualitySlider id="pdf-quality" value={settings.quality} onChange={(quality)=>set({ ...settings, quality })} />
            {scale}
          </>
        )}
        <Note>{settings.compress?t.pdfCompressNote:t.pdfEditNote}</Note>
      </>
    )
  }

  if (settings.output!=="images") {
    return (
      <>
        {turnInto}
        <Note>{settings.output==="split"?t.pdfSplitNote:t.pdfTextNote}</Note>
      </>
    )
  }

  return (
    <>
      {turnInto}
      <Segmented
        label={t.convertTo}
        value={settings.format}
        onChange={(format)=>set({ ...settings, format })}
        options={STILL_FORMATS.map((s)=>({ value:s, label:FORMAT_LABELS[s] }))}
      />
      <QualitySlider
        id="pdf-quality"
        value={settings.quality}
        disabled={settings.format==="image/png"}
        onChange={(quality)=>set({ ...settings, quality })}
        note={settings.format==="image/png"?t.qualityLossless:undefined}
      />
      {scale}
      <Note>{t.pdfNote}</Note>
    </>
  )
}

const COLUMNS:Record<MediaKind,string>={
  image:"md:grid-cols-[1.35fr_0.85fr_1.3fr]",
  video:"sm:grid-cols-2 lg:grid-cols-3",
  audio:"md:grid-cols-[1.2fr_1fr]",
  pdf:"md:grid-cols-3",
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
      {kind==="image"&&<ImageSettings settings={settings.image} set={(s)=>setSettings("image",s)} encoders={encoders.image} avifNative={encoders.avifNative} />}
      {kind==="video"&&<VideoSettings settings={settings.video} set={(s)=>setSettings("video",s)} encoders={encoders.video} codecs={encoders.codecs} audio={encoders.audio} />}
      {kind==="audio"&&<AudioSettings settings={settings.audio} set={(s)=>setSettings("audio",s)} encoders={encoders.audio} />}
      {kind==="pdf"&&<PdfSettings settings={settings.pdf} set={(s)=>setSettings("pdf",s)} />}
    </section>
  )
}
