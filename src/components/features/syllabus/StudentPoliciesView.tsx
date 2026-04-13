import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  Shield,
  Clock,
  AlertTriangle,
  MessageCircle,
  GraduationCap,
  Users,
  Award,
  PenLine,
} from 'lucide-react';
import type { SyllabusPolicy, SyllabusPolicyType } from '@/types/syllabus';

interface StudentPoliciesViewProps {
  policies: SyllabusPolicy[];
  isRTL?: boolean;
}

const ICON_MAP: Record<SyllabusPolicyType, { icon: typeof Shield; colorClass: string }> = {
  grading: { icon: GraduationCap, colorClass: 'text-blue-500 bg-blue-100 dark:bg-blue-900/30' },
  attendance: { icon: Clock, colorClass: 'text-green-500 bg-green-100 dark:bg-green-900/30' },
  late_work: { icon: AlertTriangle, colorClass: 'text-orange-500 bg-orange-100 dark:bg-orange-900/30' },
  communication: { icon: MessageCircle, colorClass: 'text-purple-500 bg-purple-100 dark:bg-purple-900/30' },
  academic_integrity: { icon: Shield, colorClass: 'text-red-500 bg-red-100 dark:bg-red-900/30' },
  participation: { icon: Users, colorClass: 'text-teal-500 bg-teal-100 dark:bg-teal-900/30' },
  extra_credit: { icon: Award, colorClass: 'text-yellow-500 bg-yellow-100 dark:bg-yellow-900/30' },
  custom: { icon: PenLine, colorClass: 'text-gray-500 bg-gray-100 dark:bg-gray-900/30' },
};

export const StudentPoliciesView = ({
  policies,
  isRTL = false,
}: StudentPoliciesViewProps) => {
  const { t } = useTranslation();

  const activePolicies = policies.filter((p) => p.content?.trim());

  if (activePolicies.length === 0) return null;

  return (
    <div className="space-y-3">
      <h4 className={cn(
        'text-xs font-bold text-muted-foreground uppercase tracking-wider',
        isRTL && 'text-right'
      )}>
        {t('syllabus.policies.title')}
      </h4>
      <div className="grid sm:grid-cols-2 gap-3">
        {activePolicies.map((policy) => {
          const mapping = ICON_MAP[policy.type] ?? ICON_MAP.custom;
          const Icon = mapping.icon;

          return (
            <Card key={policy.id} className="rounded-xl border-border shadow-sm" dir={isRTL ? 'rtl' : 'ltr'}>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className={cn('text-sm flex items-center gap-2', isRTL && 'flex-row-reverse')}>
                  <div className={cn('p-1.5 rounded-lg', mapping.colorClass)}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  {policy.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className={cn(
                  'text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed',
                  isRTL && 'text-right'
                )}>
                  {policy.content}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
