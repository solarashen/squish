import { useEffect, useRef, useState } from "react"
import { ArrowDown, ArrowUp, FileText } from "lucide-react"
import { Sheet } from "@/components/Sheet"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/i18n/I18nProvider"
import { downloadBlob } from "@/lib/files"
import type { Item } from "@/lib/types"

// Joins the PDFs on the list into one document, in an order picked here.
export function MergeDialog({ items, open, onClose }:{ items:Item[]; open:boolean; onClose:()=>void }) {
  const { t, formatBytes }=useI18n()
  const [order,setOrder]=useState<Item[]>([])
  const [busy,setBusy]=useState(false)
  const [failed,setFailed]=useState(false)

  // The order is taken once, when the window opens; later changes to the list would undo the sorting.
  const latest=useRef(items)
  latest.current=items
  useEffect(()=>{
    if (!open) return
    setOrder(latest.current)
    setFailed(false)
  },[open])

  const move=(id:string,by:number)=>setOrder((list)=>{
    const at=list.findIndex((it)=>it.id===id)
    if (at<0||at+by<0||at+by>=list.length) return list
    const next=[...list]
    ;[next[at],next[at+by]]=[next[at+by],next[at]]
    return next
  })

  const merge=async ()=>{
    setBusy(true)
    setFailed(false)
    try {
      const { mergePdfs }=await import("@/lib/writers")
      const { applyPdfEdit }=await import("@/lib/pdftools")
      // A finished PDF result (compressed, numbered) is used as it is; otherwise the edited original.
      const parts=await Promise.all(order.map((it)=>it.result?.ext==="pdf"?it.result.blob:applyPdfEdit(it.file,it.pdfEdit)))
      downloadBlob(await mergePdfs(parts),"squish-merged.pdf")
      onClose()
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  const arrow="grid size-10 cursor-pointer place-items-center rounded-full border border-border bg-secondary transition-colors hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-35"
  return (
    <Sheet open={open} onClose={onClose} title={t.mergeTitle}>
      <p className="-mt-2 text-sm text-muted-foreground">{t.mergeHint}</p>
      <ol className="grid gap-2">
        {order.map((it,at)=>(
          <li key={it.id} className="flex items-center gap-3 rounded-2xl border border-border bg-white/[0.03] p-2.5 pl-3">
            <span className="w-5 text-center text-sm font-bold tabular-nums text-muted-foreground">{at+1}</span>
            <FileText aria-hidden className="size-5 flex-none text-primary" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{it.file.name}</span>
              <span className="block text-xs text-muted-foreground">{formatBytes(it.file.size)+(it.pdfEdit?" · "+t.edited:"")}</span>
            </span>
            <button type="button" className={arrow} disabled={at===0} aria-label={t.moveUp(it.file.name)} onClick={()=>move(it.id,-1)}><ArrowUp aria-hidden className="size-4" /></button>
            <button type="button" className={arrow} disabled={at===order.length-1} aria-label={t.moveDown(it.file.name)} onClick={()=>move(it.id,1)}><ArrowDown aria-hidden className="size-4" /></button>
          </li>
        ))}
      </ol>
      {failed&&<p className="text-sm text-warn">{t.mergeFailed}</p>}
      <div className="flex justify-end gap-2">
        <Button size="sm" className="h-11" onClick={onClose}>{t.cancel}</Button>
        <Button variant="primary" disabled={busy||order.length<2} onClick={merge}>{busy?t.merging:t.mergeDownload}</Button>
      </div>
    </Sheet>
  )
}
