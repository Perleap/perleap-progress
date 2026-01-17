import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ 
  className, 
  type,
  // @ts-ignore - Filter out autoDirection prop
  autoDirection,
  ...props 
}: React.ComponentProps<"input"> & { autoDirection?: boolean }) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "dark:bg-input/30 border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 h-10 rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-all duration-200 file:h-7 file:text-sm file:font-medium focus-visible:ring-[3px] focus-visible:shadow-sm aria-invalid:ring-[3px] md:text-sm file:text-foreground placeholder:text-muted-foreground/60 w-full min-w-0 outline-none file:inline-flex file:border-0 file:bg-transparent disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Input }
