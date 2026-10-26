import { useEffect, useState } from "react"
import { Sheet } from "@/components/Sheet"
import { useI18n } from "@/i18n/I18nProvider"
import type { Item } from "@/lib/types"

type Exif=Record<string,unknown>

function fmtExposure(v:unknown) {
  const n=Number(v)
  if (!n) return null
  return n>=1?n+" s":"1/"+Math.round(1/n)+" s"
}

// What the camera wrote into the original file, read with exifr. Converting through the canvas drops
// all of it, which is the point of showing it.
export function PhotoInfoDialog({ item, onClose }:{ item:Item|null; onClose:()=>void }) {
  const { t, lang }=useI18n()
  const [data,setData]=useState<Exif|null|undefined>(undefined)

  useEffect(()=>{
    if (!item) return
    setData(undefined)
    let alive=true
    import("exifr")
      .then((m)=>m.default.parse(item.file,{ tiff:true, exif:true, gps:true }))
      .then((d)=>{
        if (alive) setData((d as Exif)??null)
      })
      .catch(()=>{
        if (alive) setData(null)
      })
    return ()=>{
      alive=false
    }
  },[item])

  const f=t.infoFields
  const rows:[string,string][]=[]
  if (data) {
    const cam=[data.Make,data.Model].filter(Boolean).join(" ")
    if (cam) rows.push([f.camera,cam])
    if (data.LensModel) rows.push([f.lens,String(data.LensModel)])
    const taken=data.DateTimeOriginal??data.CreateDate
    if (taken instanceof Date) rows.push([f.taken,taken.toLocaleString(lang==="hr"?"hr-HR":"en-GB")])
    const exp=fmtExposure(data.ExposureTime)
    if (exp) rows.push([f.exposure,exp])
    if (data.FNumber) rows.push([f.aperture,"f/"+Number(data.FNumber).toFixed(1)])
    if (data.ISO) rows.push([f.iso,String(data.ISO)])
    if (data.FocalLength) rows.push([f.focal,Number(data.FocalLength).toFixed(1)+" mm"])
    if (data.Software) rows.push([f.software,String(data.Software)])
    const w=data.ExifImageWidth??data.ImageWidth
    const h=data.ExifImageHeight??data.ImageHeight
    if (w&&h) rows.push([f.size,w+" × "+h+" px"])
  }
  const lat=Number(data?.latitude)
  const lon=Number(data?.longitude)
  const hasGps=Number.isFinite(lat)&&Number.isFinite(lon)&&!!data?.latitude

  return (
    <Sheet open={!!item} onClose={onClose} title={t.infoTitle}>
      {item&&(
        <>
          <p className="-mt-3 truncate text-sm text-muted-foreground">{item.file.name}</p>
          {data===undefined&&<div className="working-bar h-1.5 rounded-full" />}
          {data!==undefined&&!rows.length&&!hasGps&&<p className="text-muted-foreground">{t.infoNone}</p>}
          {(rows.length>0||hasGps)&&(
            <>
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-sm">
                {rows.map(([k,v])=>(
                  <div key={k} className="contents">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="font-semibold tabular-nums">{v}</dd>
                  </div>
                ))}
                {hasGps&&(
                  <div className="contents">
                    <dt className="text-muted-foreground">{f.location}</dt>
                    <dd className="font-semibold tabular-nums">
                      {lat.toFixed(5)+", "+lon.toFixed(5)}{" "}
                      <a href={"https://www.openstreetmap.org/?mlat="+lat+"&mlon="+lon+"#map=16/"+lat+"/"+lon} target="_blank" rel="noreferrer" className="text-primary underline-offset-4 hover:underline">{t.openMap}</a>
                    </dd>
                  </div>
                )}
              </dl>
              <p className="rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-semibold">{t.infoRemoved}</p>
            </>
          )}
        </>
      )}
    </Sheet>
  )
}
