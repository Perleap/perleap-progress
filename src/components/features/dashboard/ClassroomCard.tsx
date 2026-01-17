import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ClassroomCardProps {
  classroom: {
    id: string;
    name: string;
    subject: string;
    invite_code?: string;
  };
  onClick: () => void;
  showInviteCode?: boolean;
}

/**
 * Classroom card component
 * Displays classroom information in a card format
 */
export const ClassroomCard = ({
  classroom,
  onClick,
  showInviteCode = false,
}: ClassroomCardProps) => {
  const { t } = useTranslation();

  return (
    <Card className="hover:shadow-lg transition-shadow cursor-pointer bg-card border-border" onClick={onClick}>
      <CardHeader>
        <CardTitle className="text-base md:text-lg text-foreground">{classroom.name}</CardTitle>
        <CardDescription className="text-sm text-muted-foreground">{classroom.subject}</CardDescription>
      </CardHeader>
      {showInviteCode && classroom.invite_code && (
        <CardContent>
          <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground">
            <Users className="h-3 w-3 md:h-4 md:w-4" />
            <span>
              {t('teacherDashboard.inviteCode')} {classroom.invite_code}
            </span>
          </div>
        </CardContent>
      )}
    </Card>
  );
};
