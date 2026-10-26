import { useEffect, useState } from "react"
import { Sheet } from "@/components/Sheet"
import { useI18n } from "@/i18n/I18nProvider"
import { copyText } from "@/lib/clipboard"
import { palette, type Swatch } from "@/lib/imagetools"
import type { Item } from "@/lib/types"

export function PaletteDialog({ item, onClose, onCopied }:{ item:Item|null; onClose:()=>void; onCopied:(text:string)=>void }) {
  const { t }=useI18n()
  const [swatches,setSwatches]=useState<Swatch[]|null>(null)

  useEffect(()=>{
    if (!item) return
    setSwatches(null)
    let alive=true
    // The preview is already a decodable image, even for HEIC and SVG sources.
    fetch(item.previewUrl)
      .then((r)=>r.blob())
      .then((b)=>palette(b))
      .then((s)=>{
        if (alive) setSwatches(s)
      })
      .catch(()=>{
        if (alive) setSwatches([])
      })
    return ()=>{
      alive=false
    }
  },[item])

  return (
    <Sheet open={!!item} onClose={onClose} title={t.paletteTitle}>
      {item&&(
        <>
          <p className="-mt-3 text-sm text-muted-foreground">{t.paletteHint}</p>
          {!swatches&&<div className="working-bar h-1.5 rounded-full" />}
          {swatches&&(
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {swatches.map((s)=>(
                <li key={s.hex}>
                  <button
                    type="button"
                    onClick={()=>copyText(s.hex).then(()=>onCopied(s.hex))}
                    className="group grid w-full cursor-pointer overflow-hidden rounded-2xl border border-border text-left transition-transform active:scale-[0.98]"
                  >
                    <span className="block h-20" style={{ background:s.hex }} />
                    <span className="flex items-baseline justify-between bg-white/[0.04] px-3 py-2">
                      <span className="font-bold uppercase tabular-nums">{s.hex}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">{Math.round(s.share*100)+"%"}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Sheet>
  )
}
