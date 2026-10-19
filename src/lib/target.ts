import type { Target } from "./types"

// The byte size a file should end up at, or null when the normal quality controls apply.
export function targetBytes(target:Target,originalSize:number):number|null {
  if (target.mode==="size") return Math.max(1024,Math.round(target.sizeKb*1024))
  if (target.mode==="percent") return Math.max(1024,Math.round(originalSize*(1-target.percent/100)))
  return null
}

// A result within this margin above the target still counts as a hit; encoders never land exactly.
export const TARGET_SLACK=1.05
