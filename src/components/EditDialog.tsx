import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type KeyboardEvent } from "react"
import { FlipHorizontal2, FlipVertical2, RotateCcw, RotateCw } from "lucide-react"
import { Sheet } from "@/components/Sheet"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { useI18n } from "@/i18n/I18nProvider"
import { isEdited, NO_EDIT, renderEdit, rotatedSize } from "@/lib/edit"
import type { ImageEdit, Item } from "@/lib/types"

type Crop=NonNullable<ImageEdit["crop"]>
type Handle="move"|"nw"|"ne"|"sw"|"se"

const ASPECTS:Record<string,number|null>={ free:null, "1:1":1, "4:3":4/3, "3:2":3/2, "16:9":16/9, "9:16":9/16 }
const MIN=0.05

const clamp=(v:number,lo:number,hi:number)=>Math.min(hi,Math.max(lo,v))

// The largest crop of the given shape that fits the picture, centred.
function fitAspect(ratio:number,width:number,height:number):Crop {
  let w=1
  let h=width/ratio/height
  if (h>1) {
    h=1
    w=height*ratio/width
  }
  return { x:(1-w)/2, y:(1-h)/2, w, h }
}

export function EditDialog({ item, onClose, onApply }:{ item:Item|null; onClose:()=>void; onApply:(edit:ImageEdit|undefined)=>void }) {
  const { t }=useI18n()
  const [bitmap,setBitmap]=useState<ImageBitmap|null>(null)
  const [edit,setEdit]=useState<ImageEdit>(NO_EDIT)
  const [aspect,setAspect]=useState("free")
  const canvas=useRef<HTMLCanvasElement>(null)
  const frame=useRef<HTMLDivElement>(null)
  const drag=useRef<{ handle:Handle; x:number; y:number; crop:Crop }|null>(null)

  useEffect(()=>{
    if (!item) return
    setEdit(item.edit??NO_EDIT)
    setAspect("free")
    let alive=true
    let loaded:ImageBitmap|null=null
    fetch(item.previewUrl)
      .then((r)=>r.blob())
      .then((b)=>createImageBitmap(b,{ imageOrientation:"from-image" }))
      .then((b)=>{
        loaded=b
        if (alive) setBitmap(b)
      })
    return ()=>{
      alive=false
      loaded?.close()
      setBitmap(null)
    }
  },[item])

  // Draws the rotated, flipped picture; the crop is shown as a frame on top of it.
  const full=bitmap?rotatedSize(bitmap.width,bitmap.height,edit.rotate):{ width:1, height:1 }
  useEffect(()=>{
    const c=canvas.current
    if (!bitmap||!c) return
    const preview=renderEdit(bitmap,edit,false)
    c.width=preview.width
    c.height=preview.height
    c.getContext("2d")!.drawImage(preview,0,0)
  },[bitmap,edit])

  const crop:Crop=edit.crop??{ x:0, y:0, w:1, h:1 }
  const ratio=ASPECTS[aspect]

  const setCrop=(next:Crop)=>setEdit((e)=>({ ...e, crop:next }))
  // Turning changes which side is which, so the crop starts over.
  const turn=(change:Partial<ImageEdit>)=>setEdit((e)=>({ ...e, ...change, crop:null }))

  const resize=(start:Crop,handle:Handle,dx:number,dy:number):Crop=>{
    if (handle==="move") return { ...start, x:clamp(start.x+dx,0,1-start.w), y:clamp(start.y+dy,0,1-start.h) }
    const left=handle==="nw"||handle==="sw"
    const top=handle==="nw"||handle==="ne"
    let x0=start.x
    let y0=start.y
    let x1=start.x+start.w
    let y1=start.y+start.h
    if (left) x0=clamp(x0+dx,0,x1-MIN)
    else x1=clamp(x1+dx,x0+MIN,1)
    if (top) y0=clamp(y0+dy,0,y1-MIN)
    else y1=clamp(y1+dy,y0+MIN,1)
    if (ratio) {
      // Keep the shape: the height follows the width, measured in real pixels.
      const w=x1-x0
      let h=w*full.width/ratio/full.height
      if (top) y0=y1-h
      else y1=y0+h
      if (y0<0||y1>1) {
        h=top?y1:1-y0
        const nw=h*full.height*ratio/full.width
        if (left) x0=x1-nw
        else x1=x0+nw
        if (top) y0=y1-h
        else y1=y0+h
      }
    }
    return { x:x0, y:y0, w:x1-x0, h:y1-y0 }
  }

  const down=(handle:Handle)=>(e:ReactPointerEvent)=>{
    e.preventDefault()
    e.stopPropagation()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    drag.current={ handle, x:e.clientX, y:e.clientY, crop }
  }
  const move=(e:ReactPointerEvent)=>{
    const d=drag.current
    const box=frame.current?.getBoundingClientRect()
    if (!d||!box) return
    setCrop(resize(d.crop,d.handle,(e.clientX-d.x)/box.width,(e.clientY-d.y)/box.height))
  }
  const up=()=>{
    drag.current=null
  }

  const keys=(e:KeyboardEvent)=>{
    const step=0.01
    const dx=e.key==="ArrowLeft"?-step:e.key==="ArrowRight"?step:0
    const dy=e.key==="ArrowUp"?-step:e.key==="ArrowDown"?step:0
    if (!dx&&!dy) return
    e.preventDefault()
    setCrop(resize(crop,e.shiftKey?"se":"move",dx,dy))
  }

  const corner="absolute size-4 rounded-full border-2 border-background bg-foreground shadow"
  return (
    <Sheet open={!!item} onClose={onClose} title={t.editTitle} wide>
      {item&&(
        <>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex gap-2">
              <Button size="icon" className="size-11" aria-label={t.rotateLeft} title={t.rotateLeft} onClick={()=>turn({ rotate:((edit.rotate+270)%360) as ImageEdit["rotate"] })}><RotateCcw aria-hidden className="size-4" /></Button>
              <Button size="icon" className="size-11" aria-label={t.rotateRight} title={t.rotateRight} onClick={()=>turn({ rotate:((edit.rotate+90)%360) as ImageEdit["rotate"] })}><RotateCw aria-hidden className="size-4" /></Button>
              <Button size="icon" className="size-11" aria-label={t.flipH} title={t.flipH} aria-pressed={edit.flipH} onClick={()=>turn({ flipH:!edit.flipH })}><FlipHorizontal2 aria-hidden className="size-4" /></Button>
              <Button size="icon" className="size-11" aria-label={t.flipV} title={t.flipV} aria-pressed={edit.flipV} onClick={()=>turn({ flipV:!edit.flipV })}><FlipVertical2 aria-hidden className="size-4" /></Button>
            </div>
            <div className="min-w-0 flex-1 sm:max-w-md">
              <Segmented
                label={t.cropShape}
                value={aspect}
                onChange={(a)=>{
                  setAspect(a)
                  const r=ASPECTS[a]
                  setCrop(r?fitAspect(r,full.width,full.height):{ x:0, y:0, w:1, h:1 })
                }}
                options={Object.keys(ASPECTS).map((a)=>({ value:a, label:a==="free"?t.cropFree:a }))}
              />
            </div>
          </div>

          <div className="grid place-items-center rounded-2xl border border-border bg-black/30 p-3">
            <div ref={frame} className="relative max-w-full touch-none select-none" onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
              <canvas ref={canvas} className="block max-h-[56dvh] max-w-full" />
              {bitmap&&(
                <div
                  role="slider"
                  tabIndex={0}
                  aria-label={t.cropArea}
                  aria-valuetext={Math.round(crop.w*full.width)+" × "+Math.round(crop.h*full.height)+" px"}
                  onKeyDown={keys}
                  onPointerDown={down("move")}
                  className="absolute cursor-move border-2 border-foreground shadow-[0_0_0_9999px_rgb(0_0_0/0.55)] outline-none focus-visible:border-primary"
                  style={{ left:crop.x*100+"%", top:crop.y*100+"%", width:crop.w*100+"%", height:crop.h*100+"%" }}
                >
                  <span aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,transparent_33%,rgb(255_255_255/0.35)_33%,rgb(255_255_255/0.35)_calc(33%+1px),transparent_calc(33%+1px),transparent_66%,rgb(255_255_255/0.35)_66%,rgb(255_255_255/0.35)_calc(66%+1px),transparent_calc(66%+1px)),linear-gradient(to_bottom,transparent_33%,rgb(255_255_255/0.35)_33%,rgb(255_255_255/0.35)_calc(33%+1px),transparent_calc(33%+1px),transparent_66%,rgb(255_255_255/0.35)_66%,rgb(255_255_255/0.35)_calc(66%+1px),transparent_calc(66%+1px))]" />
                  <span onPointerDown={down("nw")} className={corner+" -top-2 -left-2 cursor-nwse-resize"} />
                  <span onPointerDown={down("ne")} className={corner+" -top-2 -right-2 cursor-nesw-resize"} />
                  <span onPointerDown={down("sw")} className={corner+" -bottom-2 -left-2 cursor-nesw-resize"} />
                  <span onPointerDown={down("se")} className={corner+" -right-2 -bottom-2 cursor-nwse-resize"} />
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {t.cropHint}
              {bitmap&&<span className="ml-2 font-semibold text-foreground tabular-nums">{Math.round(crop.w*full.width)+" × "+Math.round(crop.h*full.height)+" px"}</span>}
            </p>
            <div className="flex gap-2">
              <Button size="sm" className="h-11" onClick={()=>{
                setEdit(NO_EDIT)
                setAspect("free")
              }}>{t.resetEdit}</Button>
              <Button size="sm" className="h-11" onClick={onClose}>{t.cancel}</Button>
              <Button variant="primary" onClick={()=>{
                const whole=!edit.crop||(edit.crop.w>0.999&&edit.crop.h>0.999)
                const clean={ ...edit, crop:whole?null:edit.crop }
                onApply(isEdited(clean)?clean:undefined)
                onClose()
              }}>{t.apply}</Button>
            </div>
          </div>
        </>
      )}
    </Sheet>
  )
}
