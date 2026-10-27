import { useEffect, useState } from "react"
import { Sheet } from "@/components/Sheet"
import { QualitySlider } from "@/components/SettingsStrip"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { useI18n } from "@/i18n/I18nProvider"
import { FORMAT_LABELS } from "@/lib/files"
import type { ImageOverride, Item, OutputFormat, Settings } from "@/lib/types"

const FORMATS:OutputFormat[]=["image/jpeg","image/webp","image/png","image/avif","image/gif","image/bmp","application/pdf"]
const WIDTHS=[null,3840,1920,1280,800]

// Format, quality and size for one image, on top of the shared settings above the list.
export function FileSettingsDialog({ item, shared, encoders, onClose, onApply }:{
  item:Item|null
  shared:Settings
  encoders?:Record<OutputFormat,boolean>
  onClose:()=>void
  onApply:(override:ImageOverride|undefined)=>void
}) {
  const { t }=useI18n()
  const [own,setOwn]=useState<Required<ImageOverride>>({ format:"image/webp", quality:80, maxWidth:null })

  useEffect(()=>{
    if (!item) return
    const start=FORMATS.includes(shared.format)?shared:{ ...shared, format:"image/webp" as const }
    setOwn({ format:start.format, quality:start.quality, maxWidth:start.maxWidth, ...item.override })
  },[item,shared])

  const lossless=own.format==="image/png"||own.format==="image/bmp"
  return (
    <Sheet open={!!item} onClose={onClose} title={t.fileSettingsTitle}>
      {item&&(
        <>
          <p className="-mt-2 text-sm text-muted-foreground">{t.fileSettingsHint(item.file.name)}</p>
          <Segmented
            label={t.convertTo}
            value={own.format}
            columns={4}
            onChange={(format)=>setOwn({ ...own, format })}
            options={FORMATS.map((f)=>({ value:f, label:FORMAT_LABELS[f], disabled:encoders?!encoders[f]:false }))}
          />
          <QualitySlider id="own-quality" value={own.quality} disabled={lossless} onChange={(quality)=>setOwn({ ...own, quality })} note={lossless?t.qualityLossless:undefined} />
          <Segmented
            label={t.maxWidth}
            value={String(own.maxWidth??"orig")}
            onChange={(v)=>setOwn({ ...own, maxWidth:v==="orig"?null:Number(v) })}
            options={WIDTHS.map((w)=>({ value:String(w??"orig"), label:w?String(w):t.original }))}
          />
          <div className="flex flex-wrap justify-end gap-2">
            <Button size="sm" className="h-11" disabled={!item.override} onClick={()=>{
              onApply(undefined)
              onClose()
            }}>{t.useShared}</Button>
            <Button size="sm" className="h-11" onClick={onClose}>{t.cancel}</Button>
            <Button variant="primary" onClick={()=>{
              onApply(own)
              onClose()
            }}>{t.apply}</Button>
          </div>
        </>
      )}
    </Sheet>
  )
}
