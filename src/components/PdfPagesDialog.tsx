import { useEffect, useState } from "react"
import { ArrowLeft, ArrowRight, RotateCw, Trash2, Undo2 } from "lucide-react"
import { Sheet } from "@/components/Sheet"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/i18n/I18nProvider"
import type { Item, PdfEdit } from "@/lib/types"

type Page=PdfEdit["pages"][number]

const THUMB=180

// Pick which pages stay, in what order and which way up. Nothing is written until Apply.
export function PdfPagesDialog({ item, onClose, onApply }:{ item:Item|null; onClose:()=>void; onApply:(edit:PdfEdit|undefined)=>void }) {
  const { t }=useI18n()
  const [thumbs,setThumbs]=useState<string[]>([])
  const [count,setCount]=useState(0)
  const [pages,setPages]=useState<Page[]>([])
  const [failed,setFailed]=useState(false)

  useEffect(()=>{
    if (!item) return
    setThumbs([])
    setCount(0)
    setFailed(false)
    const controller=new AbortController()
    import("@/lib/pdftools").then(async ({ thumbnails })=>{
      let first=true
      await thumbnails(item.file,THUMB,(index,url,total)=>{
        if (first) {
          first=false
          setCount(total)
          setPages(item.pdfEdit?.pages??Array.from({ length:total },(_,i)=>({ index:i, rotate:0 as const })))
        }
        setThumbs((list)=>{
          const next=[...list]
          next[index]=url
          return next
        })
      },controller.signal)
    }).catch(()=>setFailed(true))
    return ()=>controller.abort()
  },[item])

  const kept=new Set(pages.map((p)=>p.index))
  const removed=Array.from({ length:count },(_,i)=>i).filter((i)=>!kept.has(i))

  // Handlers find the page by its original number, so quick clicks never act on a stale position.
  const move=(index:number,by:number)=>setPages((list)=>{
    const at=list.findIndex((p)=>p.index===index)
    const to=at+by
    if (at<0||to<0||to>=list.length) return list
    const next=[...list]
    ;[next[at],next[to]]=[next[to],next[at]]
    return next
  })
  const turn=(index:number)=>setPages((list)=>list.map((p)=>p.index===index?{ ...p, rotate:((p.rotate+90)%360) as Page["rotate"] }:p))
  const drop=(index:number)=>setPages((list)=>list.length>1?list.filter((p)=>p.index!==index):list)
  // A page brought back goes after the nearest earlier page that is still kept, so a custom order survives.
  const restore=(index:number)=>setPages((list)=>{
    let at=0
    list.forEach((p,i)=>{
      if (p.index<index) at=i+1
    })
    return [...list.slice(0,at),{ index, rotate:0 },...list.slice(at)]
  })
  const rotateAll=()=>setPages((list)=>list.map((p)=>({ ...p, rotate:((p.rotate+90)%360) as Page["rotate"] })))

  const untouched=pages.length===count&&pages.every((p,i)=>p.index===i&&p.rotate===0)
  const small="grid size-9 cursor-pointer place-items-center rounded-full border border-border bg-secondary transition-colors hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-35"

  return (
    <Sheet open={!!item} onClose={onClose} title={t.pagesTitle} wide>
      {item&&(
        <>
          {failed&&<p className="text-sm text-warn">{t.pagesFailed}</p>}
          {!failed&&!count&&<p className="text-sm text-muted-foreground">{t.pagesLoading}</p>}
          {count>0&&(
            <>
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm text-muted-foreground tabular-nums">{t.pagesKept(pages.length,count)}</p>
                <Button size="sm" className="h-10" onClick={rotateAll}><RotateCw aria-hidden className="size-4" />{t.rotateAll}</Button>
              </div>
              <ol className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-4">
                {pages.map((page,at)=>(
                  <li key={page.index} className="grid min-w-0 gap-2 rounded-2xl border border-border bg-white/[0.03] p-2.5">
                    <div className="relative grid aspect-[3/4] place-items-center overflow-hidden rounded-lg bg-black/30">
                      {thumbs[page.index]
                        ?<img src={thumbs[page.index]} alt={t.pageN(page.index+1)} className="absolute inset-0 m-auto max-h-[92%] max-w-[92%] rounded-sm shadow transition-transform duration-200" style={{ transform:"rotate("+page.rotate+"deg)", scale:page.rotate%180?"0.75":"1" }} />
                        :<span className="text-xs text-muted-foreground">{page.index+1}</span>}
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="pl-1 text-xs font-bold tabular-nums">{at+1}<span className="font-medium text-muted-foreground">{at+1!==page.index+1?" ("+(page.index+1)+")":""}</span></span>
                      <div className="flex gap-1">
                        <button type="button" className={small} aria-label={t.moveEarlier(page.index+1)} title={t.moveEarlier(page.index+1)} disabled={at===0} onClick={()=>move(page.index,-1)}><ArrowLeft aria-hidden className="size-4" /></button>
                        <button type="button" className={small} aria-label={t.moveLater(page.index+1)} title={t.moveLater(page.index+1)} disabled={at===pages.length-1} onClick={()=>move(page.index,1)}><ArrowRight aria-hidden className="size-4" /></button>
                        <button type="button" className={small} aria-label={t.rotatePage(page.index+1)} title={t.rotatePage(page.index+1)} onClick={()=>turn(page.index)}><RotateCw aria-hidden className="size-4" /></button>
                        <button type="button" className={small} aria-label={t.deletePage(page.index+1)} title={t.deletePage(page.index+1)} disabled={pages.length===1} onClick={()=>drop(page.index)}><Trash2 aria-hidden className="size-4" /></button>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
              {removed.length>0&&(
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-muted-foreground">{t.removedPages}</span>
                  {removed.map((i)=>(
                    <button key={i} type="button" onClick={()=>restore(i)} className="flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-border bg-secondary px-3 text-[13px] font-semibold hover:bg-white/12" aria-label={t.restorePage(i+1)}>
                      <Undo2 aria-hidden className="size-3.5" />{i+1}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button size="sm" className="h-11" disabled={!count} onClick={()=>setPages(Array.from({ length:count },(_,i)=>({ index:i, rotate:0 })))}>{t.resetEdit}</Button>
            <Button size="sm" className="h-11" onClick={onClose}>{t.cancel}</Button>
            <Button variant="primary" disabled={!count} onClick={()=>{
              onApply(untouched?undefined:{ pages })
              onClose()
            }}>{t.apply}</Button>
          </div>
        </>
      )}
    </Sheet>
  )
}
