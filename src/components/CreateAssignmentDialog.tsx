import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
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
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { Loader2, Sparkles, X, Upload, Link as LinkIcon, BookOpen, Calendar, Target, FileText, Plus, Trash2, Eye } from 'lucide-react';
import { createBulkNotifications } from '@/lib/notificationService';
import { useAuth } from '@/contexts/AuthContext';
import { ScrollArea } from '@/components/ui/scroll-area';

console.log('FILE_LOAD: CreateAssignmentDialog.tsx loaded');

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
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploadingMaterial, setUploadingMaterial] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [linkInput, setLinkInput] = useState('');
  const [classroomDomains, setClassroomDomains] = useState<Array<{ name: string; components: string[] }>>([]);
  const [classroomMaterials, setClassroomMaterials] = useState<Array<{ type: 'pdf' | 'link'; url: string; name: string }>>([]);
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<Set<number>>(new Set());
  const [selectedDomain, setSelectedDomain] = useState<string>('');
  const [availableComponents, setAvailableComponents] = useState<string[]>([]);
  const [rephrasingInstructions, setRephrasingInstructions] = useState(false);
  const [originalInstructions, setOriginalInstructions] = useState<string | null>(null);

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

  // Fetch classroom data for domains and materials, and last assignment data
  useEffect(() => {
    const fetchData = async () => {
      if (!classroomId || !open) return; // Only fetch when dialog is open

      try {
        // Fetch classroom data
        const { data: classroomData, error: classroomError } = await supabase
          .from('classrooms')
          .select('domains, materials')
          .eq('id', classroomId)
          .single();

        if (classroomError) throw classroomError;

        let domains: Array<{ name: string; components: string[] }> = [];

        // Type assertion needed until TypeScript types are regenerated
        const classroomDataWithExtras = classroomData as any;

        if (classroomDataWithExtras?.domains) {
          domains = classroomDataWithExtras.domains as Array<{ name: string; components: string[] }>;
          setClassroomDomains(domains);
        }

        if (classroomDataWithExtras?.materials) {
          setClassroomMaterials(classroomDataWithExtras.materials as Array<{ type: 'pdf' | 'link'; url: string; name: string }>);
        }

        // Fetch last assignment to auto-populate domain and hard skills
        // Always fetch this, even for AI-generated assignments, since AI doesn't generate domain/hard_skills
        const { data: lastAssignment, error: assignmentError } = await supabase
          .from('assignments')
          .select('hard_skill_domain, hard_skills')
          .eq('classroom_id', classroomId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!assignmentError && lastAssignment) {
          // Parse hard skills first
          let parsedSkills: string[] = [];
          if (lastAssignment.hard_skills) {
            try {
              const skills = typeof lastAssignment.hard_skills === 'string'
                ? JSON.parse(lastAssignment.hard_skills)
                : lastAssignment.hard_skills;
              if (Array.isArray(skills) && skills.length > 0) {
                parsedSkills = skills;
              }
            } catch (e) {
              console.error('Error parsing hard_skills:', e);
              // Fallback to comma-separated if it was stored that way by mistake
              if (typeof lastAssignment.hard_skills === 'string') {
                parsedSkills = lastAssignment.hard_skills.split(',').map(s => s.trim()).filter(Boolean);
              }
            }
          }

          // Update domain and hard skills in a single setState call
          if (lastAssignment.hard_skill_domain || parsedSkills.length > 0) {
            setFormData(prev => ({
              ...prev,
              hard_skill_domain: lastAssignment.hard_skill_domain || prev.hard_skill_domain,
              hard_skills: parsedSkills.length > 0 ? parsedSkills : prev.hard_skills
            }));
          }

          // Set selected domain and available components
          if (lastAssignment.hard_skill_domain) {
            setSelectedDomain(lastAssignment.hard_skill_domain);

            // Find and set available components for this domain
            const domain = domains.find(d => d.name === lastAssignment.hard_skill_domain);
            if (domain) {
              setAvailableComponents(domain.components);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, [classroomId, open]); // Only re-fetch classroom data when ID changes or dialog opens, NOT on initialData changes

  // Update form data when initial data changes - only when dialog opens
  useEffect(() => {
    if (open && initialData) {
      setFormData(prev => ({
        ...prev,
        title: initialData.title || prev.title || '',
        instructions: initialData.instructions || prev.instructions || '',
        type: initialData.type || prev.type || 'text_essay',
        due_at: initialData.due_at || prev.due_at || '',
        target_dimensions: initialData.target_dimensions || prev.target_dimensions || {
          vision: false,
          values: false,
          thinking: false,
          connection: false,
          action: false,
        },
      }));

      // Store AI metadata separately
      setAiMetadata({
        difficulty_level: initialData.difficulty_level,
        success_criteria: initialData.success_criteria,
        scaffolding_tips: initialData.scaffolding_tips,
      });
    }
  }, [open, initialData]); // Only re-run when open state changes or initialData reference changes while open

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.type !== 'application/pdf') {
      toast.error(t('createAssignment.errors.creating'));
      return;
    }

    /* Removing hardcoded file size limit to defer to Supabase storage settings */
    /*
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t('createClassroom.errors.fileSize'));
      return;
    }
    */

    setUploadingMaterial(true);
    setUploadProgress(0);
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
    console.log(`Starting PDF upload: ${file.name} (${fileSizeMB} MB)`, { type: file.type });
    
    try {
      const fileExt = 'pdf';
      const fileName = `${user!.id}/${Date.now()}.${fileExt}`;

      const { data, error: uploadError } = await supabase.storage
        .from('assignment-materials')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
          onUploadProgress: (progress) => {
            const percentage = Math.round((progress.loaded / progress.total) * 100);
            setUploadProgress(percentage);
            console.log(`Upload progress: ${percentage}% (${(progress.loaded / (1024 * 1024)).toFixed(2)} MB / ${fileSizeMB} MB)`);
          }
        });

      if (uploadError) {
        console.error('Supabase upload error:', uploadError);
        throw uploadError;
      }

      console.log('Upload successful, getting public URL...', data);
      const {
        data: { publicUrl },
      } = supabase.storage.from('assignment-materials').getPublicUrl(fileName);

      setFormData({
        ...formData,
        materials: [...formData.materials, { type: 'pdf', url: publicUrl, name: file.name }],
      });

      toast.success(t('createClassroom.success.pdfUploaded'));
      e.target.value = ''; // Reset file input
    } catch (error: any) {
      console.error('Detailed upload error:', error);
      toast.error(`${t('createAssignment.errors.creating')}: ${error.message || 'Unknown error'}`);
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
      toast.success(t('createClassroom.success.linkAdded'));
    } catch (error) {
      toast.error(t('createClassroom.errors.validUrl'));
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

  const handleRephraseInstructions = async () => {
    if (!formData.instructions.trim()) {
      toast.error(t('createAssignment.rephraseError'));
      return;
    }

    setRephrasingInstructions(true);
    setOriginalInstructions(formData.instructions);
    try {
      const { data, error } = await supabase.functions.invoke('rephrase-text', {
        body: {
          text: formData.instructions,
          language: isRTL ? 'he' : 'en',
        },
      });

      if (error) throw error;

      if (data?.rephrasedText) {
        setFormData({ ...formData, instructions: data.rephrasedText });
        toast.success(t('createAssignment.rephraseSuccess'));
      }
    } catch (error) {
      console.error('Error rephrasing text:', error);
      toast.error(t('createAssignment.rephraseError'));
    } finally {
      setRephrasingInstructions(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Prevent double submission
    if (loading) return;

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
            materials: formData.materials, // JSONB column - pass as object, not stringified
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
                actorId: user!.id,
                metadata: {
                  assignment_id: assignment.id,
                  classroom_id: classroomId,
                  assignment_title: formData.title,
                }
              }
            ]);
          } else {
            // Notify all enrolled students for classroom-wide assignments
            const { data: enrollments } = await supabase
              .from('enrollments')
              .select('student_id')
              .eq('classroom_id', classroomId);

            if (enrollments && enrollments.length > 0) {
              const notifications = enrollments.map(e => ({
                userId: e.student_id,
                type: 'assignment_created' as const,
                title: 'New Assignment',
                message: `New assignment "${formData.title}" has been posted`,
                link: `/student/assignment/${assignment.id}`,
                actorId: user!.id,
                metadata: {
                  assignment_id: assignment.id,
                  classroom_id: classroomId,
                  assignment_title: formData.title,
                }
              }));
              await createBulkNotifications(notifications);
            }
          }
        } catch (error) {
          console.error('Error sending notifications:', error);
        }
      }

      // Log activity
      try {
        await supabase.from('activity_events' as any).insert([
          {
            teacher_id: user!.id,
            type: 'create',
            entity_type: 'assignment',
            entity_id: assignment.id,
            title: `Created assignment: ${formData.title}`,
            route: `/teacher/classroom/${classroomId}`,
          }
        ]);
      } catch (logError) {
        console.error('Error logging activity:', logError);
      }

      toast.success(t('createAssignment.success.created'));
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating assignment:', error);
      toast.error(t('createAssignment.errors.creating'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir={isRTL ? 'rtl' : 'ltr'} className="sm:max-w-6xl max-h-[90vh] p-0 overflow-hidden rounded-xl border-none shadow-2xl bg-background">
        <DialogHeader className="px-8 pt-8 pb-6 bg-gradient-to-br from-muted/20 to-transparent">
          <div className="flex items-center gap-3 mb-2">
            <DialogTitle className="text-2xl md:text-3xl font-bold tracking-tight text-heading">
              {initialData ? t('editAssignment.title') : t('createAssignment.title')}
            </DialogTitle>
          </div>
          <p className={`text-subtle text-body ms-1 ${isRTL ? 'text-right' : 'text-left'}`}>
            {initialData ? t('editAssignment.description') : t('createAssignment.description')}
          </p>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-160px)] px-8 pb-8">
          <form onSubmit={handleSubmit} className="space-y-8 pt-4">

            {/* Assignment Basics */}
            <div className="space-y-6 p-6 rounded-xl border border-border shadow-sm">
              <div className={`flex items-center gap-2 text-primary mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <BookOpen className="h-5 w-5" />
                <h3 className={`font-bold text-heading ${isRTL ? 'text-right' : 'text-left'}`}>{t('createClassroom.courseBasics')}</h3>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title" className={`text-body font-medium block ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('createAssignment.titleLabel')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="title"
                  placeholder={t('createAssignment.titlePlaceholder')}
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  className="rounded-xl h-11 focus-visible:ring-primary"
                  dir={isRTL ? 'rtl' : 'ltr'}
                  autoDirection
                />
              </div>

              <div className="space-y-2">
                <div className={`flex items-center gap-3 mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <Label htmlFor="instructions" className={`text-body font-medium mb-0 ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('createAssignment.instructionsLabel')} <span className="text-destructive">*</span>
                  </Label>
                  <div className="flex gap-2">
                    {originalInstructions !== null && originalInstructions !== formData.instructions && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setFormData({ ...formData, instructions: originalInstructions });
                          setOriginalInstructions(null);
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
                      onClick={handleRephraseInstructions}
                      disabled={!formData.instructions.trim() || rephrasingInstructions}
                      className={`rounded-full text-xs font-semibold ${isRTL ? 'flex-row-reverse' : ''}`}
                    >
                      {rephrasingInstructions ? (
                        <>
                          <Loader2 className={`h-3 w-3 animate-spin ${isRTL ? 'ms-1' : 'me-1'}`} />
                          {t('createAssignment.rephrasing')}
                        </>
                      ) : (
                        <>
                          <Sparkles className={`h-3 w-3 ${isRTL ? 'ms-1' : 'me-1'}`} />
                          {t('createAssignment.rephraseButton')}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                <Textarea
                  id="instructions"
                  placeholder={t('createAssignment.instructionsPlaceholder')}
                  value={formData.instructions}
                  onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                  className="min-h-[120px] rounded-xl resize-none focus-visible:ring-primary"
                  dir={isRTL ? 'rtl' : 'ltr'}
                  required
                  autoDirection
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="type" className={`text-body font-medium block ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('createAssignment.type')}
                  </Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData({ ...formData, type: value })}
                  >
                    <SelectTrigger className={`rounded-xl h-11 ${isRTL ? 'text-right' : 'text-left'}`} dir={isRTL ? 'rtl' : 'ltr'}>
                      <SelectValue>{t('createAssignment.type')}</SelectValue>
                    </SelectTrigger>
                    <SelectContent className="rounded-xl" dir={isRTL ? 'rtl' : 'ltr'}>
                      <SelectItem value="text_essay" className={isRTL ? 'text-right' : 'text-left'}>{t('createAssignment.typeOptions.text_essay')}</SelectItem>
                      <SelectItem value="quiz" className={isRTL ? 'text-right' : 'text-left'}>{t('createAssignment.typeOptions.quiz')}</SelectItem>
                      <SelectItem value="project" className={isRTL ? 'text-right' : 'text-left'}>{t('createAssignment.typeOptions.project')}</SelectItem>
                      <SelectItem value="presentation" className={isRTL ? 'text-right' : 'text-left'}>{t('createAssignment.typeOptions.presentation')}</SelectItem>
                      <SelectItem value="other" className={isRTL ? 'text-right' : 'text-left'}>{t('createAssignment.typeOptions.other')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="due_at" className={`text-body font-medium block ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('createAssignment.dueDate')}
                  </Label>
                  <div className={`relative w-fit ${isRTL ? 'ml-auto' : ''}`}>
                    <Input
                      id="due_at"
                      type="datetime-local"
                      value={formData.due_at}
                      onChange={(e) => setFormData({ ...formData, due_at: e.target.value })}
                      className={`rounded-xl h-11 ps-10 w-fit ${isRTL ? 'text-right' : 'text-left'}`}
                      dir={isRTL ? 'rtl' : 'ltr'}
                      autoDirection
                    />
                    <Calendar className="absolute start-3 top-3 h-5 w-5 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>

            {/* Skills & Domain */}
            <div className="space-y-6 p-6 rounded-xl border border-border shadow-sm">
              <div className={`flex items-center gap-2 text-primary mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <Target className="h-5 w-5" />
                <h3 className={`font-bold text-heading ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('createAssignment.subjectAreaAndSkills')}
                </h3>
              </div>

              <p className={`text-sm text-subtle mb-4 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('createAssignment.subjectAreasHelper')}
              </p>

              <div className="space-y-2">
                <Label htmlFor="hard_skill_domain" className={`text-body font-medium block ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('createAssignment.subjectAreaLabel')}
                </Label>
                {classroomDomains.length > 0 ? (
                  <div className="space-y-2">
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
                      <SelectTrigger className={`rounded-xl bg-background h-11 ${isRTL ? 'text-right' : 'text-left'}`} dir={isRTL ? 'rtl' : 'ltr'}>
                        <SelectValue>{t('createAssignment.selectFromDomains')}</SelectValue>
                      </SelectTrigger>
                      <SelectContent className="rounded-xl" dir={isRTL ? 'rtl' : 'ltr'}>
                        {classroomDomains.map((domain, index) => (
                          <SelectItem key={index} value={domain.name} className={isRTL ? 'text-right' : 'text-left'}>
                            {domain.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className={`text-xs text-muted-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
                      {t('createAssignment.orEnterManually')}
                    </p>
                  </div>
                ) : null}
                <Input
                  id="hard_skill_domain"
                  placeholder={t('createAssignment.subjectAreaPlaceholder')}
                  value={formData.hard_skill_domain}
                  onChange={(e) => {
                    setFormData({ ...formData, hard_skill_domain: e.target.value });
                    setSelectedDomain(''); // Clear dropdown selection
                  }}
                  className="rounded-xl bg-background h-11"
                  dir={isRTL ? 'rtl' : 'ltr'}
                  autoDirection
                />
              </div>

              <div className="space-y-3">
                <Label className={`text-body font-medium block ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('createAssignment.skillsToAssess')}
                </Label>

                {/* Component selection dropdown if domain is selected */}
                {selectedDomain && availableComponents.length > 0 && (
                  <div className="space-y-2">
                    <Select
                      onValueChange={(value: string) => {
                        // Add component if not already in the list
                        if (!formData.hard_skills.includes(value)) {
                          setFormData({
                            ...formData,
                            hard_skills: [...formData.hard_skills, value]
                          });
                        }
                      }}
                    >
                      <SelectTrigger className={`rounded-xl bg-background h-11 ${isRTL ? 'text-right' : 'text-left'}`} dir={isRTL ? 'rtl' : 'ltr'}>
                        <SelectValue>{t('createAssignment.selectFromSkills', { domain: selectedDomain })}</SelectValue>
                      </SelectTrigger>
                      <SelectContent className="rounded-xl" dir={isRTL ? 'rtl' : 'ltr'}>
                        {availableComponents.map((component, index) => (
                          <SelectItem key={index} value={component} className={isRTL ? 'text-right' : 'text-left'}>
                            {component}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  {formData.hard_skills.map((skill, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        value={skill}
                        onChange={(e) => {
                          const newSkills = [...formData.hard_skills];
                          newSkills[index] = e.target.value;
                          setFormData({ ...formData, hard_skills: newSkills });
                        }}
                        placeholder={t('createAssignment.skillPlaceholder', { number: index + 1 })}
                        className="flex-1 rounded-lg bg-background/80 h-10"
                        dir={isRTL ? 'rtl' : 'ltr'}
                        autoDirection
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const newSkills = formData.hard_skills.filter((_, i) => i !== index);
                          setFormData({ ...formData, hard_skills: newSkills });
                        }}
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-full"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setFormData({ ...formData, hard_skills: [...formData.hard_skills, ''] })
                    }
                    className="text-primary hover:bg-primary/5 text-xs font-semibold"
                  >
                    <Plus className="h-3 w-3 me-1" />
                    {t('createAssignment.addSkillManually')}
                  </Button>
                </div>
              </div>
            </div>

            {/* Materials Section */}
            <div className="space-y-6 p-6 rounded-xl border border-border shadow-sm">
              <div className={`flex items-center gap-2 text-primary mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <FileText className="h-5 w-5" />
                <h3 className={`font-bold text-heading ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('createAssignment.assignmentMaterials')}
                </h3>
              </div>

              {/* Select from classroom materials */}
              {classroomMaterials.length > 0 && (
                <div className="space-y-2">
                  <Label className={`text-sm font-medium block ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('createAssignment.selectFromClassroomMaterials')}:
                  </Label>
                  <div className="border border-border rounded-xl p-4 max-h-40 overflow-y-auto space-y-2 bg-muted/5 shadow-inner">
                    {classroomMaterials.map((material, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Checkbox
                          id={`classroom-material-${index}`}
                          checked={selectedMaterialIds.has(index)}
                          onCheckedChange={() => toggleClassroomMaterial(index)}
                        />
                        <label
                          htmlFor={`classroom-material-${index}`}
                          className="flex-1 flex items-center gap-2 text-sm cursor-pointer font-medium"
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
              )}

              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <Label className={`text-sm font-medium block ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('createAssignment.uploadPDF')}
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="pdf-upload"
                      type="file"
                      accept="application/pdf"
                      onChange={handlePdfUpload}
                      disabled={uploadingMaterial}
                      className={`h-auto py-2.5 rounded-xl bg-background border-border file:me-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-muted file:text-foreground hover:file:bg-muted/80 ${isRTL ? 'text-right' : 'text-left'}`}
                      dir={isRTL ? 'rtl' : 'ltr'}
                      autoDirection
                    />
                    {uploadingMaterial && (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <span className="text-xs font-medium text-muted-foreground">{uploadProgress > 0 ? `${uploadProgress}%` : ''}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className={`text-sm font-medium block ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('createAssignment.addLink')}
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="https://..."
                      value={linkInput}
                      onChange={(e) => setLinkInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddLink();
                        }
                      }}
                      className="rounded-xl bg-background"
                      dir={isRTL ? 'rtl' : 'ltr'}
                      autoDirection
                    />
                    <Button
                      type="button"
                      onClick={handleAddLink}
                      className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {formData.materials.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                  {formData.materials.map((material, index) => (
                    <div key={index} className={`flex items-center gap-3 p-3 bg-muted/10 rounded-xl border border-border shadow-sm group ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <div className="h-8 w-8 rounded-full bg-primary/5 flex items-center justify-center text-primary">
                        {material.type === 'pdf' ? (
                          <Upload className="h-4 w-4" />
                        ) : (
                          <LinkIcon className="h-4 w-4" />
                        )}
                      </div>
                      <span className={`flex-1 text-sm truncate font-bold text-foreground ${isRTL ? 'text-right' : 'text-left'}`} dir={isRTL ? 'rtl' : 'ltr'}>
                        {material.name}
                      </span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => window.open(material.url, '_blank')}
                          className="h-8 w-8 text-muted-foreground hover:text-primary"
                          title={t('common.view')}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveMaterial(index)}
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

            <div className={`flex gap-3 pt-6 border-t ${isRTL ? 'justify-start flex-row-reverse' : 'justify-end'}`}>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="rounded-full px-6 font-bold"
                dir={isRTL ? 'rtl' : 'ltr'}
              >
                {t('createAssignment.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="rounded-full px-10 font-bold shadow-lg shadow-primary/20"
                dir={isRTL ? 'rtl' : 'ltr'}
              >
                {loading && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                {initialData ? t('editAssignment.saveButton') : t('createAssignment.createButton')}
              </Button>
            </div>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
