import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Download, FileIcon, ExternalLink } from 'lucide-react';
import { TeacherEvaluationForm } from './TeacherEvaluationForm';

interface ProjectSubmissionViewProps {
  fileUrl?: string | null;
  fileUrls?: string[] | null;
  submissionId: string;
  studentId: string;
  assignmentId: string;
  hasFeedback: boolean;
  onEvaluationComplete: () => void;
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
}: ProjectSubmissionViewProps) {
  const { t } = useTranslation();
  const urls = resolveProjectFileUrls(fileUrl, fileUrls);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('submissionDetail.projectView.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {urls.length > 0 ? (
            <div className="space-y-4">
              {urls.map((url) => {
                const fileName = fileNameFromUrl(url);
                const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
                const isPdf = /\.pdf$/i.test(url);

                return (
                  <div key={url} className="space-y-4">
                    <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                      <FileIcon className="h-8 w-8 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{fileName}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(url, '_blank')}
                          className="gap-1.5"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          {t('submissionDetail.projectView.preview')}
                        </Button>
                        <a
                          href={url}
                          download
                          className={cn(buttonVariants({ variant: 'default', size: 'sm' }), 'gap-1.5')}
                        >
                          <Download className="h-3.5 w-3.5" />
                          {t('submissionDetail.projectView.download')}
                        </a>
                      </div>
                    </div>

                    {isImage && (
                      <div className="rounded-lg overflow-hidden border">
                        <img src={url} alt={fileName} className="w-full max-h-[500px] object-contain" />
                      </div>
                    )}

                    {isPdf && (
                      <div className="rounded-lg overflow-hidden border h-[500px]">
                        <iframe src={url} className="w-full h-full" title={`PDF Preview: ${fileName}`} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
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
