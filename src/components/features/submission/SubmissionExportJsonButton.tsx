import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { exportSubmissionJson } from '@/lib/submissionExport';

interface SubmissionExportJsonButtonProps {
  submissionId: string;
  className?: string;
}

export function SubmissionExportJsonButton({
  submissionId,
  className,
}: SubmissionExportJsonButtonProps) {
  const { t } = useTranslation();
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportSubmissionJson(submissionId);
      toast.success(t('submissionDetail.exportJsonSuccess'));
    } catch {
      toast.error(t('common.error'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={className ?? 'shrink-0 rounded-full h-9 px-4 text-sm'}
      disabled={exporting}
      onClick={() => void handleExport()}
    >
      {exporting ? (
        <Loader2 className="me-2 h-3.5 w-3.5 animate-spin" />
      ) : (
        <Download className="me-2 h-3.5 w-3.5" />
      )}
      {exporting ? t('submissionDetail.exportJsonLoading') : t('submissionDetail.exportJson')}
    </Button>
  );
}
