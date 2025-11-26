import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Loader2, Upload, X, Link as LinkIcon, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import type { Domain, CourseMaterial } from '@/types/models';

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

export function EditClassroomDialog({
  open,
  onOpenChange,
  classroom,
  onSuccess,
}: EditClassroomDialogProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploadingMaterial, setUploadingMaterial] = useState(false);
  const [linkInput, setLinkInput] = useState('');
  const [formData, setFormData] = useState({
    name: classroom.name || '',
    subject: classroom.subject || '',
    course_title: classroom.course_title || '',
    course_duration: classroom.course_duration || '',
    start_date: classroom.start_date || '',
    end_date: classroom.end_date || '',
    course_outline: classroom.course_outline || '',
    resources: classroom.resources || '',
    learning_outcomes: Array.isArray(classroom.learning_outcomes)
      ? classroom.learning_outcomes.join('\n')
      : '',
    key_challenges: Array.isArray(classroom.key_challenges)
      ? classroom.key_challenges.join('\n')
      : '',
    domains: (classroom.domains || []) as Domain[],
    materials: (classroom.materials || []) as CourseMaterial[],
  });

  // Update form data when classroom prop changes
  useEffect(() => {
    setFormData({
      name: classroom.name || '',
      subject: classroom.subject || '',
      course_title: classroom.course_title || '',
      course_duration: classroom.course_duration || '',
      start_date: classroom.start_date || '',
      end_date: classroom.end_date || '',
      course_outline: classroom.course_outline || '',
      resources: classroom.resources || '',
      learning_outcomes: Array.isArray(classroom.learning_outcomes)
        ? classroom.learning_outcomes.join('\n')
        : '',
      key_challenges: Array.isArray(classroom.key_challenges)
        ? classroom.key_challenges.join('\n')
        : '',
      domains: (classroom.domains || []) as Domain[],
      materials: (classroom.materials || []) as CourseMaterial[],
    });
  }, [classroom]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const learningOutcomes = formData.learning_outcomes
        .split('\n')
        .filter((o) => o.trim())
        .map((o) => o.trim());

      const keyChallenges = formData.key_challenges
        .split('\n')
        .filter((c) => c.trim())
        .map((c) => c.trim());

      // Filter out empty domains and components
      const filteredDomains = formData.domains
        .filter(d => d.name.trim())
        .map(d => ({
          name: d.name,
          components: d.components.filter(c => c.trim())
        }))
        .filter(d => d.components.length > 0);

      const { error } = await supabase
        .from('classrooms')
        .update({
          name: formData.name,
          subject: formData.subject,
          course_title: formData.course_title,
          course_duration: formData.course_duration,
          start_date: formData.start_date || null,
          end_date: formData.end_date || null,
          course_outline: formData.course_outline,
          resources: formData.resources,
          learning_outcomes: learningOutcomes,
          key_challenges: keyChallenges,
          domains: filteredDomains,
          materials: formData.materials,
        })
        .eq('id', classroom.id);

      if (error) throw error;

      toast.success(t('editClassroom.success.saved'));
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast.error(t('editClassroom.errors.saving'));
    } finally {
      setLoading(false);
    }
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
      toast.error(t('editClassroom.errors.saving'));
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('editClassroom.title')}</DialogTitle>
          <DialogDescription>{t('editClassroom.description')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Classroom Name *</Label>
              <Input
                id="name"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">Subject *</Label>
              <Input
                id="subject"
                required
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="course_title">Course Title</Label>
            <Input
              id="course_title"
              value={formData.course_title}
              onChange={(e) => setFormData({ ...formData, course_title: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="course_duration">Course Duration</Label>
            <Input
              id="course_duration"
              placeholder="e.g., 8 weeks, 1 semester"
              value={formData.course_duration}
              onChange={(e) => setFormData({ ...formData, course_duration: e.target.value })}
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">Start Date</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end_date">End Date</Label>
              <Input
                id="end_date"
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="course_outline">Course Outline</Label>
            <Textarea
              id="course_outline"
              placeholder="Topics and flow..."
              rows={4}
              value={formData.course_outline}
              onChange={(e) => setFormData({ ...formData, course_outline: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="learning_outcomes">Learning Outcomes (one per line)</Label>
            <Textarea
              id="learning_outcomes"
              placeholder="Outcome 1&#10;Outcome 2&#10;Outcome 3"
              rows={4}
              value={formData.learning_outcomes}
              onChange={(e) => setFormData({ ...formData, learning_outcomes: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="key_challenges">Key Challenges (one per line)</Label>
            <Textarea
              id="key_challenges"
              placeholder="Challenge 1&#10;Challenge 2"
              rows={3}
              value={formData.key_challenges}
              onChange={(e) => setFormData({ ...formData, key_challenges: e.target.value })}
            />
          </div>

          <div className="space-y-3 border-t pt-4">
            <Label className="text-base">Subject Areas & Skills</Label>
            <p className="text-xs text-muted-foreground">
              Add subject areas (e.g., Algebra, Geometry) and their specific skills
            </p>

            {formData.domains.map((domain, domainIndex) => (
              <div key={domainIndex} className="space-y-2 p-3 border rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Subject area name (e.g., Algebra)"
                    value={domain.name}
                    onChange={(e) => updateDomainName(domainIndex, e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeDomain(domainIndex)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-2 ml-4">
                  <Label className="text-sm">Skills</Label>
                  {domain.components.map((component, componentIndex) => (
                    <div key={componentIndex} className="flex items-center gap-2">
                      <Input
                        placeholder={`Skill ${componentIndex + 1}`}
                        value={component}
                        onChange={(e) => updateComponent(domainIndex, componentIndex, e.target.value)}
                        className="flex-1 bg-background"
                        size="sm"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeComponent(domainIndex, componentIndex)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addComponent(domainIndex)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Skill
                  </Button>
                </div>
              </div>
            ))}

            <Button type="button" variant="outline" onClick={addDomain}>
              <Plus className="h-4 w-4 mr-2" />
              Add Subject Area
            </Button>
          </div>

          <div className="space-y-3 border-t pt-4">
            <Label className="text-base">Course Materials</Label>
            <p className="text-xs text-muted-foreground">
              Add PDFs and links that will be available for this classroom
            </p>

            {/* Display existing materials */}
            {formData.materials.length > 0 && (
              <div className="space-y-2">
                {formData.materials.map((material, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                    {material.type === 'pdf' ? (
                      <Upload className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <LinkIcon className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="flex-1 text-sm truncate">{material.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeMaterial(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* PDF Upload */}
            <div className="space-y-2">
              <Label htmlFor="pdf-upload" className="text-sm">
                Upload PDF
              </Label>
              <Input
                id="pdf-upload"
                type="file"
                accept="application/pdf"
                onChange={handlePdfUpload}
                disabled={uploadingMaterial}
              />
            </div>

            {/* Link Input */}
            <div className="space-y-2">
              <Label htmlFor="link-input" className="text-sm">
                Add Link
              </Label>
              <div className="flex gap-2">
                <Input
                  id="link-input"
                  placeholder="https://..."
                  value={linkInput}
                  onChange={(e) => setLinkInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddLink();
                    }
                  }}
                  className="flex-1"
                />
                <Button type="button" variant="outline" onClick={handleAddLink}>
                  <LinkIcon className="h-4 w-4 mr-2" />
                  Add
                </Button>
              </div>
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('editClassroom.cancel')}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('editClassroom.saveButton')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
