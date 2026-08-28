import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/useAuth';
import { useEnrollInClassroom } from '@/hooks/queries';

export type JoinClassroomDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJoined?: (result: { classroomId: string; classroomName: string }) => void;
  trigger?: ReactNode;
};

function mapJoinErrorMessage(
  message: string,
  inviteCode: string,
  t: (key: string, options?: Record<string, string>) => string,
): string {
  const lower = message.toLowerCase();
  if (lower.includes('already enrolled')) {
    return t('studentDashboard.errors.alreadyEnrolled');
  }
  if (lower.includes('no classroom found')) {
    return t('studentDashboard.errors.noClassroomFound', { code: inviteCode.trim().toUpperCase() });
  }
  return t('studentDashboard.errors.unexpected');
}

export function JoinClassroomDialog({
  open,
  onOpenChange,
  onJoined,
  trigger,
}: JoinClassroomDialogProps) {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const enrollMutation = useEnrollInClassroom();
  const [inviteCode, setInviteCode] = useState('');
  const joining = enrollMutation.isPending;

  const handleJoinClassroom = async () => {
    if (!user || !inviteCode.trim()) {
      toast.error(t('studentDashboard.errors.enterInviteCode'));
      return;
    }

    const trimmedCode = inviteCode.trim().toUpperCase();
    const studentName = profile?.full_name || user.email || 'A student';

    try {
      const result = await enrollMutation.mutateAsync({
        inviteCode: trimmedCode,
        studentName,
      });

      const classroomName = result.classroomName ?? '';
      toast.success(t('studentDashboard.success.joinedClassroom', { name: classroomName }));
      setInviteCode('');
      onOpenChange(false);

      if (result.classroomId && classroomName) {
        onJoined?.({ classroomId: result.classroomId, classroomName });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t('studentDashboard.errors.unexpected');
      toast.error(mapJoinErrorMessage(message, trimmedCode, t));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="rounded-xl sm:max-w-[425px] bg-card">
        <DialogHeader>
          <DialogTitle className="text-xl text-foreground">
            {t('studentDashboard.joinClassroom.title')}
          </DialogTitle>
          <DialogDescription>{t('studentDashboard.joinClassroom.description')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="join-classroom-invite-code" className="text-base font-medium text-foreground">
              {t('studentDashboard.joinClassroom.inviteCode')}
            </Label>
            <Input
              id="join-classroom-invite-code"
              placeholder={t('studentDashboard.joinClassroom.placeholder')}
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              maxLength={6}
              className="text-center text-2xl tracking-widest uppercase h-14 rounded-xl border-2 focus-visible:ring-ring bg-card text-foreground"
            />
          </div>
          <Button
            onClick={() => void handleJoinClassroom()}
            className="w-full rounded-full h-12 text-lg font-medium"
            disabled={joining}
          >
            {joining
              ? t('studentDashboard.joinClassroom.joining')
              : t('studentDashboard.joinClassroom.button')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
