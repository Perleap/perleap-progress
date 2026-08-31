import type { ReactElement } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export const SyllabusRowActionTooltip = ({
  label,
  render,
}: {
  label: string;
  render: ReactElement;
}) => {
  return (
    <Tooltip>
      <TooltipTrigger render={render} />
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
};
