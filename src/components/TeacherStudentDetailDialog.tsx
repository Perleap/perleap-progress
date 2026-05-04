import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ListOrdered, User } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StudentProfilePanel } from '@/components/StudentProfilePanel';
import { StudentActivitiesSection } from '@/components/features/syllabus';

export interface TeacherStudentDetailDialogProps {
  open: boolean;
  onClose: () => void;
  classroomId: string;
  studentId: string | null;
  studentName?: string;
  isRTL: boolean;
}

export function TeacherStudentDetailDialog({
  open,
  onClose,
  classroomId,
  studentId,
  studentName,
  isRTL,
}: TeacherStudentDetailDialogProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState('profile');

  useEffect(() => {
    if (open) {
      setTab('profile');
    }
  }, [open, studentId]);

  const studentLabel = studentName ?? t('common.student');

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent
        dir={isRTL ? 'rtl' : 'ltr'}
        className={cnDialog}
      >
        <DialogHeader>
          <DialogTitle>{t('classroomDetail.studentsTab.detailDialogTitle', { name: studentLabel })}</DialogTitle>
        </DialogHeader>
        <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-col gap-4">
          <TabsList className="h-auto w-full flex-wrap justify-start sm:w-fit">
            <TabsTrigger value="profile" className="gap-1.5">
              <User className="h-4 w-4 shrink-0" aria-hidden />
              {t('classroomDetail.studentsTab.tabProfile')}
            </TabsTrigger>
            <TabsTrigger value="curriculum" className="gap-1.5">
              <ListOrdered className="h-4 w-4 shrink-0" aria-hidden />
              {t('classroomDetail.studentsTab.tabCurriculum')}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="profile" className="mt-0 max-h-[min(60vh,520px)] overflow-y-auto">
            <StudentProfilePanel
              studentId={studentId}
              studentName={studentName}
              queryEnabled={open && tab === 'profile'}
            />
          </TabsContent>
          <TabsContent value="curriculum" className="mt-0 flex min-h-0 flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              {t('classroomDetail.studentsTab.curriculumReadOnlyNote', { name: studentLabel })}
            </p>
            <div className="max-h-[min(65vh,560px)] overflow-y-auto pe-1">
              {studentId ? (
                <StudentActivitiesSection
                  classroomId={classroomId}
                  isRTL={isRTL}
                  progressUserId={studentId}
                  readOnly
                />
              ) : null}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

const cnDialog =
  'flex max-h-[min(90vh,880px)] flex-col gap-4 overflow-hidden p-6 sm:max-w-4xl';
