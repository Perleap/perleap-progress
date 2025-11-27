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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { createBulkNotifications } from '@/lib/notificationService';
import { X, Upload, Link as LinkIcon, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface Assignment {
  id: string;
  title: string;
  instructions: string;
  type: string;
  status: string;
  due_at: string | null;
  classroom_id?: string;
}

interface EditAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment: Assignment;
  onSuccess: () => void;
}

export function EditAssignmentDialog({
  open,
  onOpenChange,
  assignment,
  onSuccess,
}: EditAssignmentDialogProps) {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const [title, setTitle] = useState(assignment.title);
  const [instructions, setInstructions] = useState(assignment.instructions);
  const [type, setType] = useState(assignment.type);
  const [status, setStatus] = useState(assignment.status);
  const [dueDate, setDueDate] = useState(
    assignment.due_at ? new Date(assignment.due_at).toISOString().slice(0, 16) : ''
  );
  const [hardSkills, setHardSkills] = useState<string[]>([]);
  const [hardSkillDomain, setHardSkillDomain] = useState('');
  const [materials, setMaterials] = useState<
    Array<{ type: 'pdf' | 'link'; url: string; name: string }>
  >([]);
  const [linkInput, setLinkInput] = useState('');
  const [uploadingMaterial, setUploadingMaterial] = useState(false);
  const [loading, setLoading] = useState(false);
  const [classroomDomains, setClassroomDomains] = useState<Array<{ name: string; components: string[] }>>([]);
  const [selectedDomain, setSelectedDomain] = useState<string>('');
  const [availableComponents, setAvailableComponents] = useState<string[]>([]);
  const [classroomMaterials, setClassroomMaterials] = useState<Array<{ type: 'pdf' | 'link'; url: string; name: string }>>([]);
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<Set<number>>(new Set());

  // Fetch classroom domains and materials
  useEffect(() => {
    const fetchClassroomData = async () => {
      if (!assignment.classroom_id) return;

      try {
        const { data } = await supabase
          .from('classrooms')
          .select('domains, materials')
          .eq('id', assignment.classroom_id)
          .single();

        console.log('Classroom data fetched (Edit):', data);
        if (data?.domains) {
          console.log('Found domains (Edit):', data.domains);
          setClassroomDomains(data.domains as Array<{ name: string; components: string[] }>);
        }
        if (data?.materials) {
          console.log('Found materials (Edit):', data.materials);
          setClassroomMaterials(data.materials as Array<{ type: 'pdf' | 'link'; url: string; name: string }>);
        } else {
          console.log('No materials found in classroom (Edit)');
        }
      } catch (error) {
        console.error('Error fetching classroom data:', error);
      }
    };

    fetchClassroomData();
  }, [assignment.classroom_id]);

  // Update state when assignment changes and load hard_skills
  useEffect(() => {
    setTitle(assignment.title);
    setInstructions(assignment.instructions);
    setType(assignment.type);
    setStatus(assignment.status);
    setDueDate(assignment.due_at ? new Date(assignment.due_at).toISOString().slice(0, 16) : '');

    // Load hard_skills, hard_skill_domain, and materials from database
    const loadAssignmentData = async () => {
      const { data } = await supabase
        .from('assignments')
        .select('hard_skills, hard_skill_domain, materials')
        .eq('id', assignment.id)
        .single();

      if (data?.hard_skills) {
        try {
          const parsed = JSON.parse(data.hard_skills);
          setHardSkills(Array.isArray(parsed) ? parsed : []);
        } catch {
          setHardSkills([]);
        }
      } else {
        setHardSkills([]);
      }

      if (data?.materials) {
        try {
          // Handle both JSONB (object) and old TEXT (string) formats
          const parsed = typeof data.materials === 'string'
            ? JSON.parse(data.materials)
            : data.materials;
          setMaterials(Array.isArray(parsed) ? parsed : []);
        } catch {
          setMaterials([]);
        }
      } else {
        setMaterials([]);
      }

      const domain = data?.hard_skill_domain || '';
      setHardSkillDomain(domain);

      // If domain matches a classroom domain, set it as selected and load components
      if (domain) {
        const matchedDomain = classroomDomains.find(d => d.name === domain);
        if (matchedDomain) {
          setSelectedDomain(domain);
          setAvailableComponents(matchedDomain.components);
        }
      }
    };

    loadAssignmentData();
  }, [assignment, classroomDomains]);

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error(t('createAssignment.errors.creating'));
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
        .from('assignment-materials')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from('assignment-materials').getPublicUrl(fileName);

      setMaterials([...materials, { type: 'pdf', url: publicUrl, name: file.name }]);
      toast.success(t('createClassroom.success.pdfUploaded'));
      e.target.value = ''; // Reset file input
    } catch (error) {
      toast.error(t('editAssignment.errors.saving'));
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
      const url = new URL(linkInput.trim());
      const linkName =
        url.hostname.replace('www.', '') +
        (url.pathname !== '/' ? url.pathname.substring(0, 30) : '');

      setMaterials([
        ...materials,
        {
          type: 'link',
          url: linkInput.trim(),
          name: linkName || linkInput.trim(),
        },
      ]);
      setLinkInput('');
      toast.success(t('createClassroom.success.linkAdded'));
    } catch (error) {
      toast.error(t('createClassroom.errors.validUrl'));
    }
  };

  const handleRemoveMaterial = (index: number) => {
    setMaterials(materials.filter((_, i) => i !== index));
  };

  const toggleClassroomMaterial = (index: number) => {
    const newSelected = new Set(selectedMaterialIds);
    if (newSelected.has(index)) {
      // Remove from selection and materials
      newSelected.delete(index);
      const materialToRemove = classroomMaterials[index];
      setMaterials(materials.filter(m => !(m.url === materialToRemove.url && m.name === materialToRemove.name)));
    } else {
      // Add to selection and materials
      newSelected.add(index);
      const materialToAdd = classroomMaterials[index];
      // Check if already exists to avoid duplicates
      if (!materials.some(m => m.url === materialToAdd.url && m.name === materialToAdd.name)) {
        setMaterials([...materials, materialToAdd]);
      }
    }
    setSelectedMaterialIds(newSelected);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Check if status is changing from draft to published
      const wasPublished = assignment.status === 'draft' && status === 'published';

      const { error } = await supabase
        .from('assignments')
        .update({
          title,
          instructions,
          type: type as any,
          status: status as any,
          due_at: dueDate || null,
          hard_skills: JSON.stringify(hardSkills),
          hard_skill_domain: hardSkillDomain || null,
          materials: materials, // JSONB column - pass as object, not stringified
        })
        .eq('id', assignment.id);

      if (error) throw error;

      // If assignment was just published, notify all enrolled students
      if (wasPublished) {
        try {
          // Get classroom_id if not already provided
          let classroomId = assignment.classroom_id;
          if (!classroomId) {
            const { data: assignmentData } = await supabase
              .from('assignments')
              .select('classroom_id')
              .eq('id', assignment.id)
              .single();
            classroomId = assignmentData?.classroom_id;
          }

          if (classroomId) {
            // Fetch all students enrolled in this classroom
            const { data: enrollments, error: enrollError } = await supabase
              .from('enrollments')
              .select('student_id')
              .eq('classroom_id', classroomId);

            if (!enrollError && enrollments && enrollments.length > 0) {
              // Create notifications for all enrolled students
              const notifications = enrollments.map((enrollment) => ({
                userId: enrollment.student_id,
                type: 'assignment_created' as const,
                title: 'New Assignment Posted',
                message: `${title} has been assigned`,
                link: `/student/assignment/${assignment.id}`,
                metadata: {
                  assignment_id: assignment.id,
                  classroom_id: classroomId,
                  assignment_title: title,
                  due_at: dueDate || null,
                },
              }));

              await createBulkNotifications(notifications);
            }
          }
        } catch (notifError) {
          // Don't fail the assignment update if notifications fail
        }
      }

      toast.success(t('editAssignment.success.saved'));
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast.error(t('editAssignment.errors.saving'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir={isRTL ? 'rtl' : 'ltr'} className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('editAssignment.title')}</DialogTitle>
          <DialogDescription>{t('editAssignment.description')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title" className={`block ${isRTL ? 'text-right' : 'text-left'}`}>Assignment Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Essay on Photosynthesis"
              required
              autoDirection
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="instructions" className={`block ${isRTL ? 'text-right' : 'text-left'}`}>Instructions</Label>
            <Textarea
              id="instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Provide detailed instructions for the assignment..."
              rows={6}
              required
              autoDirection
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type" className={`block ${isRTL ? 'text-right' : 'text-left'}`}>Assignment Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text_essay">Text Essay</SelectItem>
                  <SelectItem value="interactive">Interactive</SelectItem>
                  <SelectItem value="project">Project</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status" className={`block ${isRTL ? 'text-right' : 'text-left'}`}>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dueDate" className={`block ${isRTL ? 'text-right' : 'text-left'}`}>Due Date (Optional)</Label>
            <Input
              id="dueDate"
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="hard_skill_domain" className={`block ${isRTL ? 'text-right' : 'text-left'}`}>Subject Area</Label>
            {classroomDomains.length > 0 ? (
              <>
                <Select
                  value={selectedDomain}
                  onValueChange={(value) => {
                    setSelectedDomain(value);
                    setHardSkillDomain(value);
                    // Load components for selected domain
                    const domain = classroomDomains.find(d => d.name === value);
                    if (domain) {
                      setAvailableComponents(domain.components);
                      // Don't auto-fill, let user select from dropdown
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select from classroom domains" />
                  </SelectTrigger>
                  <SelectContent>
                    {classroomDomains.map((domain, index) => (
                      <SelectItem key={index} value={domain.name}>
                        {domain.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Or enter manually below</p>
              </>
            ) : null}
            <Input
              id="hard_skill_domain"
              placeholder="e.g., Algebra, Geometry, Calculus, Literature"
              value={hardSkillDomain}
              onChange={(e) => {
                setHardSkillDomain(e.target.value);
                setSelectedDomain(''); // Clear dropdown selection
              }}
              autoDirection
            />
            <p className="text-xs text-muted-foreground">
              The subject area for hard skill assessment (required if adding skills)
            </p>
          </div>

          <div className="space-y-3">
            <Label className={`text-base block ${isRTL ? 'text-right' : 'text-left'}`}>Skills to Assess</Label>
            <p className="text-sm text-muted-foreground">
              Specific skills or topics that will be assessed in this assignment.
            </p>

            {/* Component selection dropdown if domain is selected */}
            {selectedDomain && availableComponents.length > 0 && (
              <div className="space-y-2">
                <Label className={`text-sm block ${isRTL ? 'text-right' : 'text-left'}`}>Select from {selectedDomain} skills:</Label>
                <Select
                  onValueChange={(value) => {
                    // Add component if not already in the list
                    if (!hardSkills.includes(value)) {
                      setHardSkills([...hardSkills, value]);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a component to add" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableComponents.map((component, index) => (
                      <SelectItem key={index} value={component}>
                        {component}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label className={`text-sm block ${isRTL ? 'text-right' : 'text-left'}`}>Selected skills:</Label>
              {hardSkills.map((skill, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={skill}
                    onChange={(e) => {
                      const newSkills = [...hardSkills];
                      newSkills[index] = e.target.value;
                      setHardSkills(newSkills);
                    }}
                    placeholder={`Skill ${index + 1}`}
                    className="flex-1 bg-muted/50"
                    autoDirection
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      const newSkills = hardSkills.filter((_, i) => i !== index);
                      setHardSkills(newSkills);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setHardSkills([...hardSkills, ''])}
            >
              Add Skill Manually
            </Button>
          </div>

          <div className="space-y-3">
            <Label className={`text-base block ${isRTL ? 'text-right' : 'text-left'}`}>Course Materials</Label>
            <p className="text-xs text-muted-foreground">
              Add PDFs or links to course materials that will help students complete this assignment
            </p>

            {/* Select from classroom materials */}
            {classroomMaterials.length > 0 ? (
              <div className="space-y-2">
                <Label className={`text-sm block ${isRTL ? 'text-right' : 'text-left'}`}>Select from classroom materials:</Label>
                <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
                  {classroomMaterials.map((material, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Checkbox
                        id={`classroom-material-${index}`}
                        checked={selectedMaterialIds.has(index)}
                        onCheckedChange={() => toggleClassroomMaterial(index)}
                      />
                      <label
                        htmlFor={`classroom-material-${index}`}
                        className="flex-1 flex items-center gap-2 text-sm cursor-pointer"
                      >
                        {material.type === 'pdf' ? (
                          <Upload className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        ) : (
                          <LinkIcon className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        )}
                        <span className="truncate">{material.name}</span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="border rounded-md p-3 bg-muted/30">
                <p className="text-xs text-muted-foreground text-center">
                  No materials available in this classroom. Add materials to the classroom first or add them manually below.
                </p>
              </div>
            )}

            {/* Display existing materials */}
            {materials.length > 0 && (
              <div className="space-y-2">
                <Label className={`text-sm block ${isRTL ? 'text-right' : 'text-left'}`}>Selected materials:</Label>
                {materials.map((material, index) => (
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
                      onClick={() => handleRemoveMaterial(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Manual addition section */}
            <div className="border-t pt-3 space-y-3">
              <Label className={`text-sm block ${isRTL ? 'text-right' : 'text-left'}`}>Or add materials manually:</Label>

              {/* PDF Upload */}
              <div className="space-y-2">
                <Label htmlFor="pdf-upload-edit" className={`text-sm block ${isRTL ? 'text-right' : 'text-left'}`}>
                  Upload PDF
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="pdf-upload-edit"
                    type="file"
                    accept="application/pdf"
                    onChange={handlePdfUpload}
                    disabled={uploadingMaterial}
                    className="flex-1"
                  />
                  {uploadingMaterial && <Loader2 className="h-4 w-4 animate-spin" />}
                </div>
              </div>

              {/* Link Input */}
              <div className="space-y-2">
                <Label htmlFor="link-input-edit" className={`text-sm block ${isRTL ? 'text-right' : 'text-left'}`}>
                  Add Link
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="link-input-edit"
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
                    autoDirection
                  />
                  <Button type="button" variant="outline" size="sm" onClick={handleAddLink}>
                    <LinkIcon className="h-4 w-4 me-2" />
                    Add Link
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              {t('editAssignment.cancel')}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? t('editAssignment.saving') : t('editAssignment.saveButton')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
