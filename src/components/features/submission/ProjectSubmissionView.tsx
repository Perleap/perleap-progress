import { Download, ExternalLink, FileIcon, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { TeacherEvaluationForm } from './TeacherEvaluationForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  downloadSubmissionFile,
  extractSubmissionStoragePath,
  fileNameFromSubmissionStored,
  resolveSubmissionFileDisplayUrls,
} from '@/services/submissionFileService';

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

function resolveProjectFileStored(fileUrl?: string | null, fileUrls?: string[] | null): string[] {
  if (fileUrls && fileUrls.length > 0) return fileUrls;
  if (fileUrl) return [fileUrl];
  return [];
}

type ResolvedFile = {
  stored: string;
  displayUrl: string;
  fileName: string;
};

export const ProjectSubmissionView = ({
  fileUrl,
  fileUrls,
  submissionId,
  studentId,
  assignmentId,
  hasFeedback,
  onEvaluationComplete,
  headerAction,
}: ProjectSubmissionViewProps) => {
  const { t } = useTranslation();
  const storedFiles = useMemo(
    () => resolveProjectFileStored(fileUrl, fileUrls),
    [fileUrl, fileUrls]
  );
  const [resolvedFiles, setResolvedFiles] = useState<ResolvedFile[]>([]);
  const [isResolving, setIsResolving] = useState(false);
  const [downloadingStored, setDownloadingStored] = useState<string | null>(null);

  useEffect(() => {
    let revokeAll = () => {};
    if (storedFiles.length === 0) {
      setResolvedFiles([]);
      setIsResolving(false);
      return;
    }

    setIsResolving(true);
    void (async () => {
      const { urls, revokeAll: revoke } = await resolveSubmissionFileDisplayUrls(null, storedFiles);
      revokeAll = revoke;
      if (urls.length === 0) {
        setResolvedFiles([]);
        setIsResolving(false);
        return;
      }
      setResolvedFiles(
        storedFiles
          .map((stored, i) => ({
            stored,
            displayUrl: urls[i] ?? '',
            fileName: fileNameFromSubmissionStored(stored),
          }))
          .filter((f) => f.displayUrl)
      );
      setIsResolving(false);
    })();

    return () => revokeAll();
  }, [storedFiles]);

  const handleDownload = useCallback(
    async (stored: string, fileName: string) => {
      setDownloadingStored(stored);
      try {
        const path = extractSubmissionStoragePath(stored) ?? stored;
        const fileBlob = await downloadSubmissionFile(path);
        if (!fileBlob) throw new Error('download failed');
        const objectUrl = URL.createObjectURL(fileBlob);
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
      } finally {
        setDownloadingStored(null);
      }
    },
    [t]
  );

  const handlePreview = useCallback((displayUrl: string) => {
    if (displayUrl.startsWith('blob:')) {
      window.open(displayUrl, '_blank', 'noopener,noreferrer');
    }
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-base">{t('submissionDetail.projectView.title')}</CardTitle>
          {headerAction}
        </CardHeader>
        <CardContent>
          {isResolving ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : resolvedFiles.length > 0 ? (
            <div className="space-y-4">
              {resolvedFiles.map((file) => {
                const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(file.fileName);
                const isPdf = /\.pdf$/i.test(file.fileName);
                const isDownloading = downloadingStored === file.stored;

                return (
                  <div key={file.stored} className="space-y-4">
                    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card/50 p-4 transition-colors hover:bg-muted/20 sm:flex-row sm:items-center">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/60">
                          <FileIcon className="size-4 text-muted-foreground" />
                        </div>
                        <p className="truncate text-sm font-medium text-foreground">
                          {file.fileName}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                        {(isImage || isPdf) && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handlePreview(file.displayUrl)}
                            className="h-8 rounded-full gap-1.5 px-3 text-xs font-medium"
                          >
                            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                            {t('submissionDetail.projectView.preview')}
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={isDownloading}
                          onClick={() => void handleDownload(file.stored, file.fileName)}
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
                        <img
                          src={file.displayUrl}
                          alt={file.fileName}
                          className="max-h-[500px] w-full object-contain"
                        />
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
};
