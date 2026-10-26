import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { Sheet } from "@/components/Sheet"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { useI18n } from "@/i18n/I18nProvider"
import type { Item, MediaEdit } from "@/lib/types"

const SHAPES:Record<string,number|null>={ orig:null, "1:1":1, "4:3":4/3, "16:9":16/9, "9:16":9/16, "4:5":4/5 }
const BARS=240
// Bigger files would take too long to decode just for a picture of the sound.
const WAVE_LIMIT=150*1024*1024

const clock=(s:number)=>{
  const m=Math.floor(s/60)
  const sec=s-m*60
  return m+":"+(sec<10?"0":"")+sec.toFixed(1)
}

// Loudest sample in each of BARS slices, for drawing the waveform.
async function peaks(file:File) {
  if (file.size>WAVE_LIMIT) return null
  const ctx=new OfflineAudioContext(1,1,44100)
  const audio=await ctx.decodeAudioData(await file.arrayBuffer())
  const out=new Float32Array(BARS)
  const step=Math.max(1,Math.floor(audio.length/BARS))
  for (let ch=0;ch<audio.numberOfChannels;ch++) {
    const data=audio.getChannelData(ch)
    for (let b=0;b<BARS;b++) {
      let peak=0
      const end=Math.min(data.length,(b+1)*step)
      for (let i=b*step;i<end;i+=4) {
        const v=Math.abs(data[i])
        if (v>peak) peak=v
      }
      if (peak>out[b]) out[b]=peak
    }
  }
  const top=Math.max(...out)||1
  return out.map((v)=>v/top)
}

