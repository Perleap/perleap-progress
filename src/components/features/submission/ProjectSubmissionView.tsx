import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, ExternalLink, FileIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { TeacherEvaluationForm } from './TeacherEvaluationForm';

interface ProjectSubmissionViewProps {
  fileUrl?: string | null;
  fileUrls?: string[] | null;
  submissionId: string;
  studentId: string;
  assignmentId: string;
  hasFeedback: boolean;
  onEvaluationComplete: () => void;
  headerAction?: ReactNode;
}

function resolveProjectFileUrls(fileUrl?: string | null, fileUrls?: string[] | null): string[] {
  if (fileUrls && fileUrls.length > 0) return fileUrls;
  if (fileUrl) return [fileUrl];
  return [];
}

function fileNameFromUrl(fileUrl: string): string {
  return decodeURIComponent(fileUrl.split('/').pop() || '');
}

export function ProjectSubmissionView({
  fileUrl,
  fileUrls,
  submissionId,
  studentId,
  assignmentId,
  hasFeedback,
  onEvaluationComplete,
  headerAction,
}: ProjectSubmissionViewProps) {
  const { t } = useTranslation();
  const urls = resolveProjectFileUrls(fileUrl, fileUrls);
  const [downloadingUrl, setDownloadingUrl] = useState<string | null>(null);

  const handleDownload = useCallback(
    async (url: string, fileName: string) => {
      setDownloadingUrl(url);
      try {
        const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = fileName;
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(objectUrl);
      } catch (err) {
        console.error('Download failed:', err);
        toast.error(t('submissionDetail.projectView.downloadFailed'));
        try {
          window.open(url, '_blank', 'noopener,noreferrer');
        } catch {
          /* ignore */
        }
      } finally {
        setDownloadingUrl(null);
      }
    },
    [t]
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-base">{t('submissionDetail.projectView.title')}</CardTitle>
          {headerAction}
        </CardHeader>
        <CardContent>
          {urls.length > 0 ? (
            <div className="space-y-4">
              {urls.map((url) => {
                const fileName = fileNameFromUrl(url);
                const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
                const isPdf = /\.pdf$/i.test(url);
                const isDownloading = downloadingUrl === url;

                return (
                  <div key={url} className="space-y-4">
                    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card/50 p-4 transition-colors hover:bg-muted/20 sm:flex-row sm:items-center">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/60">
                          <FileIcon className="size-4 text-muted-foreground" />
                        </div>
                        <p className="truncate text-sm font-medium text-foreground">{fileName}</p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
                          className="h-8 rounded-full gap-1.5 px-3 text-xs font-medium"
                        >
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                          {t('submissionDetail.projectView.preview')}
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={isDownloading}
                          onClick={() => void handleDownload(url, fileName)}
                          className="h-8 rounded-full gap-1.5 px-3 text-xs font-medium"
                        >
                          {isDownloading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                          ) : (
                            <Download className="h-3.5 w-3.5" aria-hidden />
                          )}
                          {t('submissionDetail.projectView.download')}
                        </Button>
                      </div>
                    </div>

                    {isImage && (
                      <div className="overflow-hidden rounded-lg border">
                        <img src={url} alt={fileName} className="max-h-[500px] w-full object-contain" />
                      </div>
                    )}

                    {isPdf && (
                      <div className="h-[500px] overflow-hidden rounded-lg border">
                        <iframe src={url} className="h-full w-full" title={`PDF Preview: ${fileName}`} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t('submissionDetail.projectView.noFile')}
            </p>
          )}
        </CardContent>
      </Card>

      <TeacherEvaluationForm
        submissionId={submissionId}
        studentId={studentId}
        assignmentId={assignmentId}
        onEvaluationComplete={onEvaluationComplete}
        isOverride={hasFeedback}
      />
    </div>
  );
}
