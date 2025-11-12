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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Sparkles, X, Upload, Link as LinkIcon } from 'lucide-react';
import { createBulkNotifications } from '@/lib/notificationService';
import { useAuth } from '@/contexts/AuthContext';

interface CreateAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classroomId: string;
  onSuccess: () => void;
  initialData?: {
    title?: string;
    instructions?: string;
    type?: string;
    due_at?: string;
    difficulty_level?: string;
    success_criteria?: string[];
    scaffolding_tips?: string;
    target_dimensions?: {
      vision: boolean;
      values: boolean;
      thinking: boolean;
      connection: boolean;
      action: boolean;
    };
  };
  assignedStudentId?: string;
  studentName?: string;
}

export function CreateAssignmentDialog({
  open,
  onOpenChange,
  classroomId,
  onSuccess,
  initialData,
  assignedStudentId,
  studentName,
}: CreateAssignmentDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploadingMaterial, setUploadingMaterial] = useState(false);
  const [linkInput, setLinkInput] = useState('');
  const [classroomDomains, setClassroomDomains] = useState<Array<{ name: string; components: string[] }>>([]);
  const [classroomMaterials, setClassroomMaterials] = useState<Array<{ type: 'pdf' | 'link'; url: string; name: string }>>([]);
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<Set<number>>(new Set());
  const [selectedDomain, setSelectedDomain] = useState<string>('');
  const [availableComponents, setAvailableComponents] = useState<string[]>([]);
  
  // AI-generated assignment metadata
  const [aiMetadata, setAiMetadata] = useState<{
    difficulty_level?: string;
    success_criteria?: string[];
    scaffolding_tips?: string;
  }>({});
  const [formData, setFormData] = useState({
    title: '',
    instructions: '',
    type: 'text_essay',
    due_at: '',
    status: 'published',
    hard_skills: [] as string[],
    hard_skill_domain: '',
    target_dimensions: {
      vision: false,
      values: false,
      thinking: false,
      connection: false,
      action: false,
    },
    personalization_flag: false,
    materials: [] as Array<{ type: 'pdf' | 'link'; url: string; name: string }>,
  });

  // Fetch classroom data for domains and materials
  useEffect(() => {
    const fetchClassroomData = async () => {
      if (!classroomId) return;
      
      try {
        const { data, error } = await supabase
          .from('classrooms')
          .select('domains, materials')
          .eq('id', classroomId)
          .single();

        if (error) throw error;

        console.log('Classroom data fetched:', data);
        if (data?.domains) {
          console.log('Found domains:', data.domains);
          setClassroomDomains(data.domains as Array<{ name: string; components: string[] }>);
        }
        if (data?.materials) {
          console.log('Found materials:', data.materials);
          setClassroomMaterials(data.materials as Array<{ type: 'pdf' | 'link'; url: string; name: string }>);
        } else {
          console.log('No materials found in classroom');
        }
      } catch (error) {
        console.error('Error fetching classroom data:', error);
      }
    };

    fetchClassroomData();
  }, [classroomId]);

  // Update form data when initial data changes
  useEffect(() => {
    if (initialData) {
      setFormData({
        title: initialData.title || '',
        instructions: initialData.instructions || '',
        type: initialData.type || 'text_essay',
        due_at: initialData.due_at || '',
        status: 'published',
        hard_skills: [] as string[],
        hard_skill_domain: '',
        target_dimensions: initialData.target_dimensions || {
          vision: false,
          values: false,
          thinking: false,
          connection: false,
          action: false,
        },
        personalization_flag: false,
        materials: [] as Array<{ type: 'pdf' | 'link'; url: string; name: string }>,
      });
      
      // Store AI metadata separately
      setAiMetadata({
        difficulty_level: initialData.difficulty_level,
        success_criteria: initialData.success_criteria,
        scaffolding_tips: initialData.scaffolding_tips,
      });
    }
  }, [initialData]);

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
        .from('assignment-materials')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from('assignment-materials').getPublicUrl(fileName);

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
      // Extract a readable name from the URL (domain + path)
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

  const handleRemoveMaterial = (index: number) => {
    setFormData({
      ...formData,
      materials: formData.materials.filter((_, i) => i !== index),
    });
  };

  const toggleClassroomMaterial = (index: number) => {
    const material = classroomMaterials[index];
    setSelectedMaterialIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
        // Remove from formData.materials
        setFormData({
          ...formData,
          materials: formData.materials.filter(m => m.url !== material.url),
        });
      } else {
        newSet.add(index);
        // Add to formData.materials
        setFormData({
          ...formData,
          materials: [...formData.materials, material],
        });
      }
      return newSet;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: assignment, error } = await supabase
        .from('assignments')
        .insert([
          {
            classroom_id: classroomId,
            title: formData.title,
            instructions: formData.instructions,
            type: formData.type as any,
            due_at: formData.due_at || null,
            status: formData.status as any,
            hard_skills: JSON.stringify(formData.hard_skills),
            hard_skill_domain: formData.hard_skill_domain || null,
            materials: JSON.stringify(formData.materials),
            target_dimensions: formData.target_dimensions as any,
            personalization_flag: formData.personalization_flag,
            assigned_student_id: assignedStudentId || null,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      // If assignment is published, notify students
      if (assignment && formData.status === 'published') {
        try {
          if (assignedStudentId) {
            // Notify only the assigned student for student-specific assignments
            await createBulkNotifications([
              {
                userId: assignedStudentId,
                type: 'assignment_created' as const,
                title: 'New Personalized Assignment',
                message: `A follow-up assignment "${formData.title}" has been created for you`,
                link: `/student/assignment/${assignment.id}`,
                metadata: {
                  assignment_id: assignment.id,
                  classroom_id: classroomId,
                  assignment_title: formData.title,
                  due_at: formData.due_at || null,
                  is_personalized: true,
                },
              },
            ]);
          } else {
            // Fetch all students enrolled in this classroom for classroom-wide assignments
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
                message: `${formData.title} has been assigned`,
                link: `/student/assignment/${assignment.id}`,
                metadata: {
                  assignment_id: assignment.id,
                  classroom_id: classroomId,
                  assignment_title: formData.title,
                  due_at: formData.due_at || null,
                },
              }));

              await createBulkNotifications(notifications);
            }
          }
        } catch (notifError) {
          // Don't fail the assignment creation if notifications fail
        }
      }

      toast.success('Assignment created successfully!');
      onSuccess();
      onOpenChange(false);
      setFormData({
        title: '',
        instructions: '',
        type: 'text_essay',
        due_at: '',
        status: 'published',
        hard_skills: [] as string[],
        hard_skill_domain: '',
        target_dimensions: {
          vision: false,
          values: false,
          thinking: false,
          connection: false,
          action: false,
        },
        personalization_flag: false,
        materials: [] as Array<{ type: 'pdf' | 'link'; url: string; name: string }>,
      });
    } catch (error) {
      toast.error('Error creating assignment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>
              {assignedStudentId ? 'Create Personalized Assignment' : 'Create Assignment'}
            </DialogTitle>
            {initialData && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                AI Generated
              </Badge>
            )}
          </div>
          <DialogDescription>
            {assignedStudentId
              ? `Creating a personalized follow-up assignment for ${studentName}`
              : 'Design a new assignment for your students'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Assignment Title *</Label>
            <Input
              id="title"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="instructions">Instructions *</Label>
            <Textarea
              id="instructions"
              required
              rows={5}
              value={formData.instructions}
              onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
            />
          </div>

          {/* AI-Generated Metadata */}
          {aiMetadata.difficulty_level && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-primary mb-2">
                <Sparkles className="h-4 w-4" />
                AI Learning Optimization
              </div>
              <p className="text-sm text-muted-foreground">
                This assignment is set at a <span className="font-medium">{aiMetadata.difficulty_level === 'gentle_start' ? 'gentle start' : aiMetadata.difficulty_level}</span> level based on the student's demonstrated abilities. 
                {aiMetadata.success_criteria && aiMetadata.success_criteria.length > 0 && (
                  <> Success criteria: {aiMetadata.success_criteria.join(', ').toLowerCase()}.</>
                )}
                {aiMetadata.scaffolding_tips && (
                  <> {aiMetadata.scaffolding_tips}</>
                )}
              </p>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">Assignment Type *</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text_essay">Text Essay</SelectItem>
                  <SelectItem value="file_upload">File Upload</SelectItem>
                  <SelectItem value="quiz">Quiz</SelectItem>
                  <SelectItem value="project">Project</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="due_at">Due Date</Label>
              <Input
                id="due_at"
                type="datetime-local"
                value={formData.due_at}
                onChange={(e) => setFormData({ ...formData, due_at: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status *</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData({ ...formData, status: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="hard_skill_domain">Area/Domain</Label>
            {classroomDomains.length > 0 ? (
              <>
                <Select
                  value={selectedDomain}
                  onValueChange={(value) => {
                    setSelectedDomain(value);
                    setFormData({ ...formData, hard_skill_domain: value });
                    // Load components for selected domain
                    const domain = classroomDomains.find(d => d.name === value);
                    if (domain) {
                      setAvailableComponents(domain.components);
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
              value={formData.hard_skill_domain}
              onChange={(e) => {
                setFormData({ ...formData, hard_skill_domain: e.target.value });
                setSelectedDomain(''); // Clear dropdown selection
              }}
            />
            <p className="text-xs text-muted-foreground">
              The subject area for hard skill assessment (required if adding K/S components)
            </p>
          </div>

          <div className="space-y-3">
            <Label className="text-base">K/S Components (Hard Skills)</Label>
            
            {/* Component selection dropdown if domain is selected */}
            {selectedDomain && availableComponents.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm">Select from {selectedDomain} components:</Label>
                <Select
                  onValueChange={(value) => {
                    // Add component if not already in the list
                    if (!formData.hard_skills.includes(value)) {
                      setFormData({ 
                        ...formData, 
                        hard_skills: [...formData.hard_skills, value] 
                      });
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
              <Label className="text-sm">Selected components:</Label>
              {formData.hard_skills.map((skill, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={skill}
                    onChange={(e) => {
                      const newSkills = [...formData.hard_skills];
                      newSkills[index] = e.target.value;
                      setFormData({ ...formData, hard_skills: newSkills });
                    }}
                    placeholder={`Component ${index + 1}`}
                    className="flex-1 bg-muted/50"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      const newSkills = formData.hard_skills.filter((_, i) => i !== index);
                      setFormData({ ...formData, hard_skills: newSkills });
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
              onClick={() =>
                setFormData({ ...formData, hard_skills: [...formData.hard_skills, ''] })
              }
            >
              Add Component Manually
            </Button>
          </div>

          <div className="space-y-3">
            <Label className="text-base">Course Materials</Label>
            <p className="text-xs text-muted-foreground">
              Add PDFs or links to course materials that will help students complete this assignment
            </p>

            {/* Select from classroom materials */}
            {classroomMaterials.length > 0 ? (
              <div className="space-y-2">
                <Label className="text-sm">Select from classroom materials:</Label>
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

            {/* Display selected materials */}
            {formData.materials.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm">Selected materials:</Label>
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
              <Label className="text-sm">Or add materials manually:</Label>
              
              {/* PDF Upload */}
              <div className="space-y-2">
                <Label htmlFor="pdf-upload" className="text-sm">
                  Upload PDF
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="pdf-upload"
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
                  <Button type="button" variant="outline" size="sm" onClick={handleAddLink}>
                    <LinkIcon className="h-4 w-4 mr-2" />
                    Add Link
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Assignment
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
