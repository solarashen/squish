import { useEffect, useState } from "react"
import { DEFAULT_PATTERN } from "@/lib/files"
import { load, save } from "@/lib/storage"

const KEY="squish-general"

type General={ pattern:string; remember:boolean }

// Site-wide preferences. These are always kept, since one of them is whether to keep the rest.
export function useGeneral() {
  const [general,setGeneral]=useState<General>(()=>({ pattern:DEFAULT_PATTERN, remember:true, ...load<General>(KEY) }))
  useEffect(()=>save(KEY,general),[general])
  return {
    pattern:general.pattern,
    setPattern:(pattern:string)=>setGeneral((g)=>({ ...g, pattern })),
    remember:general.remember,
    setRemember:(remember:boolean)=>setGeneral((g)=>({ ...g, remember })),
  }
}
