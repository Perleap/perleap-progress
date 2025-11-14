import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Upload, X, Link as LinkIcon, Plus, Trash2 } from 'lucide-react';
import type { Domain, CourseMaterial } from '@/types/models';

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

      toast.success('Classroom created successfully!');
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
      toast.error(error.message || 'Error creating classroom');
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
      toast.error('Please upload a PDF file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size should be less than 10MB');
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

      toast.success('PDF uploaded successfully');
      e.target.value = ''; // Reset file input
    } catch (error) {
      toast.error('Failed to upload PDF');
      console.error(error);
    } finally {
      setUploadingMaterial(false);
    }
  };

  const handleAddLink = () => {
    if (!linkInput.trim()) {
      toast.error('Please enter a URL');
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
      toast.success('Link added');
    } catch (error) {
      toast.error('Please enter a valid URL');
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
          <DialogTitle>{t('createClassroom.title')}</DialogTitle>
          <DialogDescription>{t('createClassroom.description')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="courseTitle">{t('createClassroom.courseTitle')} *</Label>
            <Input
              id="courseTitle"
              value={formData.courseTitle}
              onChange={(e) => setFormData({ ...formData, courseTitle: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="courseDuration">{t('createClassroom.courseDuration')}</Label>
            <Input
              id="courseDuration"
              placeholder="e.g., 12 weeks, 1 semester"
              value={formData.courseDuration}
              onChange={(e) => setFormData({ ...formData, courseDuration: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="courseOutline">Course Outline (topics + flow)</Label>
            <Textarea
              id="courseOutline"
              placeholder="Describe the main topics and how they flow..."
              value={formData.courseOutline}
              onChange={(e) => setFormData({ ...formData, courseOutline: e.target.value })}
              rows={4}
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

          <div className="space-y-2">
            <Label>Key Learning Outcomes/Objectives</Label>
            {formData.learningOutcomes.map((outcome, index) => (
              <Input
                key={index}
                placeholder={`Outcome ${index + 1}`}
                value={outcome}
                onChange={(e) => handleOutcomeChange(index, e.target.value)}
              />
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addOutcome}>
              Add Outcome
            </Button>
          </div>

          <div className="space-y-2">
            <Label>Specific Challenges or Components to Highlight</Label>
            {formData.keyChallenges.map((challenge, index) => (
              <Input
                key={index}
                placeholder={`Challenge ${index + 1}`}
                value={challenge}
                onChange={(e) => handleChallengeChange(index, e.target.value)}
              />
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addChallenge}>
              Add Challenge
            </Button>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Classroom'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
