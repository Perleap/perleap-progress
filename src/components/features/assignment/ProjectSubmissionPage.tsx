import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Loader2, Upload, FileIcon, X, Send } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { completeSubmission } from '@/services/submissionService';
import { useQueryClient } from '@tanstack/react-query';
import { assignmentKeys } from '@/hooks/queries';

interface ProjectSubmissionPageProps {
  assignmentId: string;
  submissionId: string;
  onComplete: () => void;
}

export function ProjectSubmissionPage({
  assignmentId,
  submissionId,
  onComplete,
}: ProjectSubmissionPageProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setUploadedUrl(null);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const uploadFile = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setUploadProgress(0);

    try {
      const ext = selectedFile.name.split('.').pop();
      const filePath = `${assignmentId}/${submissionId}/project.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('submission-files')
        .upload(filePath, selectedFile, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('submission-files')
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;

      await supabase
        .from('submissions')
        .update({ file_url: publicUrl })
        .eq('id', submissionId);

      setUploadedUrl(publicUrl);
      setUploadProgress(100);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(t('assignmentDetail.project.uploadError'));
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!uploadedUrl) {
      if (selectedFile) {
        await uploadFile();
      }
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await completeSubmission(submissionId);
      if (error) throw error;

      toast.success(t('assignmentDetail.project.awaitingReview'));
      queryClient.invalidateQueries({ queryKey: assignmentKeys.all });
      onComplete();
    } catch (error) {
      console.error('Submit error:', error);
      toast.error(t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    setUploadedUrl(null);
    setUploadProgress(0);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t('assignmentDetail.project.uploadFile')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!selectedFile ? (
          <div
            className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
              dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm font-medium">{t('assignmentDetail.project.dragDrop')}</p>
            <p className="text-xs text-muted-foreground mt-1">{t('assignmentDetail.project.fileTypes')}</p>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file);
              }}
            />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
              <FileIcon className="h-8 w-8 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
              {!uploading && (
                <Button variant="ghost" size="icon" onClick={removeFile}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {uploading && (
              <Progress value={uploadProgress} className="h-2" />
            )}

            {uploadedUrl && (
              <p className="text-sm text-green-600 font-medium">
                {t('assignmentDetail.project.fileSelected')} ✓
              </p>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          {selectedFile && !uploadedUrl && (
            <Button onClick={uploadFile} disabled={uploading} className="gap-2">
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
          {uploadedUrl && (
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              size="lg"
              className="gap-2 rounded-full shadow-md"
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
}
