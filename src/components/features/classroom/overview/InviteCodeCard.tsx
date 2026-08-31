import { Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Classroom } from '@/types/models';

interface InviteCodeCardProps {
  classroom: Classroom;
  isRTL: boolean;
  t: (key: string) => string;
}

export function InviteCodeCard({ classroom, isRTL, t }: InviteCodeCardProps) {
  return (
    <Card
      className="w-full rounded-xl border-none shadow-sm bg-muted/30 overflow-hidden"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <CardHeader className="pb-2">
        <CardTitle className={`text-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
          {t('classroomDetail.inviteCode')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-4 justify-start">
          <div className="bg-card/80 backdrop-blur-sm px-6 py-3 rounded-lg border border-border shadow-sm">
            <code className="text-3xl font-mono font-bold text-primary tracking-wider">
              {classroom.invite_code}
            </code>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full hover:bg-card/50"
            onClick={() => {
              navigator.clipboard.writeText(classroom.invite_code);
              toast.success(t('classroomDetail.copiedToClipboard'));
            }}
          >
            <LinkIcon className="h-5 w-5 text-muted-foreground" />
          </Button>
        </div>
        <p className={`text-sm text-muted-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
          {t('classroomDetail.shareCode')}
        </p>
      </CardContent>
    </Card>
  );
}
