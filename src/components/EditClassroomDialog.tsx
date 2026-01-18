import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Upload, X, Link as LinkIcon, Plus, Trash2, BookOpen, Calendar, Target, Sparkles, FileText, Loader2 } from 'lucide-react';
import type { Domain, CourseMaterial } from '@/types/models';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Classroom {
  id: string;
  name: string;
  subject: string;
  course_title: string;
  course_duration: string;
  start_date: string;
  end_date: string;
  course_outline: string;
  resources: string;
  learning_outcomes: string[] | null;
  key_challenges: string[] | null;
  domains: Domain[] | null;
  materials: CourseMaterial[] | null;
}

interface EditClassroomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classroom: Classroom;
  onSuccess: () => void;
}

export const EditClassroomDialog = ({
  open,
  onOpenChange,
  classroom,
  onSuccess,
}: EditClassroomDialogProps) => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploadingMaterial, setUploadingMaterial] = useState(false);
  const [linkInput, setLinkInput] = useState('');
  const [selectedFileName, setSelectedFileName] = useState('');
  const [rephrasingOutline, setRephrasingOutline] = useState(false);
  const [originalOutline, setOriginalOutline] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    courseTitle: '',
    courseDuration: '',
    startDate: '',
    endDate: '',
    courseOutline: '',
    resources: '',
    learningOutcomes: ['', '', ''],
    keyChallenges: ['', ''],
    domains: [] as Domain[],
    materials: [] as CourseMaterial[],
  });

  useEffect(() => {
    if (open && classroom) {
      setFormData({
        courseTitle: classroom.course_title || classroom.name || '',
        courseDuration: classroom.course_duration || '',
        startDate: classroom.start_date || '',
        endDate: classroom.end_date || '',
        courseOutline: classroom.course_outline || '',
        resources: classroom.resources || '',
        learningOutcomes: (classroom.learning_outcomes && classroom.learning_outcomes.length > 0)
          ? classroom.learning_outcomes
          : ['', '', ''],
        keyChallenges: (classroom.key_challenges && classroom.key_challenges.length > 0)
          ? classroom.key_challenges
          : ['', ''],
        domains: (classroom.domains || []) as Domain[],
        materials: (classroom.materials || []) as CourseMaterial[],
      });
    }
  }, [open, classroom?.id]); // Only re-run when open state changes or classroom ID changes

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      // Filter out empty domains and components
      const filteredDomains = formData.domains
        .filter(d => d.name.trim())
        .map(d => ({
          name: d.name,
          components: d.components.filter(c => c.trim())
        }))
        .filter(d => d.components.length > 0);

      // Update classroom
      const { error } = await supabase
        .from('classrooms')
        .update({
          name: formData.courseTitle || 'New Classroom',
          subject: formData.courseTitle || 'General',
          course_title: formData.courseTitle,
          course_duration: formData.courseDuration,
          start_date: formData.startDate || null,
          end_date: formData.endDate || null,
          course_outline: formData.courseOutline,
          resources: formData.resources,
          learning_outcomes: formData.learningOutcomes.filter((o) => o.trim()),
          key_challenges: formData.keyChallenges.filter((c) => c.trim()),
          domains: filteredDomains,
          materials: formData.materials,
        })
        .eq('id', classroom.id);

      if (error) throw error;

      toast.success(t('editClassroom.success.saved'));
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || t('editClassroom.errors.saving'));
    } finally {
      setLoading(false);
    }
  };

  const handleOutcomeChange = (index: number, value: string) => {
    const newOutcomes = [...formData.learningOutcomes];
    newOutcomes[index] = value;
    setFormData({ ...formData, learningOutcomes: newOutcomes });
  };

  const addOutcome = () => {
    setFormData({ ...formData, learningOutcomes: [...formData.learningOutcomes, ''] });
  };

  const handleChallengeChange = (index: number, value: string) => {
    const newChallenges = [...formData.keyChallenges];
    newChallenges[index] = value;
    setFormData({ ...formData, keyChallenges: newChallenges });
  };

  const addChallenge = () => {
    setFormData({ ...formData, keyChallenges: [...formData.keyChallenges, ''] });
  };

  // Domain management functions
  const addDomain = () => {
    setFormData({
      ...formData,
      domains: [...formData.domains, { name: '', components: [''] }],
    });
  };

  const removeDomain = (index: number) => {
    const newDomains = formData.domains.filter((_, i) => i !== index);
    setFormData({ ...formData, domains: newDomains });
  };

  const updateDomainName = (index: number, name: string) => {
    const newDomains = [...formData.domains];
    newDomains[index] = { ...newDomains[index], name };
    setFormData({ ...formData, domains: newDomains });
  };

  const addComponent = (domainIndex: number) => {
    const newDomains = [...formData.domains];
    newDomains[domainIndex].components.push('');
    setFormData({ ...formData, domains: newDomains });
  };

  const removeComponent = (domainIndex: number, componentIndex: number) => {
    const newDomains = [...formData.domains];
    newDomains[domainIndex].components = newDomains[domainIndex].components.filter(
      (_, i) => i !== componentIndex
    );
    setFormData({ ...formData, domains: newDomains });
  };

  const updateComponent = (domainIndex: number, componentIndex: number, value: string) => {
    const newDomains = [...formData.domains];
    newDomains[domainIndex].components[componentIndex] = value;
    setFormData({ ...formData, domains: newDomains });
  };

  // Material management functions
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error(t('createClassroom.errors.uploadPdf'));
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error(t('createClassroom.errors.fileSize'));
      return;
    }

    setUploadingMaterial(true);
    try {
      const fileExt = 'pdf';
      const fileName = `${user!.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('course-materials')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from('course-materials').getPublicUrl(fileName);

      setFormData({
        ...formData,
        materials: [...formData.materials, { type: 'pdf', url: publicUrl, name: file.name }],
      });

      toast.success(t('createClassroom.success.pdfUploaded'));
      e.target.value = ''; // Reset file input
    } catch (error) {
      toast.error(t('createClassroom.errors.creating'));
      console.error(error);
    } finally {
      setUploadingMaterial(false);
    }
  };

  const handleAddLink = () => {
    if (!linkInput.trim()) {
      toast.error(t('createClassroom.errors.enterUrl'));
      return;
    }

    try {
      const url = new URL(linkInput.trim()); // Validate URL
      const linkName =
        url.hostname.replace('www.', '') +
        (url.pathname !== '/' ? url.pathname.substring(0, 30) : '');

      setFormData({
        ...formData,
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
    } catch (error) {
      toast.error(t('createClassroom.errors.validUrl'));
    }
  };

  const removeMaterial = (index: number) => {
    setFormData({
      ...formData,
      materials: formData.materials.filter((_, i) => i !== index),
    });
  };

  const handleRephraseOutline = async () => {
    if (!formData.courseOutline.trim()) {
      toast.error(t('createClassroom.rephraseError'));
      return;
    }

    setRephrasingOutline(true);
    setOriginalOutline(formData.courseOutline);
    try {
      const { data, error } = await supabase.functions.invoke('rephrase-text', {
        body: {
          text: formData.courseOutline,
          language: isRTL ? 'he' : 'en',
        },
      });

      if (error) throw error;

      if (data?.rephrasedText) {
        setFormData({ ...formData, courseOutline: data.rephrasedText });
        toast.success(t('createClassroom.rephraseSuccess'));
      }
    } catch (error) {
      console.error('Error rephrasing text:', error);
      toast.error(t('createClassroom.rephraseError'));
    } finally {
      setRephrasingOutline(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir={isRTL ? 'rtl' : 'ltr'} className="sm:max-w-6xl max-h-[90vh] p-0 overflow-hidden rounded-xl border-none shadow-2xl bg-background">
        <DialogHeader className="px-8 pt-8 pb-6 bg-gradient-to-br from-muted/20 to-transparent">
          <div className="flex items-center gap-3 mb-2">
            <DialogTitle className="text-2xl md:text-3xl font-bold tracking-tight text-heading">
              {t('editClassroom.title')}
            </DialogTitle>
          </div>
          <p className={`text-subtle text-body ms-1 ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('editClassroom.description')}
          </p>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-160px)] px-8 pb-8">
          <form onSubmit={handleSubmit} className="space-y-8 pt-4">

            {/* Basic Info Section */}
            <div className="space-y-6 p-6 rounded-xl border border-border shadow-sm">
              <div className={`flex items-center gap-2 text-primary mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <BookOpen className="h-5 w-5" />
                <h3 className={`font-bold text-heading ${isRTL ? 'text-right' : 'text-left'}`}>{t('createClassroom.courseBasics')}</h3>
              </div>

              <div className="space-y-2">
                <Label htmlFor="courseTitle" className={`text-body font-medium block ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('createClassroom.courseTitle')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="courseTitle"
                  value={formData.courseTitle}
                  onChange={(e) => setFormData({ ...formData, courseTitle: e.target.value })}
                  required
                  className="rounded-xl h-11 focus-visible:ring-primary"
                  placeholder={t('createClassroom.courseTitlePlaceholder')}
                  autoDirection
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="courseDuration" className={`text-body font-medium block ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('createClassroom.courseDuration')}
                  </Label>
                  <div className="relative">
                    <Input
                      id="courseDuration"
                      placeholder={t('createClassroom.courseDurationPlaceholder')}
                      value={formData.courseDuration}
                      onChange={(e) => setFormData({ ...formData, courseDuration: e.target.value })}
                      className="rounded-xl h-11 ps-10"
                      autoDirection
                    />
                    <Calendar className="absolute start-3 top-3 h-5 w-5 text-muted-foreground" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate" className={`text-body font-medium block ${isRTL ? 'text-right' : 'text-left'}`}>{t('createClassroom.startDate')}</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="rounded-xl h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate" className={`text-body font-medium block ${isRTL ? 'text-right' : 'text-left'}`}>{t('createClassroom.endDate')}</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      className="rounded-xl h-11"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className={`flex items-center justify-between gap-4 mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <Label htmlFor="courseOutline" className={`text-body font-medium mb-0 ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('createClassroom.courseOutline')}
                  </Label>
                  <div className="flex gap-2">
                    {originalOutline !== null && originalOutline !== formData.courseOutline && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setFormData({ ...formData, courseOutline: originalOutline });
                          setOriginalOutline(null);
                        }}
                        className={`rounded-full text-xs font-semibold text-muted-foreground hover:text-foreground ${isRTL ? 'flex-row-reverse' : ''}`}
                      >
                        {t('common.undo')}
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleRephraseOutline}
                      disabled={!formData.courseOutline.trim() || rephrasingOutline}
                      className={`rounded-full text-xs font-semibold ${isRTL ? 'flex-row-reverse' : ''}`}
                    >
                      {rephrasingOutline ? (
                        <>
                          <Loader2 className={`h-3 w-3 animate-spin ${isRTL ? 'ms-1' : 'me-1'}`} />
                          {t('createClassroom.rephrasing')}
                        </>
                      ) : (
                        <>
                          <Sparkles className={`h-3 w-3 ${isRTL ? 'ms-1' : 'me-1'}`} />
                          {t('createClassroom.rephraseButton')}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                <Textarea
                  id="courseOutline"
                  placeholder={t('createClassroom.courseOutlinePlaceholder')}
                  value={formData.courseOutline}
                  onChange={(e) => setFormData({ ...formData, courseOutline: e.target.value })}
                  rows={4}
                  className="rounded-xl resize-none focus-visible:ring-primary"
                  autoDirection
                />
              </div>
            </div>

            {/* Subject Areas Section */}
            <div className="space-y-6 p-6 rounded-xl border border-border shadow-sm">
              <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div className={`flex items-center gap-2 text-primary ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <Target className="h-5 w-5" />
                  <h3 className={`font-bold text-heading ${isRTL ? 'text-right' : 'text-left'}`}>{t('createClassroom.subjectAreas')}</h3>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={addDomain}
                  className="rounded-full border-border text-foreground hover:bg-muted"
                  size="sm"
                >
                  <Plus className="h-4 w-4 me-1" />
                  {t('createClassroom.addArea')}
                </Button>
              </div>
              
              <p className={`text-sm text-subtle mt-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('editClassroom.subjectAreasHelper')}
              </p>

              {formData.domains.length === 0 && (
                <div className="p-8 border-2 border-dashed border-border rounded-xl bg-muted/10">
                  <p className={`text-subtle text-sm ${isRTL ? 'text-right' : 'text-left'}`}>{t('createClassroom.addAreaPrompt')}</p>
                </div>
              )}

              <div className="grid gap-4">
                {formData.domains.map((domain, domainIndex) => (
                  <div key={domainIndex} className="space-y-4 p-5 border border-border rounded-xl bg-muted/5 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                        {domainIndex + 1}
                      </div>
                      <Input
                        placeholder={t('createClassroom.subjectAreaPlaceholder')}
                        value={domain.name}
                        onChange={(e) => updateDomainName(domainIndex, e.target.value)}
                        className="flex-1 rounded-xl h-10"
                        autoDirection
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeDomain(domainIndex)}
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-full"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="ps-11 space-y-3">
                      <Label className={`text-xs font-bold text-primary uppercase tracking-wider block ${isRTL ? 'text-right' : 'text-left'}`}>{t('createClassroom.skills')}</Label>
                      <div className="grid gap-2">
                        {domain.components.map((component, componentIndex) => (
                          <div key={componentIndex} className="flex items-center gap-2">
                            <div className="h-1.5 w-1.5 rounded-full bg-primary/30" />
                            <Input
                              placeholder={t('createClassroom.skillPlaceholder', { number: componentIndex + 1 })}
                              value={component}
                              onChange={(e) => updateComponent(domainIndex, componentIndex, e.target.value)}
                              className="flex-1 rounded-lg h-9 text-sm"
                              autoDirection
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeComponent(domainIndex, componentIndex)}
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => addComponent(domainIndex)}
                        className="text-primary hover:text-primary/80 hover:bg-primary/5 text-xs font-semibold"
                      >
                        <Plus className="h-3 w-3 me-1" />
                        {t('createClassroom.addSkill')}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Materials Section */}
            <div className="space-y-6 p-6 rounded-xl border border-border shadow-sm">
              <div className={`flex items-center gap-2 text-primary ${isRTL ? 'flex-row-reverse' : ''}`}>
                <FileText className="h-5 w-5" />
                <h3 className={`font-bold text-heading ${isRTL ? 'text-right' : 'text-left'}`}>{t('createClassroom.courseMaterials')}</h3>
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <Label className={`text-sm font-medium block ${isRTL ? 'text-right' : 'text-left'}`}>{t('createClassroom.uploadPdf')}</Label>
                  <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <input
                      id="pdf-upload"
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        setSelectedFileName(file?.name || '');
                        handlePdfUpload(e);
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
                      {t('createClassroom.chooseFile')}
                    </Button>
                    <span className={`text-sm text-subtle truncate max-w-[150px] ${isRTL ? 'text-right' : 'text-left'}`}>
                      {selectedFileName || t('createClassroom.noFileChosen')}
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className={`text-sm font-medium block ${isRTL ? 'text-right' : 'text-left'}`}>{t('createClassroom.addLink')}</Label>
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
                    <div key={index} className="flex items-center gap-3 p-3 bg-muted/10 rounded-xl border border-border shadow-sm group">
                      <div className="h-8 w-8 rounded-full bg-primary/5 flex items-center justify-center text-primary">
                        {material.type === 'pdf' ? (
                          <Upload className="h-4 w-4" />
                        ) : (
                          <LinkIcon className="h-4 w-4" />
                        )}
                      </div>
                      <span className="flex-1 text-sm truncate font-bold text-foreground">{material.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeMaterial(index)}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      >
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
                  <Label className={`text-foreground font-bold text-heading block ${isRTL ? 'text-right' : 'text-left'}`}>{t('createClassroom.learningOutcomes')}</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={addOutcome}
                    className="text-primary hover:bg-primary/5 h-8 text-xs font-bold"
                  >
                    <Plus className="h-3 w-3 me-1" /> {t('createClassroom.add')}
                  </Button>
                </div>
                <div className="space-y-3">
                  {formData.learningOutcomes.map((outcome, index) => (
                    <Input
                      key={index}
                      placeholder={t('createClassroom.outcomePlaceholder', { number: index + 1 })}
                      value={outcome}
                      onChange={(e) => handleOutcomeChange(index, e.target.value)}
                      className="rounded-xl border-border bg-background focus-visible:ring-primary"
                      autoDirection
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-4 p-6 rounded-xl border border-border shadow-sm">
                <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <Label className={`text-foreground font-bold text-heading block ${isRTL ? 'text-right' : 'text-left'}`}>{t('createClassroom.keyChallenges')}</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={addChallenge}
                    className="text-primary hover:bg-primary/5 h-8 text-xs font-bold"
                  >
                    <Plus className="h-3 w-3 me-1" /> {t('createClassroom.add')}
                  </Button>
                </div>
                <div className="space-y-3">
                  {formData.keyChallenges.map((challenge, index) => (
                    <Input
                      key={index}
                      placeholder={t('createClassroom.challengePlaceholder', { number: index + 1 })}
                      value={challenge}
                      onChange={(e) => handleChallengeChange(index, e.target.value)}
                      className="rounded-xl border-border bg-background focus-visible:ring-primary"
                      autoDirection
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="rounded-full px-6 font-bold"
              >
                {t('createClassroom.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="rounded-full px-10 font-bold shadow-lg shadow-primary/20"
              >
                {loading ? t('editClassroom.saving') : t('editClassroom.saveButton')}
              </Button>
            </div>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
