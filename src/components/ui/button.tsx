import { forwardRef, type ButtonHTMLAttributes } from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants=cva(
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap select-none cursor-pointer transition-[background-color,color,transform,opacity] duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100",
  {
    variants: {
      variant: {
        // the one accent action on a screen
        primary: "bg-primary text-primary-foreground font-bold hover:brightness-110",
        // light pill, for the final download
        light: "bg-foreground text-background font-bold hover:bg-white",
        // quiet glass chip
        ghost: "border border-border bg-secondary text-foreground hover:bg-white/10",
      },
      size: {
        lg: "h-13 px-7 text-base",
        md: "h-11 px-5 text-[15px]",
        sm: "h-9 px-4 text-[13px]",
        icon: "size-9 p-0",
      },
    },
    defaultVariants: { variant: "ghost", size: "md" },
  },
)

export type ButtonProps=ButtonHTMLAttributes<HTMLButtonElement>&VariantProps<typeof buttonVariants>

export const Button=forwardRef<HTMLButtonElement,ButtonProps>(({ className, variant, size, type="button", ...props },ref)=>(
  <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }),className)} {...props} />
))
Button.displayName="Button"
