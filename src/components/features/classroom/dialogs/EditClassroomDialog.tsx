import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  buildClassroomUpdatePayload,
  buildEditClassroomFormData,
  type EditClassroomFormData,
  type EditClassroomRecord,
} from '@/components/features/classroom/forms/classroomFormTypes';
import {
  ClassroomBasicInfoSection,
  ClassroomMaterialsSection,
  ClassroomOutcomesSection,
  ClassroomSubjectAreasSection,
} from '@/components/features/classroom/forms/sections';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/useAuth';
import { updateClassroom } from '@/services/classroomService';

interface EditClassroomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classroom: EditClassroomRecord;
  onSuccess: () => void;
}

export const EditClassroomDialog = ({
  open,
  onOpenChange,
  classroom,
  onSuccess,
}: EditClassroomDialogProps) => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<EditClassroomFormData>(() =>
    buildEditClassroomFormData(classroom)
  );

  useEffect(() => {
    if (open && classroom) {
      setFormData(buildEditClassroomFormData(classroom));
    }
  }, [open, classroom]);

  const onFormChange = (partial: Partial<EditClassroomFormData>) => {
    setFormData((prev) => ({ ...prev, ...partial }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await updateClassroom(classroom.id, buildClassroomUpdatePayload(formData));

      if (error) throw error;

      toast.success(t('editClassroom.success.saved'));
      onSuccess();
      onOpenChange(false);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : t('editClassroom.errors.saving'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir={isRTL ? 'rtl' : 'ltr'}
        className="sm:max-w-6xl max-h-[90vh] p-0 overflow-hidden rounded-xl border-none shadow-2xl bg-background"
      >
        <DialogHeader className="px-8 pt-8 pb-6 bg-gradient-to-br from-muted/20 to-transparent">
          <div className="flex items-center gap-3 mb-2">
            <DialogTitle className="text-2xl md:text-3xl font-bold tracking-tight text-heading">
              {t('editClassroom.title')}
            </DialogTitle>
          </div>
          <p className={`text-subtle text-body ms-1 ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('editClassroom.description')}
          </p>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-160px)] px-8 pb-8">
          <form onSubmit={handleSubmit} className="space-y-8 pt-4">
            <ClassroomBasicInfoSection
              formData={formData}
              onFormChange={onFormChange}
              descriptionFieldKey={open ? classroom.id : 'closed'}
            />
            <ClassroomSubjectAreasSection
              formData={formData}
              onFormChange={onFormChange}
              helperTextKey="editClassroom.subjectAreasHelper"
            />
            <ClassroomMaterialsSection formData={formData} onFormChange={onFormChange} />
            <ClassroomOutcomesSection formData={formData} onFormChange={onFormChange} />

            <div className="flex justify-end gap-3 pt-6 border-t">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="rounded-full px-6 font-bold"
              >
                {t('createClassroom.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="rounded-full px-10 font-bold shadow-lg shadow-primary/20"
              >
                {loading ? t('editClassroom.saving') : t('editClassroom.saveButton')}
              </Button>
            </div>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
