import { Loader2, Upload, FileIcon, X, Send, Plus } from 'lucide-react';
import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { AssignmentCompletionTone } from '@/types/submission';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { completeSubmission, submitWithBackgroundAiFeedback } from '@/services/submissionService';
import { getAssignmentLanguage } from '@/utils/languageDetection';
interface ProjectSubmissionPageProps {
  assignmentId: string;
  submissionId: string;
  assignmentInstructions: string;
  enableAiFeedback?: boolean;
  showAiFeedbackToStudents?: boolean;
  isTeacherTry?: boolean;
  onComplete: (tone?: AssignmentCompletionTone) => void | Promise<void>;
}

type SelectedFile = {
  id: string;
  file: File;
  uploadedPath?: string;
};

function makeFileId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export const ProjectSubmissionPage = ({
  assignmentId,
  submissionId,
  assignmentInstructions,
  enableAiFeedback = true,
  showAiFeedbackToStudents = true,
  isTeacherTry = false,
  onComplete,
}: ProjectSubmissionPageProps) => {
  const { t } = useTranslation();
  const { language: uiLanguage = 'en' } = useLanguage();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const allUploaded =
    selectedFiles.length > 0 && selectedFiles.every((entry) => Boolean(entry.uploadedPath));

  const addFiles = (files: FileList | File[]) => {
    const next = Array.from(files).map((file) => ({
      id: makeFileId(),
      file,
    }));
    if (next.length === 0) return;
    setSelectedFiles((prev) => [...prev, ...next]);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const removeFile = (id: string) => {
    setSelectedFiles((prev) => prev.filter((entry) => entry.id !== id));
  };

  const uploadFiles = async () => {
    const pending = selectedFiles.filter((entry) => !entry.uploadedPath);
    if (pending.length === 0) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      const uploadedEntries: SelectedFile[] = [...selectedFiles];
      let completed = selectedFiles.length - pending.length;

      for (const entry of pending) {
        const ext = entry.file.name.split('.').pop();
        const safeName = entry.file.name.replace(/[^\w.-]+/g, '_');
        const filePath = `${assignmentId}/${submissionId}/${entry.id}_${safeName || `project.${ext}`}`;

        const { error: uploadError } = await supabase.storage
          .from('submission-files')
          .upload(filePath, entry.file, { upsert: true });

        if (uploadError) throw uploadError;

        const index = uploadedEntries.findIndex((item) => item.id === entry.id);
        if (index >= 0) {
          uploadedEntries[index] = { ...uploadedEntries[index]!, uploadedPath: filePath };
        }

        completed += 1;
        setUploadProgress(Math.round((completed / selectedFiles.length) * 100));
      }

      const fileUrls = uploadedEntries
        .map((entry) => entry.uploadedPath)
        .filter((path): path is string => Boolean(path));

      const { error: updateError } = await supabase
        .from('submissions')
        .update({
          file_urls: fileUrls,
          file_url: fileUrls[0] ?? null,
        })
        .eq('id', submissionId);

      if (updateError) throw updateError;

      setSelectedFiles(uploadedEntries);
      setUploadProgress(100);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(t('assignmentDetail.project.uploadError'));
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    const fileUrls = selectedFiles
      .map((entry) => entry.uploadedPath)
      .filter((path): path is string => Boolean(path));

    if (fileUrls.length === 0) return;

    setSubmitting(true);
    try {
      const { error: updateError } = await supabase
        .from('submissions')
        .update({
          file_urls: fileUrls,
          file_url: fileUrls[0] ?? null,
        })
        .eq('id', submissionId);

      if (updateError) throw updateError;

      if (isTeacherTry) {
        const { error } = await completeSubmission(submissionId);
        if (error) throw error;
        await onComplete('activityCompleted');
        return;
      }

      if (!enableAiFeedback) {
        const { error } = await completeSubmission(submissionId);
        if (error) throw error;
        await onComplete('awaitingReview');
        return;
      }

      if (!user?.id) {
        toast.error(t('common.error'));
        return;
      }

      const language = getAssignmentLanguage(assignmentInstructions, uiLanguage);
      const { error: submitError, evaluationInvokeFailed } = await submitWithBackgroundAiFeedback({
        submissionId,
        studentId: user.id,
        assignmentId,
        language,
      });
      if (submitError) throw submitError;
      if (evaluationInvokeFailed) {
        toast.warning(t('assignmentDetail.errors.generatingFeedbackButCompleted'));
      }

      await onComplete(showAiFeedbackToStudents ? 'activityCompleted' : 'awaitingTeacher');
    } catch (error) {
      console.error('Submit error:', error);
      toast.error(t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="rounded-xl border-border shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold">
          {t('assignmentDetail.project.uploadFile')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className={cn(
            'cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-all sm:p-12',
            dragOver
              ? 'scale-[1.01] border-primary bg-primary/5'
              : 'border-border bg-muted/10 hover:border-primary/40'
          )}
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          role="presentation"
        >
          <Upload className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">
            {t('assignmentDetail.project.dragDrop')}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('assignmentDetail.project.fileTypes')}
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                addFiles(e.target.files);
              }
              e.target.value = '';
            }}
          />
        </div>

        {selectedFiles.length > 0 && (
          <div className="space-y-3">
            {selectedFiles.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <FileIcon className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{entry.file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(entry.file.size / (1024 * 1024)).toFixed(2)} MB
                    {entry.uploadedPath ? ` · ${t('assignmentDetail.project.fileSelected')} ✓` : ''}
                  </p>
                </div>
                {!uploading && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeFile(entry.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}

            {uploading && <Progress value={uploadProgress} className="h-2" />}

            {!uploading && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2 rounded-xl"
                onClick={() => fileInputRef.current?.click()}
              >
                <Plus className="h-4 w-4" />
                {t('assignmentDetail.project.addMoreFiles')}
              </Button>
            )}
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          {selectedFiles.length > 0 && !allUploaded && (
            <Button onClick={uploadFiles} disabled={uploading} className="gap-2 rounded-xl">
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('assignmentDetail.project.submitting')}
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  {t('assignmentDetail.project.uploadFile')}
                </>
              )}
            </Button>
          )}
          {allUploaded && (
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              size="lg"
              className="gap-2 rounded-xl shadow-sm"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('assignmentDetail.project.submitting')}
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  {t('assignmentDetail.project.submit')}
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
