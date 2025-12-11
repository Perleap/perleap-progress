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
import { Loader2, Sparkles, X, Upload, Link as LinkIcon, BookOpen, Calendar, Target, FileText, Plus, Trash2 } from 'lucide-react';
import { createBulkNotifications } from '@/lib/notificationService';
import { useAuth } from '@/contexts/AuthContext';
import { ScrollArea } from '@/components/ui/scroll-area';

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
  }, [classroomId, initialData, open]); // Added 'open' to dependencies

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

      setFormData({
        ...formData,
        materials: [...formData.materials, { type: 'pdf', url: publicUrl, name: file.name }],
      });

      toast.success(t('createClassroom.success.pdfUploaded'));
      e.target.value = ''; // Reset file input
    } catch (error) {
      toast.error(t('createAssignment.errors.creating'));
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
      <DialogContent dir={isRTL ? 'rtl' : 'ltr'} className="max-w-3xl max-h-[90vh] p-0 overflow-hidden rounded-3xl border-none shadow-2xl bg-white dark:bg-slate-900">
        <div className="h-2 bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400" />

        <DialogHeader className="px-8 pt-8 pb-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl">
              <Sparkles className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <DialogTitle className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              {initialData ? t('editAssignment.title') : t('createAssignment.title')}
            </DialogTitle>
          </div>
          <p className={`text-slate-500 dark:text-slate-400 ms-1 ${isRTL ? 'text-right' : 'text-left'}`}>
            {initialData ? t('editAssignment.description') : t('createAssignment.description')}
          </p>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-140px)] px-8 pb-8">
          <form onSubmit={handleSubmit} className="space-y-8">

            {/* Assignment Basics */}
            <div className="space-y-5 p-5 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-800">
              <div className={`flex items-center gap-2 text-indigo-600 dark:text-indigo-400 mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <BookOpen className="h-5 w-5" />
                <h3 className={`font-semibold ${isRTL ? 'text-right' : 'text-left'}`}>{t('createClassroom.courseBasics')}</h3>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title" className={`text-slate-600 dark:text-slate-300 block ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('createAssignment.titleLabel')} <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="title"
                  placeholder={t('createAssignment.titlePlaceholder')}
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  className="rounded-xl border-slate-200 dark:border-slate-700 h-11 focus-visible:ring-indigo-500"
                  dir={isRTL ? 'rtl' : 'ltr'}
                  autoDirection
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="instructions" className={`text-slate-600 dark:text-slate-300 block ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('createAssignment.instructionsLabel')} <span className="text-red-400">*</span>
                </Label>
                <Textarea
                  id="instructions"
                  placeholder={t('createAssignment.instructionsPlaceholder')}
                  value={formData.instructions}
                  onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                  className="min-h-[120px] rounded-2xl border-slate-200 dark:border-slate-700 resize-none focus-visible:ring-indigo-500"
                  dir={isRTL ? 'rtl' : 'ltr'}
                  required
                  autoDirection
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="type" className={`text-slate-600 dark:text-slate-300 block ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('createAssignment.type')}
                  </Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData({ ...formData, type: value })}
                  >
                    <SelectTrigger className={`rounded-xl border-slate-200 dark:border-slate-700 h-11 ${isRTL ? 'text-right' : 'text-left'}`} dir={isRTL ? 'rtl' : 'ltr'}>
                      <SelectValue placeholder={t('createAssignment.type')} />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl" dir={isRTL ? 'rtl' : 'ltr'}>
                      <SelectItem value="text_essay" className={isRTL ? 'text-right' : 'text-left'}>{t('assignments.types.text_essay')}</SelectItem>
                      <SelectItem value="quiz" className={isRTL ? 'text-right' : 'text-left'}>{t('assignments.types.quiz')}</SelectItem>
                      <SelectItem value="project" className={isRTL ? 'text-right' : 'text-left'}>{t('assignments.types.project')}</SelectItem>
                      <SelectItem value="presentation" className={isRTL ? 'text-right' : 'text-left'}>{t('createAssignment.typeOptions.presentation')}</SelectItem>
                      <SelectItem value="other" className={isRTL ? 'text-right' : 'text-left'}>{t('createAssignment.typeOptions.other')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="due_at" className={`text-slate-600 dark:text-slate-300 block ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('createAssignment.dueDate')}
                  </Label>
                  <div className={`relative w-fit ${isRTL ? 'ml-auto' : ''}`}>
                    <Input
                      id="due_at"
                      type="datetime-local"
                      value={formData.due_at}
                      onChange={(e) => setFormData({ ...formData, due_at: e.target.value })}
                      className={`rounded-xl border-slate-200 dark:border-slate-700 h-11 ps-10 w-fit ${isRTL ? 'text-right' : 'text-left'}`}
                      dir={isRTL ? 'rtl' : 'ltr'}
                      autoDirection
                    />
                    <Calendar className="absolute start-3 top-3 h-5 w-5 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>

            {/* Skills & Domain */}
            <div className="space-y-5 p-5 bg-purple-50/30 dark:bg-purple-900/10 rounded-3xl border border-purple-100 dark:border-purple-900/30">
              <div className={`flex items-center gap-2 text-purple-600 dark:text-purple-400 mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <Target className="h-5 w-5" />
                <h3 className={`font-semibold ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('createAssignment.subjectAreaAndSkills')}
                </h3>
              </div>
              
              <p className={`text-sm text-slate-600 dark:text-slate-400 mb-4 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('createAssignment.subjectAreasHelper')}
              </p>

              <div className="space-y-2">
                <Label htmlFor="hard_skill_domain" className={`text-slate-600 dark:text-slate-300 block ${isRTL ? 'text-right' : 'text-left'}`}>
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
                      <SelectTrigger className={`rounded-xl border-purple-200 dark:border-purple-800 bg-white dark:bg-slate-900 h-11 ${isRTL ? 'text-right' : 'text-left'}`} dir={isRTL ? 'rtl' : 'ltr'}>
                        <SelectValue placeholder={t('createAssignment.selectFromDomains')} />
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
                  className="rounded-xl border-purple-200 dark:border-purple-800 bg-white dark:bg-slate-900 h-11"
                  dir={isRTL ? 'rtl' : 'ltr'}
                  autoDirection
                />
              </div>

              <div className="space-y-3">
                <Label className={`text-slate-600 dark:text-slate-300 block ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('createAssignment.skillsToAssess')}
                </Label>

                {/* Component selection dropdown if domain is selected */}
                {selectedDomain && availableComponents.length > 0 && (
                  <div className="space-y-2">
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
                      <SelectTrigger className={`rounded-xl border-purple-200 dark:border-purple-800 bg-white dark:bg-slate-900 h-11 ${isRTL ? 'text-right' : 'text-left'}`} dir={isRTL ? 'rtl' : 'ltr'}>
                        <SelectValue placeholder={t('createAssignment.selectFromSkills', { domain: selectedDomain })} />
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
                        className="flex-1 rounded-lg border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 h-10"
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
                        className="text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full"
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
                    className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 text-xs font-medium"
                  >
                    <Plus className="h-3 w-3 me-1" />
                    {t('createAssignment.addSkillManually')}
                  </Button>
                </div>
              </div>
            </div>

            {/* Materials Section */}
            <div className="space-y-5 p-5 bg-blue-50/50 dark:bg-blue-900/10 rounded-3xl border border-blue-100 dark:border-blue-900/20">
              <div className={`flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <FileText className="h-5 w-5" />
                <h3 className={`font-semibold ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('createAssignment.assignmentMaterials')}
                </h3>
              </div>

              {/* Select from classroom materials */}
              {classroomMaterials.length > 0 && (
                <div className="space-y-2">
                  <Label className={`text-sm font-medium text-slate-600 dark:text-slate-300 block ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('createAssignment.selectFromClassroomMaterials')}:
                  </Label>
                  <div className="border border-blue-100 dark:border-blue-900/30 rounded-xl p-3 max-h-40 overflow-y-auto space-y-2 bg-white dark:bg-slate-900">
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
              )}

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label className={`text-sm font-medium text-slate-600 dark:text-slate-300 block ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('createAssignment.uploadPDF')}
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="pdf-upload"
                      type="file"
                      accept="application/pdf"
                      onChange={handlePdfUpload}
                      disabled={uploadingMaterial}
                      className={`h-auto py-2.5 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 file:me-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 ${isRTL ? 'text-right' : 'text-left'}`}
                      dir={isRTL ? 'rtl' : 'ltr'}
                      autoDirection
                    />
                    {uploadingMaterial && <Loader2 className="h-4 w-4 animate-spin" />}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className={`text-sm font-medium text-slate-600 dark:text-slate-300 block ${isRTL ? 'text-right' : 'text-left'}`}>
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
                      className="rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                      dir={isRTL ? 'rtl' : 'ltr'}
                      autoDirection
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
                    <div key={index} className={`flex items-center gap-3 p-3 bg-white dark:bg-slate-900 rounded-xl border border-blue-100 dark:border-blue-900/30 shadow-sm group ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <div className="h-8 w-8 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                        {material.type === 'pdf' ? (
                          <Upload className="h-4 w-4" />
                        ) : (
                          <LinkIcon className="h-4 w-4" />
                        )}
                      </div>
                      <span className={`flex-1 text-sm truncate font-medium text-slate-700 dark:text-slate-300 ${isRTL ? 'text-right' : 'text-left'}`} dir={isRTL ? 'rtl' : 'ltr'}>
                        {material.name}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveMaterial(index)}
                        className="h-8 w-8 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={`flex gap-3 pt-4 border-t ${isRTL ? 'justify-start flex-row-reverse' : 'justify-end'}`}>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="rounded-full px-6"
                dir={isRTL ? 'rtl' : 'ltr'}
              >
                {t('createAssignment.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="rounded-full px-8 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg shadow-indigo-200 dark:shadow-none transition-all hover:scale-105"
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
