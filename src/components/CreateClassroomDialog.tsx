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
import { Upload, X } from 'lucide-react';

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
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  const [formData, setFormData] = useState({
    courseTitle: '',
    courseDuration: '',
    startDate: '',
    endDate: '',
    courseOutline: '',
    resources: '',
    learningOutcomes: ['', '', ''],
    keyChallenges: ['', ''],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      let pdfUrl = null;

      // Upload PDF if provided
      if (pdfFile) {
        const fileExt = pdfFile.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('course-materials')
          .upload(fileName, pdfFile);

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from('course-materials').getPublicUrl(fileName);

        pdfUrl = publicUrl;
      }

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
          resources: pdfUrl ? `${formData.resources}\n\nCourse PDF: ${pdfUrl}` : formData.resources,
          learning_outcomes: formData.learningOutcomes.filter((o) => o.trim()),
          key_challenges: formData.keyChallenges.filter((c) => c.trim()),
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
      });
      setPdfFile(null);
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

          <div className="space-y-2">
            <Label htmlFor="resources">Resources You Typically Use</Label>
            <Textarea
              id="resources"
              placeholder="Books, links, PDFs, tools..."
              value={formData.resources}
              onChange={(e) => setFormData({ ...formData, resources: e.target.value })}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Course PDF (optional)</Label>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept=".pdf"
                onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                className="hidden"
                id="pdf-upload"
              />
              <label htmlFor="pdf-upload" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2 px-4 py-2 border border-input rounded-2xl hover:bg-accent transition-colors">
                  <Upload className="h-4 w-4" />
                  <span className="text-sm">{pdfFile ? pdfFile.name : 'Upload course PDF'}</span>
                </div>
              </label>
              {pdfFile && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setPdfFile(null)}>
                  <X className="h-4 w-4" />
                </Button>
              )}
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
