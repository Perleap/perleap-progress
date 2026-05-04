import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useTranslation } from 'react-i18next';
import { StudentProfilePanel } from '@/components/StudentProfilePanel';

interface StudentProfileModalProps {
  studentId: string | null;
  studentName?: string;
  open: boolean;
  onClose: () => void;
}

export function StudentProfileModal({ studentId, studentName, open, onClose }: StudentProfileModalProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('studentProfile.title')}</DialogTitle>
        </DialogHeader>
        <StudentProfilePanel studentId={open ? studentId : null} studentName={studentName} queryEnabled={open} />
      </DialogContent>
    </Dialog>
  );
}
