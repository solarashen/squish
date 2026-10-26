import { useEffect, useId, useRef, type ComponentType } from "react"
import { MoreHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"

export type RowAction={
  id:string
  label:string
  icon:ComponentType<{ className?:string; strokeWidth?:number; "aria-hidden"?:boolean }>
  onSelect:()=>void|Promise<void>
}

const MENU_GAP=6

// The extra things one file can do (compare, edit, copy…), tucked behind a "⋯" button so a row
// stays readable. The menu is a native popover: it sits in the top layer above the bottom bar,
// and the browser closes it on Escape or an outside click.
export function RowMenu({ label, actions, className }:{ label:string; actions:RowAction[]; className?:string }) {
  const id=useId()
  const button=useRef<HTMLButtonElement>(null)
  const menu=useRef<HTMLDivElement>(null)

  // Opens below the button, or above it when there is not enough room underneath.
  const place=()=>{
    const b=button.current?.getBoundingClientRect()
    const m=menu.current
    if (!b||!m) return
    const below=b.bottom+MENU_GAP+m.offsetHeight<=window.innerHeight-110
    m.style.top=(below?b.bottom+MENU_GAP:b.top-MENU_GAP-m.offsetHeight)+"px"
    m.style.left=Math.max(8,b.right-m.offsetWidth)+"px"
    m.querySelector<HTMLButtonElement>("[role=menuitem]")?.focus()
  }

  // React does not forward the popover "toggle" event, so listen to it directly.
  useEffect(()=>{
    const m=menu.current
    if (!m) return
    const onToggle=(e:Event)=>{
      if ((e as ToggleEvent).newState==="open") place()
    }
    m.addEventListener("toggle",onToggle)
    return ()=>m.removeEventListener("toggle",onToggle)
  })

  const move=(e:React.KeyboardEvent)=>{
    if (e.key!=="ArrowDown"&&e.key!=="ArrowUp") return
    e.preventDefault()
    const items=Array.from(menu.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]")??[])
    const i=items.indexOf(document.activeElement as HTMLButtonElement)
    items[(i+(e.key==="ArrowDown"?1:-1)+items.length)%items.length]?.focus()
  }

  if (!actions.length) return null
  return (
    <div className={cn("relative",className)}>
      <button
        ref={button}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        popoverTarget={id}
        className="grid size-9 cursor-pointer place-items-center rounded-full border border-border bg-secondary transition-colors hover:bg-white/12"
      >
        <MoreHorizontal aria-hidden className="size-4" strokeWidth={2.2} />
      </button>
      <div
        ref={menu}
        id={id}
        popover="auto"
        role="menu"
        onKeyDown={move}
        className="fixed inset-auto m-0 min-w-52 gap-0.5 rounded-2xl border border-edge bg-popover/95 p-1.5 text-foreground shadow-[0_20px_50px_rgb(0_0_0/0.5)] backdrop-blur-xl [&:popover-open]:grid"
      >
        {actions.map(({ id:key, label:text, icon:Icon, onSelect })=>(
          <button
            key={key}
            type="button"
            role="menuitem"
            onClick={()=>{
              menu.current?.hidePopover()
              void onSelect()
            }}
            className="flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-semibold outline-none hover:bg-white/8 focus-visible:bg-white/10"
          >
            <Icon aria-hidden className="size-4 text-primary" strokeWidth={2.2} />
            {text}
          </button>
        ))}
      </div>
    </div>
  )
}
