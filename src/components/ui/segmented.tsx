import { useId } from "react"
import { cn } from "@/lib/utils"

type Option<T extends string>={ value:T; label:string; disabled?:boolean; title?:string }

// A radio group drawn as a segmented glass control: arrow keys and screen readers work as for any radio group.
export function Segmented<T extends string>({ label, options, value, onChange, columns }:{
  label:string
  options:Option<T>[]
  value:T
  onChange:(value:T)=>void
  // Lays the options out in a grid of this many columns, for lists too long for one row.
  columns?:number
}) {
  const name=useId()
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-xs font-semibold text-muted-foreground">{label}</legend>
      <div className={cn("rounded-[14px] border border-border bg-white/[0.05] p-1",columns?"grid gap-1":"flex")} style={columns?{ gridTemplateColumns:"repeat("+columns+",minmax(0,1fr))" }:undefined}>
        {options.map((o)=>(
          <label key={o.value} title={o.title} className={cn("min-w-0 flex-1", o.disabled&&"cursor-not-allowed")}>
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value===o.value}
              disabled={o.disabled}
              onChange={()=>onChange(o.value)}
              className="peer sr-only"
            />
            <span
              className={cn(
                "flex h-9 items-center justify-center truncate rounded-[10px] px-1 text-[13px] font-semibold text-muted-foreground transition-colors duration-150",
                "peer-checked:bg-foreground peer-checked:text-background",
                "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary",
                o.disabled?"opacity-40 line-through":"cursor-pointer hover:text-foreground peer-checked:hover:text-background",
              )}
            >
              {o.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
