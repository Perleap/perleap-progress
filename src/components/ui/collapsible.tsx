import * as React from "react"
import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible"
import { cn } from "@/lib/utils"

function Collapsible({ ...props }: CollapsiblePrimitive.Root.Props) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />
}

function CollapsibleTrigger({
  asChild,
  children,
  ...props
}: CollapsiblePrimitive.Trigger.Props & { asChild?: boolean }) {
  if (asChild && React.isValidElement(children)) {
    return (
      <CollapsiblePrimitive.Trigger
        data-slot="collapsible-trigger"
        render={children}
        {...props}
      />
    );
  }

  return (
    <CollapsiblePrimitive.Trigger data-slot="collapsible-trigger" {...props}>
      {children}
    </CollapsiblePrimitive.Trigger>
  );
}

function CollapsibleContent({
  className,
  ...props
}: CollapsiblePrimitive.Panel.Props) {
  return (
    <CollapsiblePrimitive.Panel
      data-slot="collapsible-content"
      className={cn(
        "overflow-hidden",
        "h-[var(--collapsible-panel-height)]",
        "transition-[height] duration-200 ease-in-out motion-reduce:transition-none",
        className,
      )}
      {...props}
    />
  )
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
