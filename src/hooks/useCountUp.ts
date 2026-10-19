import { useEffect, useRef, useState } from "react"

// Eases a number from its previous value to the new one; jumps straight there with reduced motion.
export function useCountUp(target:number,duration=700) {
  const [value,setValue]=useState(target)
  const from=useRef(target)

  useEffect(()=>{
    const reduce=window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduce||from.current===target) {
      from.current=target
      setValue(target)
      return
    }
    const start=performance.now()
    const begin=from.current
    let frame=0
    const tick=(now:number)=>{
      const p=Math.min(1,(now-start)/duration)
      const eased=1-Math.pow(1-p,4)
      const next=begin+(target-begin)*eased
      setValue(next)
      from.current=next
      if (p<1) frame=requestAnimationFrame(tick)
    }
    frame=requestAnimationFrame(tick)
    return ()=>cancelAnimationFrame(frame)
  },[target,duration])

  return value
}
