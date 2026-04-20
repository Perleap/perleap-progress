import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ExpandableTextarea } from '@/components/ui/expandable-textarea';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/useAuth';
import { toast } from 'sonner';
import {
  Upload,
  X,
  Link as LinkIcon,
  Plus,
  Trash2,
  BookOpen,
  Target,
  FileText,
  Loader2,
} from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';
import { cn } from '@/lib/utils';
import type { WizardData } from '../CreateClassroomWizard';
import type { Domain, CourseMaterial } from '@/types/models';

interface CourseBasicsStepProps {
  data: WizardData;
  onChange: (partial: Partial<WizardData>) => void;
  isRTL: boolean;
}

export const CourseBasicsStep = ({ data, onChange, isRTL }: CourseBasicsStepProps) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [uploadingMaterial, setUploadingMaterial] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [linkInput, setLinkInput] = useState('');
  const [selectedFileName, setSelectedFileName] = useState('');
  const [rephrasingCourseDescription, setRephrasingCourseDescription] = useState(false);

  // Domain helpers
  const addDomain = () => onChange({ domains: [...data.domains, { name: '', components: [''] }] });
  const removeDomain = (index: number) => onChange({ domains: data.domains.filter((_, i) => i !== index) });
  const updateDomainName = (index: number, name: string) => {
    const d = [...data.domains];
    d[index] = { ...d[index], name };
    onChange({ domains: d });
  };
  const addComponent = (di: number) => {
    const d = [...data.domains];
    d[di] = { ...d[di], components: [...d[di].components, ''] };
    onChange({ domains: d });
  };
  const removeComponent = (di: number, ci: number) => {
    const d = [...data.domains];
    d[di] = { ...d[di], components: d[di].components.filter((_, i) => i !== ci) };
    onChange({ domains: d });
  };
  const updateComponent = (di: number, ci: number, value: string) => {
    const d = [...data.domains];
    d[di].components[ci] = value;
    onChange({ domains: d });
  };

  // Outcome/Challenge helpers
  const handleOutcomeChange = (index: number, value: string) => {
    const o = [...data.learningOutcomes];
    o[index] = value;
    onChange({ learningOutcomes: o });
  };
  const addOutcome = () => onChange({ learningOutcomes: [...data.learningOutcomes, ''] });

  const handleChallengeChange = (index: number, value: string) => {
    const c = [...data.keyChallenges];
    c[index] = value;
    onChange({ keyChallenges: c });
  };
  const addChallenge = () => onChange({ keyChallenges: [...data.keyChallenges, ''] });

  // Material helpers
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.type !== 'application/pdf') {
      toast.error(t('createClassroom.errors.uploadPdf', 'Only PDF files allowed'));
      return;
    }
    setUploadingMaterial(true);
    setUploadProgress(0);
    try {
      const fileName = `${user.id}/${Date.now()}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from('course-materials')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
          onUploadProgress: (p) => setUploadProgress(Math.round((p.loaded / p.total) * 100)),
        });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('course-materials').getPublicUrl(fileName);
      onChange({ materials: [...data.materials, { type: 'pdf', url: urlData.publicUrl, name: file.name }] });
      toast.success(t('createClassroom.success.pdfUploaded', 'PDF uploaded'));
      setSelectedFileName('');
      e.target.value = '';
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploadingMaterial(false);
    }
  };

  const handleAddLink = () => {
    if (!linkInput.trim()) return;
    try {
      const url = new URL(linkInput.trim());
      const linkName = url.hostname.replace('www.', '') + (url.pathname !== '/' ? url.pathname.substring(0, 30) : '');
      onChange({ materials: [...data.materials, { type: 'link', url: linkInput.trim(), name: linkName }] });
      setLinkInput('');
    } catch {
      toast.error(t('createClassroom.errors.validUrl', 'Enter a valid URL'));
    }
  };

  const removeMaterial = (index: number) => onChange({ materials: data.materials.filter((_, i) => i !== index) });

  const handleRephraseCourseDescription = async () => {
    if (!data.courseDescription.trim()) {
      toast.error(t('createClassroom.rephraseError'));
      return;
    }
    setRephrasingCourseDescription(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('rephrase-text', {
        body: {
          text: data.courseDescription,
          language: isRTL ? 'he' : 'en',
        },
      });
      if (error) throw error;
      if (result?.rephrasedText) {
        onChange({ courseDescription: result.rephrasedText });
        toast.success(t('createClassroom.rephraseSuccess'));
      }
    } catch (err) {
      console.error(err);
      toast.error(t('createClassroom.rephraseError'));
    } finally {
      setRephrasingCourseDescription(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Basic Info */}
      <div className="space-y-6 p-6 rounded-xl border border-border shadow-sm">
        <div className={`flex items-center gap-2 text-primary mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <BookOpen className="h-5 w-5" />
          <h3 className={`font-bold text-heading ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('createClassroom.courseBasics', 'Course Basics')}
          </h3>
        </div>

        <div className="space-y-2">
          <Label htmlFor="courseTitle" className={`text-body font-medium block ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('createClassroom.courseTitle', 'Course Title')} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="courseTitle"
            value={data.courseTitle}
            onChange={(e) => onChange({ courseTitle: e.target.value })}
            required
            className="rounded-xl h-11 focus-visible:ring-primary"
            placeholder={t('createClassroom.courseTitlePlaceholder', 'e.g. Introduction to Biology')}
            autoDirection
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="startDate" className={`text-body font-medium block ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('createClassroom.startDate', 'Start Date')}
            </Label>
            <DatePicker value={data.startDate} onChange={(v) => onChange({ startDate: v })} placeholder={t('createClassroom.startDate', 'Start Date')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endDate" className={`text-body font-medium block ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('createClassroom.endDate', 'End Date')}
            </Label>
            <DatePicker value={data.endDate} onChange={(v) => onChange({ endDate: v })} placeholder={t('createClassroom.endDate', 'End Date')} />
          </div>
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="courseDescription"
            className={cn('text-body font-medium block', isRTL ? 'text-right' : 'text-left')}
          >
            {t('createClassroom.courseDescription', 'About the course')}
          </Label>
          <ExpandableTextarea
            key="course-basics-description"
            id="courseDescription"
            placeholder={t(
              'createClassroom.courseDescriptionPlaceholder',
              'Describe what students will learn, how the course runs, and what to expect…',
            )}
            value={data.courseDescription}
            onChange={(v) => onChange({ courseDescription: v })}
            className="min-h-[120px] resize-y focus-visible:ring-primary bg-muted/30"
            dir={isRTL ? 'rtl' : 'ltr'}
            autoDirection
            onRewrite={() => void handleRephraseCourseDescription()}
            isRewriting={rephrasingCourseDescription}
          />
        </div>

      </div>

      {/* Subject Areas */}
      <div className="space-y-6 p-6 rounded-xl border border-border shadow-sm">
        <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className={`flex items-center gap-2 text-primary ${isRTL ? 'flex-row-reverse' : ''}`}>
            <Target className="h-5 w-5" />
            <h3 className={`font-bold text-heading ${isRTL ? 'text-right' : 'text-left'}`}>{t('createClassroom.subjectAreas', 'Subject Areas')}</h3>
          </div>
          <Button type="button" variant="outline" onClick={addDomain} className="rounded-full border-border text-foreground hover:bg-muted" size="sm">
            <Plus className="h-4 w-4 me-1" /> {t('createClassroom.addArea', 'Add Area')}
          </Button>
        </div>
        <p className={`text-sm text-subtle mt-2 ${isRTL ? 'text-right' : 'text-left'}`}>
          {t('createClassroom.subjectAreasHelper', 'Define the subject areas and skills for this course.')}
        </p>
        {data.domains.length === 0 && (
          <div className="p-8 border-2 border-dashed border-border rounded-xl bg-muted/10">
            <p className={`text-subtle text-sm ${isRTL ? 'text-right' : 'text-left'}`}>{t('createClassroom.addAreaPrompt', 'Click "Add Area" to add a subject area')}</p>
          </div>
        )}
        <div className="grid gap-4">
          {data.domains.map((domain, di) => (
            <div key={di} className="space-y-4 p-5 border border-border rounded-xl bg-muted/5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">{di + 1}</div>
                <Input placeholder={t('createClassroom.subjectAreaPlaceholder', 'Subject area name')} value={domain.name} onChange={(e) => updateDomainName(di, e.target.value)} className="flex-1 rounded-xl h-10" autoDirection />
                <Button type="button" variant="ghost" size="icon" onClick={() => removeDomain(di)} className="text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-full">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="ps-11 space-y-3">
                <Label className={`text-xs font-bold text-primary uppercase tracking-wider block ${isRTL ? 'text-right' : 'text-left'}`}>{t('createClassroom.skills', 'Skills')}</Label>
                <div className="grid gap-2">
                  {domain.components.map((component, ci) => (
                    <div key={ci} className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary/30" />
                      <Input placeholder={t('createClassroom.skillPlaceholder', { number: ci + 1, defaultValue: `Skill ${ci + 1}` })} value={component} onChange={(e) => updateComponent(di, ci, e.target.value)} className="flex-1 rounded-lg h-9 text-sm" autoDirection />
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeComponent(di, ci)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => addComponent(di)} className="text-primary hover:text-primary/80 hover:bg-primary/5 text-xs font-semibold">
                  <Plus className="h-3 w-3 me-1" /> {t('createClassroom.addSkill', 'Add Skill')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Materials */}
      <div className="space-y-6 p-6 rounded-xl border border-border shadow-sm">
        <div className={`flex items-center gap-2 text-primary ${isRTL ? 'flex-row-reverse' : ''}`}>
          <FileText className="h-5 w-5" />
          <h3 className={`font-bold text-heading ${isRTL ? 'text-right' : 'text-left'}`}>{t('createClassroom.courseMaterials', 'Course Materials')}</h3>
        </div>
        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-3">
            <Label className={`text-sm font-medium block ${isRTL ? 'text-right' : 'text-left'}`}>{t('createClassroom.uploadPdf', 'Upload PDF')}</Label>
            <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <input id="pdf-upload-wizard" type="file" accept="application/pdf" onChange={(e) => { setSelectedFileName(e.target.files?.[0]?.name || ''); handlePdfUpload(e); }} disabled={uploadingMaterial} className="hidden" />
              <Button type="button" variant="outline" onClick={() => document.getElementById('pdf-upload-wizard')?.click()} disabled={uploadingMaterial} className="rounded-full border-border hover:bg-muted font-bold">
                {uploadingMaterial ? <><Loader2 className="h-4 w-4 animate-spin me-2" />{uploadProgress > 0 ? `${uploadProgress}%` : t('common.loading', 'Loading...')}</> : t('createClassroom.chooseFile', 'Choose File')}
              </Button>
              <span className={`text-sm text-subtle truncate max-w-[150px] ${isRTL ? 'text-right' : 'text-left'}`}>
                {selectedFileName || t('createClassroom.noFileChosen', 'No file chosen')}
              </span>
            </div>
          </div>
          <div className="space-y-3">
            <Label className={`text-sm font-medium block ${isRTL ? 'text-right' : 'text-left'}`}>{t('createClassroom.addLink', 'Add Link')}</Label>
            <div className="flex gap-2">
              <Input placeholder={t('createClassroom.linkPlaceholder', 'https://...')} value={linkInput} onChange={(e) => setLinkInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddLink(); } }} className="rounded-xl" autoDirection />
              <Button type="button" onClick={handleAddLink} className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        {data.materials.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            {data.materials.map((material, index) => (
              <div key={index} className="flex items-center gap-3 p-3 bg-muted/10 rounded-xl border border-border shadow-sm group">
                <div className="h-8 w-8 rounded-full bg-primary/5 flex items-center justify-center text-primary">
                  {material.type === 'pdf' ? <Upload className="h-4 w-4" /> : <LinkIcon className="h-4 w-4" />}
                </div>
                <span className="flex-1 text-sm truncate font-bold text-foreground">{material.name}</span>
                <Button type="button" variant="ghost" size="icon" onClick={() => removeMaterial(index)} className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Outcomes & Challenges */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-4 p-6 rounded-xl border border-border shadow-sm">
          <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <Label className={`text-foreground font-bold text-heading block ${isRTL ? 'text-right' : 'text-left'}`}>{t('createClassroom.learningOutcomes', 'Learning Outcomes')}</Label>
            <Button type="button" variant="ghost" size="sm" onClick={addOutcome} className="text-primary hover:bg-primary/5 h-8 text-xs font-bold">
              <Plus className="h-3 w-3 me-1" /> {t('createClassroom.add', 'Add')}
            </Button>
          </div>
          <div className="space-y-3">
            {data.learningOutcomes.map((outcome, index) => (
              <Input key={index} placeholder={t('createClassroom.outcomePlaceholder', { number: index + 1, defaultValue: `Outcome ${index + 1}` })} value={outcome} onChange={(e) => handleOutcomeChange(index, e.target.value)} className="rounded-xl border-border bg-background focus-visible:ring-primary" autoDirection />
            ))}
          </div>
        </div>
        <div className="space-y-4 p-6 rounded-xl border border-border shadow-sm">
          <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <Label className={`text-foreground font-bold text-heading block ${isRTL ? 'text-right' : 'text-left'}`}>{t('createClassroom.keyChallenges', 'Key Challenges')}</Label>
            <Button type="button" variant="ghost" size="sm" onClick={addChallenge} className="text-primary hover:bg-primary/5 h-8 text-xs font-bold">
              <Plus className="h-3 w-3 me-1" /> {t('createClassroom.add', 'Add')}
            </Button>
          </div>
          <div className="space-y-3">
            {data.keyChallenges.map((challenge, index) => (
              <Input key={index} placeholder={t('createClassroom.challengePlaceholder', { number: index + 1, defaultValue: `Challenge ${index + 1}` })} value={challenge} onChange={(e) => handleChallengeChange(index, e.target.value)} className="rounded-xl border-border bg-background focus-visible:ring-primary" autoDirection />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
