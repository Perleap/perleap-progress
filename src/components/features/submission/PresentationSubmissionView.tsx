import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Loader2, Video } from 'lucide-react';
import { toast } from 'sonner';
import { TeacherEvaluationForm } from './TeacherEvaluationForm';

function extensionFromVideo(blobType: string, fileUrl: string): string {
  if (blobType.includes('webm')) return 'webm';
  if (blobType.includes('mp4')) return 'mp4';
  if (blobType.includes('quicktime')) return 'mov';
  const fromPath = fileUrl.match(/\.(webm|mp4|mov|mkv)(?:\?|$)/i);
  if (fromPath) return fromPath[1].toLowerCase();
  return 'webm';
}

interface PresentationSubmissionViewProps {
  fileUrl: string | null | undefined;
  submissionId: string;
  studentId: string;
  assignmentId: string;
  hasFeedback: boolean;
  onEvaluationComplete: () => void;
}

export function PresentationSubmissionView({
  fileUrl,
  submissionId,
  studentId,
  assignmentId,
  hasFeedback,
  onEvaluationComplete,
}: PresentationSubmissionViewProps) {
  const { t } = useTranslation();
  const [downloading, setDownloading] = useState(false);

  const handleDownloadVideo = useCallback(async () => {
    if (!fileUrl) return;
    setDownloading(true);
    try {
      const res = await fetch(fileUrl, { mode: 'cors', credentials: 'omit' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const ext = extensionFromVideo(blob.type || '', fileUrl);
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `presentation.${ext}`;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      console.error('Download failed:', err);
      toast.error(t('submissionDetail.presentationView.downloadFailed'));
      try {
        window.open(fileUrl, '_blank', 'noopener,noreferrer');
      } catch {
        /* ignore */
      }
    } finally {
      setDownloading(false);
    }
  }, [fileUrl, t]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('submissionDetail.presentationView.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {fileUrl ? (
            <div className="space-y-4">
              <div className="rounded-lg overflow-hidden bg-black aspect-video">
                <video
                  src={fileUrl}
                  controls
                  className="w-full h-full"
                  preload="metadata"
                />
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  title={t('submissionDetail.presentationView.download')}
                  aria-label={t('submissionDetail.presentationView.download')}
                  disabled={downloading}
                  onClick={handleDownloadVideo}
                >
                  {downloading ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Download className="h-4 w-4" aria-hidden />
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Video className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-sm">{t('submissionDetail.presentationView.noVideo')}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {!hasFeedback && (
        <TeacherEvaluationForm
          submissionId={submissionId}
          studentId={studentId}
          assignmentId={assignmentId}
          onEvaluationComplete={onEvaluationComplete}
        />
      )}
    </div>
  );
}
