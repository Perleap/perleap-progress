import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-6", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-between items-center px-2 pb-4",
        caption_label: "text-sm font-bold uppercase tracking-wider",
        nav: "flex items-center space-x-1",
        nav_button: cn(
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex border-b pb-2 mb-3",
        head_cell: "text-muted-foreground w-10 font-normal text-xs uppercase tracking-wider",
        row: "flex w-full mt-2",
        cell: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-transparent",
        day: cn(
          "h-10 w-10 p-0 font-normal text-sm hover:bg-transparent aria-selected:opacity-100",
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-[#3b82f6] text-white hover:bg-[#3b82f6] hover:text-white focus:bg-[#3b82f6] focus:text-white rounded-full",
        day_today: "bg-transparent text-foreground font-semibold",
        day_outside:
          "text-muted-foreground opacity-50",
        day_disabled: "text-muted-foreground opacity-25",
        day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ..._props }) => <ChevronLeft className="h-4 w-4" />,
        IconRight: ({ ..._props }) => <ChevronRight className="h-4 w-4" />,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
