import { useEffect, useState } from "react"
import { Sheet } from "@/components/Sheet"
import { Segmented } from "@/components/ui/segmented"
import { useI18n } from "@/i18n/I18nProvider"
import type { Item } from "@/lib/types"

const ZOOMS=["1","2","4"]

// The original and the result stacked on top of each other; a slider wipes between them, and zoom
// shows whether fine detail survived the compression.
export function CompareDialog({ item, onClose }:{ item:Item|null; onClose:()=>void }) {
  const { t, formatBytes }=useI18n()
  const [split,setSplit]=useState(50)
  const [zoom,setZoom]=useState("1")
  const [after,setAfter]=useState<string|null>(null)

  useEffect(()=>{
    if (!item?.result) return
    const url=URL.createObjectURL(item.result.blob)
    setAfter(url)
    setSplit(50)
    setZoom("1")
    return ()=>URL.revokeObjectURL(url)
  },[item])

  const r=item?.result
  return (
    <Sheet open={!!item} onClose={onClose} title={t.compareTitle} wide>
      {item&&r&&after&&(
        <>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <p className="text-sm text-muted-foreground tabular-nums">
              <span className="font-semibold text-foreground">{t.before}</span> {formatBytes(item.file.size)}
              <span aria-hidden> · </span>
              <span className="font-semibold text-primary">{t.after}</span> {formatBytes(r.blob.size)} ({r.label})
            </p>
            <div className="w-48">
              <Segmented label={t.zoom} value={zoom} onChange={setZoom} options={ZOOMS.map((z)=>({ value:z, label:z+"×" }))} />
            </div>
          </div>
          <div className="max-h-[62dvh] overflow-auto rounded-2xl border border-border bg-[repeating-conic-gradient(#1b2230_0%_25%,#141a24_0%_50%)] bg-[length:20px_20px]">
            <div className="relative select-none" style={{ width:Number(zoom)*100+"%" }}>
              <img src={item.previewUrl} alt={t.before} className="block w-full" draggable={false} />
              <img
                src={after}
                alt={t.after}
                draggable={false}
                className="absolute inset-0 block h-full w-full"
                style={{ clipPath:"inset(0 0 0 "+split+"%)" }}
              />
              <div aria-hidden className="pointer-events-none absolute inset-y-0 w-0.5 bg-foreground shadow-[0_0_0_1px_rgb(0_0_0/0.4)]" style={{ left:split+"%" }} />
              <span aria-hidden className="pointer-events-none absolute top-3 left-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-bold">{t.before}</span>
              <span aria-hidden className="pointer-events-none absolute top-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-bold text-primary">{t.after}</span>
            </div>
          </div>
          <div>
            <input
              type="range"
              min={0}
              max={100}
              value={split}
              aria-label={t.compareHint}
              onChange={(e)=>setSplit(Number(e.target.value))}
              className="squish-range"
              style={{ ["--fill" as string]:split+"%" }}
            />
            <p className="text-xs text-muted-foreground">{t.compareHint}</p>
          </div>
        </>
      )}
    </Sheet>
  )
}
