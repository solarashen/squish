import { useState } from "react"
import { Download, Share2, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCountUp } from "@/hooks/useCountUp"
import { useI18n } from "@/i18n/I18nProvider"
import { DEFAULT_PATTERN, downloadBlob, downloadZip, formatChange, patternName } from "@/lib/files"
import type { Item, MediaKind } from "@/lib/types"

// The result of the active tab, pinned to the bottom of the window: saving, sizes and the download.
export function Dock({ kind, items, onClear, pattern=DEFAULT_PATTERN }:{ kind:MediaKind; items:Item[]; onClear:()=>void; pattern?:string }) {
  const { t, formatBytes }=useI18n()
  const [zipping,setZipping]=useState(false)

  const done=items.filter((it)=>it.status==="done"&&it.result)
  // Images saved as PDF download as one joined document instead of a ZIP of one-page PDFs.
  const asOnePdf=kind==="image"&&done.length>0&&done.every((it)=>it.result!.ext==="pdf")
  const download=async ()=>{
    if (!asOnePdf) return downloadZip(done,t.zipName[kind],pattern)
    const { mergePdfs }=await import("@/lib/writers")
    downloadBlob(await mergePdfs(done.map((it)=>it.result!.blob)),"squish.pdf")
  }
  const before=done.reduce((sum,it)=>sum+it.file.size,0)
  const after=done.reduce((sum,it)=>sum+it.result!.blob.size,0)
  const saving=before?(1-after/before)*100:0
  const shown=useCountUp(saving)
  // Phones can hand the results straight to another app (messages, mail, cloud) through the share sheet.
  const files=done.map((it,i)=>new File([it.result!.blob],patternName(pattern,it,i,done.length),{ type:it.result!.blob.type }))
  const canShare=files.length>0&&typeof navigator.canShare==="function"&&navigator.canShare({ files })
  const share=()=>navigator.share({ files }).catch(()=>{})
  const busy=items.some((it)=>it.status==="queued"||it.status==="working")
  const figure=done.length?formatChange(shown):"0%"
  // The sign gets the accent colour, the number stays light.
  const sign=/^[−+]/.test(figure)?figure[0]:""

  return (
    <div className="glass fixed inset-x-0 bottom-0 z-20 rounded-none border-x-0 border-b-0 pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-[940px] items-center gap-3 px-4 py-3 sm:gap-6 sm:px-6 sm:py-4">
        <p aria-live="polite" className="flex min-w-0 items-center gap-3 sm:gap-6">
          <span className={"font-display text-[34px] leading-none font-extrabold tracking-[-0.06em] tabular-nums sm:text-[60px] "+(done.length?"":"text-muted-foreground")}>
            {sign&&<span className={sign==="+"?"text-warn":"text-primary"}>{sign}</span>}
            {figure.slice(sign.length)}
          </span>
          <span className="min-w-0 text-[13px] leading-snug sm:text-[15px]">
            {done.length
              ?<span className="block whitespace-nowrap tabular-nums">{formatBytes(before)+" → "+formatBytes(after)}</span>
              :<span className="block">{t.batchEmpty}</span>}
            <span className="block truncate text-muted-foreground">{t.ready(done.length,items.length)}</span>
          </span>
        </p>
        <div className="ml-auto flex flex-none items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onClear} aria-label={t.clear} title={t.clear} className="size-10 sm:size-11">
            <Trash2 aria-hidden className="size-4" strokeWidth={2.2} />
          </Button>
          {canShare&&(
            <Button variant="ghost" size="icon" onClick={share} aria-label={t.share} title={t.share} className="size-10 sm:size-11">
              <Share2 aria-hidden className="size-4" strokeWidth={2.2} />
            </Button>
          )}
          <Button
            id="download-all"
            aria-keyshortcuts="D"
            variant="light"
            className="h-11 px-4 sm:h-13 sm:px-8"
            disabled={!done.length||busy||zipping}
            onClick={async ()=>{
              setZipping(true)
              try {
                await download()
              } finally {
                setZipping(false)
              }
            }}
          >
            <Download aria-hidden className="size-[18px]" strokeWidth={2.4} />
            <span className="hidden sm:inline">{asOnePdf?t.downloadPdf:t.downloadAll}</span>
            <span className="sm:hidden">{asOnePdf?"PDF":"ZIP"}</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