export function MediaEditDialog({ item, onClose, onApply }:{ item:Item|null; onClose:()=>void; onApply:(edit:MediaEdit|undefined)=>void }) {
  const { t }=useI18n()
  const [duration,setDuration]=useState(0)
  const [start,setStart]=useState(0)
  const [end,setEnd]=useState(0)
  const [aspect,setAspect]=useState("orig")
  const [now,setNow]=useState(0)
  const [wave,setWave]=useState<Float32Array|null>(null)
  const [size,setSize]=useState({ width:16, height:9 })
  const player=useRef<HTMLVideoElement&HTMLAudioElement>(null)
  const track=useRef<HTMLDivElement>(null)
  const dragging=useRef<"start"|"end"|null>(null)

  const url=useMemo(()=>item?URL.createObjectURL(item.file):"",[item])
  useEffect(()=>()=>{
    if (url) URL.revokeObjectURL(url)
  },[url])

  useEffect(()=>{
    if (!item) return
    setStart(item.mediaEdit?.start??0)
    setEnd(item.mediaEdit?.end??0)
    setAspect(item.mediaEdit?.aspect??"orig")
    setDuration(0)
    setWave(null)
    let alive=true
    peaks(item.file).then((w)=>alive&&setWave(w),()=>{})
    return ()=>{
      alive=false
    }
  },[item])

  const isVideo=item?.kind==="video"
  const stop=end||duration

  // The player stays inside the chosen range while previewing.
  const tick=()=>{
    const p=player.current
    if (!p) return
    setNow(p.currentTime)
    if (stop&&p.currentTime>=stop) {
      p.pause()
      p.currentTime=start
    }
  }

  const fromPointer=(e:{ clientX:number })=>{
    const box=track.current?.getBoundingClientRect()
    if (!box||!duration) return 0
    return Math.min(duration,Math.max(0,(e.clientX-box.left)/box.width*duration))
  }
  const move=(e:ReactPointerEvent)=>{
    const which=dragging.current
    if (!which) return
    const at=fromPointer(e)
    if (which==="start") setStart(Math.min(at,stop-0.1))
    else setEnd(Math.max(at,start+0.1))
    if (player.current) player.current.currentTime=at
  }
  const grab=(which:"start"|"end")=>(e:ReactPointerEvent)=>{
    e.preventDefault()
    e.stopPropagation()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    dragging.current=which
  }

  const nudge=(which:"start"|"end",by:number)=>{
    if (which==="start") setStart((s)=>Math.max(0,Math.min(stop-0.1,s+by)))
    else setEnd((v)=>Math.min(duration,Math.max(start+0.1,(v||duration)+by)))
  }

  const ratio=SHAPES[aspect]
  // Centred crop frame over the preview, as a share of its width and height.
  let frame={ w:1, h:1 }
  if (ratio) {
    const h=size.width/ratio/size.height
    frame=h<=1?{ w:1, h }:{ w:size.height*ratio/size.width, h:1 }
  }

  const pct=(s:number)=>(duration?s/duration*100:0)+"%"
  const handle="absolute top-0 bottom-0 z-10 w-3 -translate-x-1/2 cursor-ew-resize rounded-full bg-foreground shadow outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"

  return (
    <Sheet open={!!item} onClose={onClose} title={item?.kind==="video"?t.trimVideo:t.trimTitle} wide>
      {item&&(
        <>
          <div className="grid place-items-center rounded-2xl border border-border bg-black/30 p-3">
            <div className="relative max-w-full">
              {isVideo
                ?<video
                  ref={player}
                  src={url}
                  controls
                  playsInline
                  className="block max-h-[46dvh] max-w-full"
                  onLoadedMetadata={(e)=>{
                    setDuration(e.currentTarget.duration)
                    setSize({ width:e.currentTarget.videoWidth||16, height:e.currentTarget.videoHeight||9 })
                  }}
                  onTimeUpdate={tick}
                />
                :<audio ref={player} src={url} controls className="w-[min(560px,80vw)]" onLoadedMetadata={(e)=>setDuration(e.currentTarget.duration)} onTimeUpdate={tick} />}
              {isVideo&&ratio&&(
                <div
                  aria-hidden
                  className="pointer-events-none absolute border-2 border-foreground shadow-[0_0_0_9999px_rgb(0_0_0/0.55)]"
                  style={{ left:(1-frame.w)/2*100+"%", top:(1-frame.h)/2*100+"%", width:frame.w*100+"%", height:frame.h*100+"%" }}
                />
              )}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-baseline justify-between text-xs font-semibold text-muted-foreground">
              <span>{t.trim}</span>
              <span className="tabular-nums text-foreground">{clock(start)+" – "+clock(stop)+" · "+clock(Math.max(0,stop-start))}</span>
            </div>
            <div
              ref={track}
              className="relative h-20 touch-none select-none rounded-xl border border-border bg-white/[0.04]"
              onPointerMove={move}
              onPointerUp={()=>(dragging.current=null)}
              onPointerCancel={()=>(dragging.current=null)}
              onPointerDown={(e)=>{
                if (player.current) player.current.currentTime=fromPointer(e)
              }}
            >
              <div aria-hidden className="absolute inset-0 flex items-center gap-px overflow-hidden rounded-xl px-1">
                {wave
                  ?Array.from(wave,(v,i)=>{
                    const at=i/BARS*duration
                    const inside=at>=start&&at<=stop
                    return <span key={i} className={inside?"flex-1 rounded-full bg-primary":"flex-1 rounded-full bg-white/20"} style={{ height:Math.max(4,v*92)+"%" }} />
                  })
                  :<span className="h-px flex-1 bg-white/20" />}
              </div>
              <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 rounded-l-xl bg-black/50" style={{ width:pct(start) }} />
              <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 rounded-r-xl bg-black/50" style={{ width:duration?(1-stop/duration)*100+"%":"0" }} />
              <div aria-hidden className="pointer-events-none absolute inset-y-0 w-px bg-foreground/80" style={{ left:pct(now) }} />
              {duration>0&&(
                <>
                  <span
                    role="slider"
                    tabIndex={0}
                    aria-label={t.trimStart}
                    aria-valuemin={0}
                    aria-valuemax={duration}
                    aria-valuenow={start}
                    aria-valuetext={clock(start)}
                    className={handle}
                    style={{ left:pct(start) }}
                    onPointerDown={grab("start")}
                    onKeyDown={(e)=>{
                      const by=e.key==="ArrowLeft"?-1:e.key==="ArrowRight"?1:0
                      if (!by) return
                      e.preventDefault()
                      nudge("start",by*(e.shiftKey?1:0.1))
                    }}
                  />
                  <span
                    role="slider"
                    tabIndex={0}
                    aria-label={t.trimEnd}
                    aria-valuemin={0}
                    aria-valuemax={duration}
                    aria-valuenow={stop}
                    aria-valuetext={clock(stop)}
                    className={handle}
                    style={{ left:pct(stop) }}
                    onPointerDown={grab("end")}
                    onKeyDown={(e)=>{
                      const by=e.key==="ArrowLeft"?-1:e.key==="ArrowRight"?1:0
                      if (!by) return
                      e.preventDefault()
                      nudge("end",by*(e.shiftKey?1:0.1))
                    }}
                  />
                </>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" className="h-10" disabled={!duration} onClick={()=>setStart(Math.min(now,stop-0.1))}>{t.startHere}</Button>
              <Button size="sm" className="h-10" disabled={!duration} onClick={()=>setEnd(Math.max(now,start+0.1))}>{t.endHere}</Button>
              <Button size="sm" className="h-10" disabled={!duration} onClick={()=>{
                const p=player.current
                if (!p) return
                p.currentTime=start
                p.play()
              }}>{t.playRange}</Button>
            </div>
          </div>

          {isVideo&&(
            <div className="sm:max-w-md">
              <Segmented
                label={t.cropShape}
                value={aspect}
                onChange={setAspect}
                options={Object.keys(SHAPES).map((a)=>({ value:a, label:a==="orig"?t.original:a }))}
              />
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">{t.trimHint}</p>
            <div className="flex gap-2">
              <Button size="sm" className="h-11" onClick={()=>{
                setStart(0)
                setEnd(0)
                setAspect("orig")
              }}>{t.resetEdit}</Button>
              <Button size="sm" className="h-11" onClick={onClose}>{t.cancel}</Button>
              <Button variant="primary" onClick={()=>{
                const trimmedEnd=end&&duration&&end<duration-0.05?end:null
                const edit:MediaEdit={ start:start>0.05?start:0, end:trimmedEnd, aspect:aspect==="orig"?null:aspect }
                onApply(edit.start||edit.end!==null||edit.aspect?edit:undefined)
                onClose()
              }}>{t.apply}</Button>
            </div>
          </div>
        </>
      )}
    </Sheet>
  )
}
