import { Card, CardContent } from '@/components/ui/card';
import { BookOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * Empty state component for when student has no assignments
 */
export const EmptyAssignments = () => {
  const { t } = useTranslation();

  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12">
        <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">{t('studentDashboard.empty.noAssignments')}</h3>
        <p className="text-muted-foreground">
          {t('studentDashboard.empty.noAssignmentsDescription')}
        </p>
      </CardContent>
    </Card>
  );
};
