import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Upload, X, Link as LinkIcon, Plus, Trash2, BookOpen, Calendar, Target, AlertCircle, FileText, Sparkles } from 'lucide-react';
import type { Domain, CourseMaterial } from '@/types/models';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface CreateClassroomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (classroomId: string) => void;
}

export const CreateClassroomDialog = ({
  open,
  onOpenChange,
  onSuccess,
}: CreateClassroomDialogProps) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploadingMaterial, setUploadingMaterial] = useState(false);
  const [linkInput, setLinkInput] = useState('');

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

      // Create classroom
      const { data, error } = await supabase
        .from('classrooms')
        .insert({
          teacher_id: user.id,
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
        .select()
        .single();

      if (error) throw error;

      toast.success(t('createClassroom.success.created'));
      onOpenChange(false);
      onSuccess(data.id);

      // Reset form
      setFormData({
        courseTitle: '',
        courseDuration: '',
        startDate: '',
        endDate: '',
        courseOutline: '',
        resources: '',
        learningOutcomes: ['', '', ''],
        keyChallenges: ['', ''],
        domains: [],
        materials: [],
      });
      setLinkInput('');
    } catch (error) {
      toast.error(error.message || t('createClassroom.errors.creating'));
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0 overflow-hidden rounded-3xl border-none shadow-2xl bg-white dark:bg-slate-900">
        <div className="h-2 bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400" />

        <DialogHeader className="px-8 pt-8 pb-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl">
              <Sparkles className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <DialogTitle className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              {t('createClassroom.title')}
            </DialogTitle>
          </div>
          <p className="text-slate-500 dark:text-slate-400 ml-1">
            {t('createClassroom.description')}
          </p>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-140px)] px-8 pb-8">
          <form onSubmit={handleSubmit} className="space-y-8">

            {/* Basic Info Section */}
            <div className="space-y-5 p-5 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 mb-2">
                <BookOpen className="h-5 w-5" />
                <h3 className="font-semibold">{t('createClassroom.courseBasics')}</h3>
              </div>

              <div className="space-y-2">
                <Label htmlFor="courseTitle" className="text-slate-600 dark:text-slate-300">
                  {t('createClassroom.courseTitle')} <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="courseTitle"
                  value={formData.courseTitle}
                  onChange={(e) => setFormData({ ...formData, courseTitle: e.target.value })}
                  required
                  className="rounded-xl border-slate-200 dark:border-slate-700 h-11 focus-visible:ring-indigo-500"
                  placeholder="e.g. Advanced Mathematics"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="courseDuration" className="text-slate-600 dark:text-slate-300">
                    {t('createClassroom.courseDuration')}
                  </Label>
                  <div className="relative">
                    <Input
                      id="courseDuration"
                      placeholder="e.g., 12 weeks"
                      value={formData.courseDuration}
                      onChange={(e) => setFormData({ ...formData, courseDuration: e.target.value })}
                      className="rounded-xl border-slate-200 dark:border-slate-700 h-11 pl-10"
                    />
                    <Calendar className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="startDate" className="text-slate-600 dark:text-slate-300">{t('createClassroom.startDate')}</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="rounded-xl border-slate-200 dark:border-slate-700 h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate" className="text-slate-600 dark:text-slate-300">{t('createClassroom.endDate')}</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      className="rounded-xl border-slate-200 dark:border-slate-700 h-11"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="courseOutline" className="text-slate-600 dark:text-slate-300">
                  {t('createClassroom.courseOutline')}
                </Label>
                <Textarea
                  id="courseOutline"
                  placeholder={t('createClassroom.courseOutlinePlaceholder')}
                  value={formData.courseOutline}
                  onChange={(e) => setFormData({ ...formData, courseOutline: e.target.value })}
                  rows={4}
                  className="rounded-2xl border-slate-200 dark:border-slate-700 resize-none focus-visible:ring-indigo-500"
                />
              </div>
            </div>

            {/* Subject Areas Section */}
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
                  <Target className="h-5 w-5" />
                  <h3 className="font-semibold">{t('createClassroom.subjectAreas')}</h3>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={addDomain}
                  className="rounded-full border-purple-200 text-purple-700 hover:bg-purple-50 hover:text-purple-800"
                  size="sm"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {t('createClassroom.addArea')}
                </Button>
              </div>

              {formData.domains.length === 0 && (
                <div className="text-center p-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-slate-50/50 dark:bg-slate-900/50">
                  <p className="text-slate-500 text-sm">{t('createClassroom.addAreaPrompt')}</p>
                </div>
              )}

              <div className="grid gap-4">
                {formData.domains.map((domain, domainIndex) => (
                  <div key={domainIndex} className="space-y-4 p-5 border border-purple-100 dark:border-purple-900/30 rounded-3xl bg-purple-50/30 dark:bg-purple-900/10">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center text-purple-600 font-bold text-sm">
                        {domainIndex + 1}
                      </div>
                      <Input
                        placeholder="Subject area name (e.g., Algebra)"
                        value={domain.name}
                        onChange={(e) => updateDomainName(domainIndex, e.target.value)}
                        className="flex-1 rounded-xl border-purple-200 dark:border-purple-800 bg-white dark:bg-slate-900 h-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeDomain(domainIndex)}
                        className="text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="pl-11 space-y-3">
                      <Label className="text-xs font-semibold text-purple-600 uppercase tracking-wider">{t('createClassroom.skills')}</Label>
                      <div className="grid gap-2">
                        {domain.components.map((component, componentIndex) => (
                          <div key={componentIndex} className="flex items-center gap-2">
                            <div className="h-1.5 w-1.5 rounded-full bg-purple-300" />
                            <Input
                              placeholder={`Skill ${componentIndex + 1}`}
                              value={component}
                              onChange={(e) => updateComponent(domainIndex, componentIndex, e.target.value)}
                              className="flex-1 rounded-lg border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 h-9 text-sm"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeComponent(domainIndex, componentIndex)}
                              className="h-8 w-8 text-slate-400 hover:text-red-500"
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
                        className="text-purple-600 hover:text-purple-700 hover:bg-purple-100/50 text-xs font-medium"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        {t('createClassroom.addSkill')}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Materials Section */}
            <div className="space-y-5 p-5 bg-blue-50/50 dark:bg-blue-900/10 rounded-3xl border border-blue-100 dark:border-blue-900/20">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <FileText className="h-5 w-5" />
                <h3 className="font-semibold">{t('createClassroom.courseMaterials')}</h3>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-slate-600 dark:text-slate-300">{t('createClassroom.uploadPdf')}</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="pdf-upload"
                      type="file"
                      accept="application/pdf"
                      onChange={handlePdfUpload}
                      disabled={uploadingMaterial}
                      className="h-auto py-2.5 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium text-slate-600 dark:text-slate-300">{t('createClassroom.addLink')}</Label>
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
                      className="rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                    />
                    <Button
                      type="button"
                      onClick={handleAddLink}
                      className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {formData.materials.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
                  {formData.materials.map((material, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 rounded-xl border border-blue-100 dark:border-blue-900/30 shadow-sm group">
                      <div className="h-8 w-8 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                        {material.type === 'pdf' ? (
                          <Upload className="h-4 w-4" />
                        ) : (
                          <LinkIcon className="h-4 w-4" />
                        )}
                      </div>
                      <span className="flex-1 text-sm truncate font-medium text-slate-700 dark:text-slate-300">{material.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeMaterial(index)}
                        className="h-8 w-8 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
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
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-emerald-700 dark:text-emerald-400 font-semibold">{t('createClassroom.learningOutcomes')}</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={addOutcome}
                    className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 h-8 text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" /> {t('createClassroom.add')}
                  </Button>
                </div>
                <div className="space-y-2">
                  {formData.learningOutcomes.map((outcome, index) => (
                    <Input
                      key={index}
                      placeholder={`Outcome ${index + 1}`}
                      value={outcome}
                      onChange={(e) => handleOutcomeChange(index, e.target.value)}
                      className="rounded-xl border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/30 dark:bg-emerald-900/10 focus-visible:ring-emerald-500"
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-amber-700 dark:text-amber-400 font-semibold">{t('createClassroom.keyChallenges')}</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={addChallenge}
                    className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 h-8 text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" /> {t('createClassroom.add')}
                  </Button>
                </div>
                <div className="space-y-2">
                  {formData.keyChallenges.map((challenge, index) => (
                    <Input
                      key={index}
                      placeholder={`Challenge ${index + 1}`}
                      value={challenge}
                      onChange={(e) => handleChallengeChange(index, e.target.value)}
                      className="rounded-xl border-amber-100 dark:border-amber-900/30 bg-amber-50/30 dark:bg-amber-900/10 focus-visible:ring-amber-500"
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="rounded-full px-6"
              >
                {t('createClassroom.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="rounded-full px-8 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg shadow-indigo-200 dark:shadow-none transition-all hover:scale-105"
              >
                {loading ? t('createClassroom.creating') : t('createClassroom.createButton')}
              </Button>
            </div>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
