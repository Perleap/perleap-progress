import { Eye, FileText, Link as LinkIcon, Loader2, Plus, Upload, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { ClassroomFormSectionProps } from '../classroomFormTypes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/useAuth';
import { uploadCourseMaterialPdf } from '@/services/classroomService';
import { openOrDownloadMaterial } from '@/services/materialService';
import { COURSE_MATERIALS_BUCKET } from '@/utils/storageUrls';

export const ClassroomMaterialsSection = ({
  formData,
  onFormChange,
}: ClassroomFormSectionProps) => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const [uploadingMaterial, setUploadingMaterial] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [linkInput, setLinkInput] = useState('');
  const [selectedFileName, setSelectedFileName] = useState('');

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.type !== 'application/pdf') {
      toast.error(t('createClassroom.errors.uploadPdf'));
      return;
    }

    setUploadingMaterial(true);
    setUploadProgress(0);

    try {
      const { filePath, displayName } = await uploadCourseMaterialPdf(user.id, file, (percentage) =>
        setUploadProgress(percentage)
      );

      onFormChange({
        materials: [...formData.materials, { type: 'pdf', file_path: filePath, name: displayName }],
      });

      toast.success(t('createClassroom.success.pdfUploaded'));
      setSelectedFileName('');
      e.target.value = '';
    } catch (error: unknown) {
      console.error('Detailed upload error:', error);
      toast.error(
        `${t('createClassroom.errors.creating')}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setUploadingMaterial(false);
      setUploadProgress(0);
    }
  };

  const handleAddLink = () => {
    if (!linkInput.trim()) {
      toast.error(t('createClassroom.errors.enterUrl'));
      return;
    }

    try {
      const url = new URL(linkInput.trim());
      const linkName =
        url.hostname.replace('www.', '') +
        (url.pathname !== '/' ? url.pathname.substring(0, 30) : '');

      onFormChange({
        materials: [
          ...formData.materials,
          {
            type: 'link',
            url: linkInput.trim(),
            name: linkName || linkInput.trim(),
          },
        ],
      });
      setLinkInput('');
      toast.success(t('createClassroom.success.linkAdded'));
    } catch {
      toast.error(t('createClassroom.errors.validUrl'));
    }
  };

  const removeMaterial = (index: number) => {
    onFormChange({ materials: formData.materials.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-6 p-6 rounded-xl border border-border shadow-sm">
      <div className={`flex items-center gap-2 text-primary ${isRTL ? 'flex-row-reverse' : ''}`}>
        <FileText className="h-5 w-5" />
        <h3 className={`font-bold text-heading ${isRTL ? 'text-right' : 'text-left'}`}>
          {t('createClassroom.courseMaterials')}
        </h3>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-3">
          <Label className={`text-sm font-medium block ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('createClassroom.uploadPdf')}
          </Label>
          <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <input
              id="pdf-upload"
              type="file"
              accept="application/pdf"
              onChange={(e) => {
                const file = e.target.files?.[0];
                setSelectedFileName(file?.name || '');
                void handlePdfUpload(e);
              }}
              disabled={uploadingMaterial}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => document.getElementById('pdf-upload')?.click()}
              disabled={uploadingMaterial}
              className="rounded-full border-border hover:bg-muted font-bold"
            >
              {uploadingMaterial ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin me-2" />
                  {uploadProgress > 0 ? `${uploadProgress}%` : t('common.loading')}
                </>
              ) : (
                t('createClassroom.chooseFile')
              )}
            </Button>
            <span
              className={`text-sm text-subtle truncate max-w-[150px] ${isRTL ? 'text-right' : 'text-left'}`}
            >
              {selectedFileName || t('createClassroom.noFileChosen')}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <Label className={`text-sm font-medium block ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('createClassroom.addLink')}
          </Label>
          <div className="flex gap-2">
            <Input
              placeholder={t('createClassroom.linkPlaceholder')}
              value={linkInput}
              onChange={(e) => setLinkInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddLink();
                }
              }}
              className="rounded-xl"
              autoDirection
            />
            <Button
              type="button"
              onClick={handleAddLink}
              className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {formData.materials.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          {formData.materials.map((material, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-3 bg-muted/10 rounded-xl border border-border shadow-sm group"
            >
              <div className="h-8 w-8 rounded-full bg-primary/5 flex items-center justify-center text-primary">
                {material.type === 'pdf' ? (
                  <Upload className="h-4 w-4" />
                ) : (
                  <LinkIcon className="h-4 w-4" />
                )}
              </div>
              <span className="flex-1 text-sm truncate font-bold text-foreground">
                {material.name}
              </span>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => void openOrDownloadMaterial(material, COURSE_MATERIALS_BUCKET)}
                  className="h-8 w-8 text-muted-foreground hover:text-primary"
                  title={t('common.view')}
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeMaterial(index)}
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
