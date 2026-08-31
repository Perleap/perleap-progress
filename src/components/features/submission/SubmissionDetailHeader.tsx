import { Sparkles, Calendar, BookOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SubmissionResetProgressDialog } from '@/components/features/submission/SubmissionResetProgressDialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { SecureAvatarImage } from '@/components/ui/SecureAvatarImage';
import { STUDENT_AVATARS_BUCKET } from '@/utils/storageUrls';

export type SubmissionDetailHeaderProps = {
  studentName: string;
  studentAvatar?: string | null;
  classroomName: string;
  submittedAt: string;
  canResetProgress: boolean;
  resetProgressOpen: boolean;
  onResetProgressOpenChange: (open: boolean) => void;
  onResetConfirm: () => void | Promise<void>;
  resetPending: boolean;
  hasFeedback: boolean;
  generatingAssignment: boolean;
  onGenerateFollowup: () => void | Promise<void>;
};

export const SubmissionDetailHeader = ({
  studentName,
  studentAvatar,
  classroomName,
  submittedAt,
  canResetProgress,
  resetProgressOpen,
  onResetProgressOpenChange,
  onResetConfirm,
  resetPending,
  hasFeedback,
  generatingAssignment,
  onGenerateFollowup,
}: SubmissionDetailHeaderProps) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm p-6 rounded-xl border border-white/20 shadow-sm">
      <div className="flex items-center gap-4 flex-1 min-w-0 w-full md:w-auto">
        <Avatar className="h-16 w-16 border-2 border-white dark:border-slate-800 shadow-md shrink-0">
          <SecureAvatarImage
            src={studentAvatar}
            bucket={STUDENT_AVATARS_BUCKET}
            alt={studentName}
          />
          <AvatarFallback className="bg-primary/10 text-primary text-xl">
            {studentName.charAt(0)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{studentName}</h1>
          </div>
          <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 mt-1">
            <span className="flex items-center gap-1 text-sm">
              <BookOpen className="h-3.5 w-3.5" />
              {classroomName}
            </span>
            <span className="flex items-center gap-1 text-sm">
              <Calendar className="h-3.5 w-3.5" />
              {new Date(submittedAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 shrink-0">
        {canResetProgress ? (
          <SubmissionResetProgressDialog
            open={resetProgressOpen}
            onOpenChange={onResetProgressOpenChange}
            onConfirm={onResetConfirm}
            isPending={resetPending}
          />
        ) : null}

        {hasFeedback ? (
          <Button
            onClick={() => void onGenerateFollowup()}
            disabled={generatingAssignment}
            className="rounded-full shadow-sm hover:shadow-md transition-all text-sm h-9 px-4"
            size="sm"
          >
            {generatingAssignment ? (
              <>
                <span className="animate-spin me-2">⏳</span>
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="me-2 h-3.5 w-3.5" />
                {t('submissionDetail.generateFollowUp')}
              </>
            )}
          </Button>
        ) : null}
      </div>
    </div>
  );
};
