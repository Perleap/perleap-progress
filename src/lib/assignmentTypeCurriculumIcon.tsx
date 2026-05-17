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
} from 'lucide-react';
import type { DbAssignmentType } from '@/types/models';

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
};

export function curriculumAssignmentIconForType(type: string | null | undefined): LucideIcon {
  if (!type) return ClipboardList;
  const icon = ASSIGNMENT_TYPE_CURRICULUM_ICONS[type as DbAssignmentType];
  return icon ?? ClipboardList;
}

export function CurriculumAssignmentTypeIcon({
  type,
  className,
}: {
  type?: string | null;
  className?: string | undefined;
}) {
  const Icon = curriculumAssignmentIconForType(type);
  return <Icon className={className} aria-hidden />;
}
