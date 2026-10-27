import { useEffect, useMemo, useState } from "react"
import { Download } from "lucide-react"
import { Sheet } from "@/components/Sheet"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/i18n/I18nProvider"
import { downloadBlob } from "@/lib/files"
import { measure } from "@/lib/metrics"
import { encode } from "@/lib/pool"
import type { CanvasFormat, Item, Settings } from "@/lib/types"

// One picture saved in every format at several qualities, measured for size and for how close it
// stays to the original. Plotted as size against SSIM: the curve that sits higher and further left
// gives better pictures for fewer bytes.

type Row={ format:CanvasFormat; quality:number; bytes:number; ssim:number; psnr:number; ms:number }

const SERIES:{ format:CanvasFormat; label:string; color:string; shape:"circle"|"square"|"triangle"|"diamond" }[]=[
  { format:"image/jpeg", label:"JPEG", color:"#3987e5", shape:"circle" },
  { format:"image/webp", label:"WebP", color:"#d95926", shape:"square" },
  { format:"image/avif", label:"AVIF", color:"#199e70", shape:"triangle" },
  { format:"image/png", label:"PNG", color:"#c98500", shape:"diamond" },
]
const QUALITIES=[30,50,70,85,95]
// Larger pictures are scaled down first so the sixteen encodes finish in reasonable time.
const MAX_SIDE=1600
const GOOD_SSIM=0.95

const W=640
const H=320
const PAD={ left:56, right:64, top:16, bottom:44 }

function Marker({ shape, x, y, color }:{ shape:string; x:number; y:number; color:string }) {
  const ring={ stroke:"#141a24", strokeWidth:2 }
  if (shape==="square") return <rect x={x-4.5} y={y-4.5} width={9} height={9} rx={1.5} fill={color} {...ring} />
  if (shape==="triangle") return <path d={"M"+x+" "+(y-5.5)+"L"+(x+5.5)+" "+(y+4.5)+"L"+(x-5.5)+" "+(y+4.5)+"Z"} fill={color} {...ring} />
  if (shape==="diamond") return <path d={"M"+x+" "+(y-6)+"L"+(x+6)+" "+y+"L"+x+" "+(y+6)+"L"+(x-6)+" "+y+"Z"} fill={color} {...ring} />
  return <circle cx={x} cy={y} r={5} fill={color} {...ring} />
}

// Round sizes for the log axis, in KB: 1, 2, 5, 10… below a megabyte, then 1, 2, 5… MB.
function ticks(lo:number,hi:number) {
  const out:{ kb:number; label:string }[]=[]
  for (let p=0;p<=6;p++) {
    for (const m of [1,2,5]) {
      const n=m*10**p
      if (n<1000&&n>=lo&&n<=hi) out.push({ kb:n, label:n+" KB" })
      if (n*1024>=lo&&n*1024<=hi) out.push({ kb:n*1024, label:n+" MB" })
    }
  }
  return out
}

// End-of-line labels pushed apart vertically so they never sit on top of each other.
function spread(labels:{ key:string; x:number; y:number; text:string }[],gap:number) {
  const sorted=[...labels].sort((a,b)=>a.y-b.y)
  for (let i=1;i<sorted.length;i++) {
    if (Math.abs(sorted[i].x-sorted[i-1].x)<60&&sorted[i].y-sorted[i-1].y<gap) sorted[i]={ ...sorted[i], y:sorted[i-1].y+gap }
  }
  return sorted
}

