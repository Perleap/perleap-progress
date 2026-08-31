import { Edit, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ClassroomActionBarProps {
  isRTL: boolean;
  resetButtonDisabled: boolean;
  onEdit: () => void;
  onRequestReset: () => void;
  onRequestDelete: () => void;
  t: (key: string) => string;
}

export const ClassroomActionBar = ({
  isRTL,
  resetButtonDisabled,
  onEdit,
  onRequestReset,
  onRequestDelete,
  t,
}: ClassroomActionBarProps) => {
  return (
    <div className="pt-6 border-t border-border">
      <div
        className={`flex flex-col sm:flex-row items-stretch sm:items-center gap-2 ${isRTL ? 'sm:justify-end' : 'sm:justify-start'}`}
      >
        <Button
          type="button"
          onClick={onEdit}
          variant="outline"
          size="sm"
          className="h-9 w-full gap-1.5 rounded-full shadow-xs sm:w-auto"
        >
          <Edit className="h-4 w-4" />
          {t('classroomDetail.edit')}
        </Button>
        <Button
          type="button"
          onClick={onRequestReset}
          variant="outline"
          size="sm"
          disabled={resetButtonDisabled}
          className="h-9 w-full gap-1.5 rounded-full border-amber-500/50 text-amber-700 shadow-xs hover:bg-amber-500/10 dark:text-amber-400 sm:w-auto"
        >
          <RotateCcw className="h-4 w-4" />
          {t('classroomDetail.resetDialog.button')}
        </Button>
        <Button
          type="button"
          onClick={onRequestDelete}
          variant="destructive"
          size="sm"
          className="h-9 w-full gap-1.5 rounded-full shadow-xs sm:w-auto"
        >
          <Trash2 className="h-4 w-4" />
          {t('classroomDetail.deleteButton')}
        </Button>
      </div>
    </div>
  );
};
