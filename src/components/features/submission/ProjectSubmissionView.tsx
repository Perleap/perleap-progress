import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, FileIcon, ExternalLink } from 'lucide-react';
import { TeacherEvaluationForm } from './TeacherEvaluationForm';

interface ProjectSubmissionViewProps {
  fileUrl: string | null | undefined;
  submissionId: string;
  studentId: string;
  assignmentId: string;
  hasFeedback: boolean;
  onEvaluationComplete: () => void;
}

export function ProjectSubmissionView({
  fileUrl,
  submissionId,
  studentId,
  assignmentId,
  hasFeedback,
  onEvaluationComplete,
}: ProjectSubmissionViewProps) {
  const { t } = useTranslation();

  const fileName = fileUrl ? decodeURIComponent(fileUrl.split('/').pop() || '') : '';
  const isImage = fileUrl && /\.(jpg|jpeg|png|gif|webp)$/i.test(fileUrl);
  const isPdf = fileUrl && /\.pdf$/i.test(fileUrl);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('submissionDetail.projectView.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {fileUrl ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                <FileIcon className="h-8 w-8 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{fileName}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(fileUrl, '_blank')}
                    className="gap-1.5"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {t('submissionDetail.projectView.preview')}
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    asChild
                    className="gap-1.5"
                  >
                    <a href={fileUrl} download>
                      <Download className="h-3.5 w-3.5" />
                      {t('submissionDetail.projectView.download')}
                    </a>
                  </Button>
                </div>
              </div>

              {isImage && (
                <div className="rounded-lg overflow-hidden border">
                  <img src={fileUrl} alt="Project submission" className="w-full max-h-[500px] object-contain" />
                </div>
              )}

              {isPdf && (
                <div className="rounded-lg overflow-hidden border h-[500px]">
                  <iframe src={fileUrl} className="w-full h-full" title="PDF Preview" />
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t('submissionDetail.projectView.noFile')}
            </p>
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