export function FormatsDialog({ item, settings, onClose }:{ item:Item|null; settings:Settings; onClose:()=>void }) {
  const { t, formatBytes }=useI18n()
  const [rows,setRows]=useState<Row[]>([])
  const [total,setTotal]=useState(0)
  const [hover,setHover]=useState<Row|null>(null)
  const [failed,setFailed]=useState(false)

  useEffect(()=>{
    if (!item) return
    setRows([])
    setHover(null)
    setFailed(false)
    let alive=true
    const jobs=SERIES.flatMap((s)=>s.format==="image/png"?[{ format:s.format, quality:100 }]:QUALITIES.map((quality)=>({ format:s.format, quality })))
    setTotal(jobs.length)
    ;(async ()=>{
      const original=await (await fetch(item.previewUrl)).blob()
      const probe=await createImageBitmap(original)
      const long=Math.max(probe.width,probe.height)
      probe.close()
      const limit=(v:number|null)=>long>MAX_SIDE?Math.min(v??MAX_SIDE,MAX_SIDE):v
      // Effects would count as differences from the original, so the comparison leaves them out.
      const base:Settings={
        ...settings,
        maxWidth:limit(settings.maxWidth),
        maxHeight:limit(settings.maxHeight),
        target:{ ...settings.target, mode:"quality" },
        adjust:{ brightness:0, contrast:0, saturation:0, grayscale:false, sharpen:0 },
        watermark:{ ...settings.watermark, text:"", logo:null },
      }
      // One at a time, so each encoding time is measured on its own.
      for (const job of jobs) {
        if (!alive) return
        const started=performance.now()
        const result=await encode(original,{ ...base, format:job.format, quality:job.quality },item.file.size,item.edit)
        const ms=performance.now()-started
        const q=await measure(original,result.blob,item.edit)
        if (alive) setRows((list)=>[...list,{ ...job, bytes:result.blob.size, ssim:q.ssim, psnr:q.psnr, ms }])
      }
    })().catch(()=>alive&&setFailed(true))
    return ()=>{
      alive=false
    }
  },[item,settings])

  const sorted=useMemo(()=>[...rows].sort((a,b)=>SERIES.findIndex((s)=>s.format===a.format)-SERIES.findIndex((s)=>s.format===b.format)||a.quality-b.quality),[rows])
  const best=useMemo(()=>rows.filter((r)=>r.ssim>=GOOD_SSIM).sort((a,b)=>a.bytes-b.bytes)[0],[rows])

  // Size on a log scale: PNG is often ten times larger than the rest.
  const lo=Math.max(1,Math.min(...rows.map((r)=>r.bytes))/1024*0.8)
  const hi=Math.max(lo*2,Math.max(...rows.map((r)=>r.bytes))/1024*1.25)
  const yLo=Math.max(0,Math.floor((Math.min(1,...rows.map((r)=>r.ssim))-0.01)*50)/50)
  const x=(bytes:number)=>PAD.left+(Math.log(bytes/1024)-Math.log(lo))/(Math.log(hi)-Math.log(lo))*(W-PAD.left-PAD.right)
  const y=(ssim:number)=>PAD.top+(1-(ssim-yLo)/(1-yLo))*(H-PAD.top-PAD.bottom)
  const yTicks=Array.from({ length:5 },(_,i)=>yLo+(1-yLo)*i/4)

  const label=(f:CanvasFormat)=>SERIES.find((s)=>s.format===f)!.label
  const psnrText=(v:number)=>Number.isFinite(v)?v.toFixed(1)+" dB":"∞"
  const csv=()=>{
    const lines=["format,quality,bytes,ssim,psnr_db,ms",...sorted.map((r)=>[label(r.format),r.quality,r.bytes,r.ssim.toFixed(5),Number.isFinite(r.psnr)?r.psnr.toFixed(2):"inf",Math.round(r.ms)].join(","))]
    downloadBlob(new Blob([lines.join("\n")],{ type:"text/csv" }),(item?.file.name.replace(/\.[^.]+$/,"")??"squish")+"-formats.csv")
  }

  return (
    <Sheet open={!!item} onClose={onClose} title={t.formatsTitle} wide>
      {item&&(
        <>
          <p className="-mt-2 max-w-[70ch] text-sm text-muted-foreground">{t.formatsHint}</p>
          {failed&&<p className="text-sm text-warn">{t.formatsFailed}</p>}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ul className="flex flex-wrap gap-4 text-sm" aria-label={t.legend}>
              {SERIES.map((s)=>(
                <li key={s.format} className="flex items-center gap-2">
                  <svg aria-hidden width="14" height="14" viewBox="-7 -7 14 14"><Marker shape={s.shape} x={0} y={0} color={s.color} /></svg>
                  {s.label}
                </li>
              ))}
            </ul>
            <p aria-live="polite" className="text-sm text-muted-foreground tabular-nums">
              {rows.length<total?t.formatsProgress(rows.length,total):best?t.formatsBest(label(best.format),best.quality,formatBytes(best.bytes)):t.formatsNoBest}
            </p>
          </div>

          <figure className="rounded-2xl border border-border bg-[#141a24] p-2 sm:p-3">
            <div className="relative">
              <svg viewBox={"0 0 "+W+" "+H} className="block h-auto w-full" role="img" aria-label={t.formatsChart}>
                {yTicks.map((v)=>(
                  <g key={v}>
                    <line x1={PAD.left} x2={W-PAD.right} y1={y(v)} y2={y(v)} stroke="rgb(255 255 255 / 0.07)" />
                    <text x={PAD.left-8} y={y(v)+4} textAnchor="end" fontSize="11" fill="rgb(255 255 255 / 0.55)">{v.toFixed(2)}</text>
                  </g>
                ))}
                {rows.length>0&&ticks(lo,hi).map((v)=>(
                  <text key={v.kb} x={x(v.kb*1024)} y={H-PAD.bottom+18} textAnchor="middle" fontSize="11" fill="rgb(255 255 255 / 0.55)">{v.label}</text>
                ))}
                <line x1={PAD.left} x2={W-PAD.right} y1={H-PAD.bottom} y2={H-PAD.bottom} stroke="rgb(255 255 255 / 0.2)" />
                <text x={(PAD.left+W-PAD.right)/2} y={H-6} textAnchor="middle" fontSize="11" fill="rgb(255 255 255 / 0.7)">{t.axisSize}</text>
                <text x={14} y={(PAD.top+H-PAD.bottom)/2} textAnchor="middle" fontSize="11" fill="rgb(255 255 255 / 0.7)" transform={"rotate(-90 14 "+(PAD.top+H-PAD.bottom)/2+")"}>{t.axisSsim}</text>
                {SERIES.map((s)=>{
                  const points=sorted.filter((r)=>r.format===s.format)
                  if (!points.length) return null
                  return (
                    <g key={s.format}>
                      {points.length>1&&<polyline points={points.map((r)=>x(r.bytes)+","+y(r.ssim)).join(" ")} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" />}
                      {points.map((r)=><Marker key={r.quality} shape={s.shape} x={x(r.bytes)} y={y(r.ssim)} color={s.color} />)}
                    </g>
                  )
                })}
                {spread(SERIES.flatMap((s)=>{
                  const points=sorted.filter((r)=>r.format===s.format)
                  const last=points[points.length-1]
                  return last?[{ key:s.format, x:x(last.bytes)+9, y:y(last.ssim)+4, text:s.label }]:[]
                }),13).map((l)=>(
                  <text key={l.key} x={l.x} y={l.y} fontSize="11" fontWeight="600" fill="rgb(255 255 255 / 0.85)" stroke="#141a24" strokeWidth={3} paintOrder="stroke">{l.text}</text>
                ))}
                {sorted.map((r)=>(
                  <circle
                    key={r.format+r.quality}
                    cx={x(r.bytes)}
                    cy={y(r.ssim)}
                    r={12}
                    fill="transparent"
                    onPointerEnter={()=>setHover(r)}
                    onPointerLeave={()=>setHover((h)=>h===r?null:h)}
                  />
                ))}
              </svg>
              {hover&&(
                <div
                  role="tooltip"
                  className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+12px)] rounded-xl border border-border bg-popover px-3 py-2 text-xs shadow-lg"
                  style={{ left:x(hover.bytes)/W*100+"%", top:y(hover.ssim)/H*100+"%" }}
                >
                  <p className="font-bold">{label(hover.format)+(hover.format==="image/png"?"":" · "+t.quality+" "+hover.quality)}</p>
                  <p className="tabular-nums text-muted-foreground">{formatBytes(hover.bytes)+" · SSIM "+hover.ssim.toFixed(4)+" · PSNR "+psnrText(hover.psnr)}</p>
                </div>
              )}
            </div>
          </figure>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm tabular-nums">
              <caption className="sr-only">{t.formatsChart}</caption>
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th scope="col" className="py-2 pr-3 font-semibold">{t.format}</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">{t.quality}</th>
                  <th scope="col" className="py-2 pr-3 text-right font-semibold">{t.size}</th>
                  <th scope="col" className="py-2 pr-3 text-right font-semibold">SSIM</th>
                  <th scope="col" className="py-2 pr-3 text-right font-semibold">PSNR</th>
                  <th scope="col" className="py-2 text-right font-semibold">{t.time}</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r)=>(
                  <tr key={r.format+r.quality} className={"border-b border-border/60 "+(r===best?"text-primary":"")}>
                    <td className="py-1.5 pr-3 font-semibold">{label(r.format)}</td>
                    <td className="py-1.5 pr-3">{r.format==="image/png"?"–":r.quality}</td>
                    <td className="py-1.5 pr-3 text-right">{formatBytes(r.bytes)}</td>
                    <td className="py-1.5 pr-3 text-right">{r.ssim.toFixed(4)}</td>
                    <td className="py-1.5 pr-3 text-right">{psnrText(r.psnr)}</td>
                    <td className="py-1.5 text-right">{Math.round(r.ms)+" ms"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end">
            <Button size="sm" className="h-11" disabled={rows.length<total} onClick={csv}><Download aria-hidden className="size-4" />{t.downloadCsv}</Button>
          </div>
        </>
      )}
    </Sheet>
  )
}
