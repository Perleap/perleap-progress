"use client"

import { Switch as SwitchPrimitive } from "@base-ui/react/switch"

import { cn } from "@/lib/utils"

function Switch({
  className,
  size = "default",
  variant = "default",
  ...props
}: SwitchPrimitive.Root.Props & {
  size?: "sm" | "default"
  variant?: "default" | "ios"
}) {
  const resolvedSize = variant === "ios" ? "ios" : size

  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={resolvedSize}
      className={cn(
        "focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 shrink-0 rounded-full border border-transparent shadow-xs focus-visible:ring-[1.5px] aria-invalid:ring-[1.5px] peer group/switch relative inline-flex items-center transition-all outline-none after:absolute after:-inset-x-3 after:-inset-y-2 data-disabled:cursor-not-allowed data-disabled:opacity-50",
        variant === "default" &&
          "data-[checked]:bg-primary data-[unchecked]:bg-input dark:data-[unchecked]:bg-input/80 data-[size=default]:h-[18.4px] data-[size=default]:w-[32px] data-[size=sm]:h-[14px] data-[size=sm]:w-[24px]",
        variant === "ios" &&
          "h-[31px] w-[51px] min-w-[51px] border-0 shadow-none bg-[#E9E9EA] dark:bg-white/20 data-[checked]:bg-[#34C759] data-[unchecked]:bg-[#E9E9EA] dark:data-[unchecked]:bg-white/20",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block rounded-full ring-0 transition-transform duration-200 ease-in-out motion-reduce:transition-none",
          variant === "default" &&
            "translate-x-0 bg-background dark:group-data-[unchecked]/switch:bg-foreground dark:group-data-[checked]/switch:bg-primary-foreground group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 group-data-[checked]/switch:translate-x-[calc(100%-2px)]",
          variant === "ios" &&
            "size-[27px] translate-x-[3px] bg-white shadow-[0_2px_6px_rgba(0,0,0,0.12),0_1px_2px_rgba(0,0,0,0.08)] group-data-[checked]/switch:translate-x-[21px]"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
