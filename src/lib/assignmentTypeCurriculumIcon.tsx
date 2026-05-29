import type { LucideIcon } from 'lucide-react';
import {
  Briefcase,
  ClipboardList,
  ClipboardCheck,
  FileText,
  HelpCircle,
  ListChecks,
  MessageCircle,
  MessagesSquare,
  Palette,
  Presentation,
  Clapperboard,
  Workflow,
  Radio,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DbAssignmentType } from '@/types/models';

const CURRICULUM_ICON_SIZE_PX = 14;

const ASSIGNMENT_TYPE_CURRICULUM_ICONS: Record<DbAssignmentType, LucideIcon> = {
  text_essay: FileText,
  quiz_mcq: ListChecks,
  creative_task: Palette,
  discussion_prompt: MessagesSquare,
  multimedia: Clapperboard,
  project: Briefcase,
  questions: HelpCircle,
  test: ClipboardCheck,
  presentation: Presentation,
  langchain: Workflow,
  chatbot: MessageCircle,
  live_session: Radio,
};

function curriculumIconForType(type: string | null | undefined): LucideIcon {
  if (!type) return ClipboardList;
  return ASSIGNMENT_TYPE_CURRICULUM_ICONS[type as DbAssignmentType] ?? ClipboardList;
}

export function curriculumAssignmentIconForType(type: string | null | undefined): LucideIcon {
  return curriculumIconForType(type);
}

export function CurriculumAssignmentTypeIcon({
  type,
  className,
}: {
  type?: string | null;
  className?: string | undefined;
}) {
  const Icon = curriculumIconForType(type);
  return (
    <span
      className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center text-foreground"
      aria-hidden
    >
      <Icon
        size={CURRICULUM_ICON_SIZE_PX}
        strokeWidth={2}
        className={cn('shrink-0', className)}
      />
    </span>
  );
}
