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
import { Sparkles, X, Upload, Link as LinkIcon, Loader2, BookOpen, Calendar, Target, FileText, Plus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ScrollArea } from '@/components/ui/scroll-area';

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

        if (data?.domains) {
          setClassroomDomains(data.domains as Array<{ name: string; components: string[] }>);
        }
        if (data?.materials) {
          setClassroomMaterials(data.materials as Array<{ type: 'pdf' | 'link'; url: string; name: string }>);
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
      <DialogContent dir={isRTL ? 'rtl' : 'ltr'} className="max-w-3xl max-h-[90vh] p-0 overflow-hidden rounded-3xl border-none shadow-2xl bg-white dark:bg-slate-900">
        <div className="h-2 bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400" />

        <DialogHeader className="px-8 pt-8 pb-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl">
              <Sparkles className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <DialogTitle className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              {t('editAssignment.title')}
            </DialogTitle>
          </div>
          <p className={`text-slate-500 dark:text-slate-400 ms-1 ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('editAssignment.description')}
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
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
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
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
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
                    value={type}
                    onValueChange={setType}
                  >
                    <SelectTrigger className={`rounded-xl border-slate-200 dark:border-slate-700 h-11 ${isRTL ? 'text-right' : 'text-left'}`} dir={isRTL ? 'rtl' : 'ltr'}>
                      <SelectValue />
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
                  <div className="relative">
                    <Input
                      id="due_at"
                      type="datetime-local"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="rounded-xl border-slate-200 dark:border-slate-700 h-11 ps-10"
                      dir={isRTL ? 'rtl' : 'ltr'}
                      autoDirection
                    />
                    <Calendar className="absolute start-3 top-3 h-5 w-5 text-slate-400" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status" className={`text-slate-600 dark:text-slate-300 block ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('assignments.status.label')}
                </Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className={`rounded-xl border-slate-200 dark:border-slate-700 h-11 ${isRTL ? 'text-right' : 'text-left'}`} dir={isRTL ? 'rtl' : 'ltr'}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl" dir={isRTL ? 'rtl' : 'ltr'}>
                    <SelectItem value="draft" className={isRTL ? 'text-right' : 'text-left'}>{t('assignments.status.draft')}</SelectItem>
                    <SelectItem value="published" className={isRTL ? 'text-right' : 'text-left'}>{t('assignments.status.published')}</SelectItem>
                  </SelectContent>
                </Select>
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
                {t('editAssignment.subjectAreasHelper')}
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
                        setHardSkillDomain(value);
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
                  value={hardSkillDomain}
                  onChange={(e) => {
                    setHardSkillDomain(e.target.value);
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
                        if (!hardSkills.includes(value)) {
                          setHardSkills([...hardSkills, value]);
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
                  {hardSkills.map((skill, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        value={skill}
                        onChange={(e) => {
                          const newSkills = [...hardSkills];
                          newSkills[index] = e.target.value;
                          setHardSkills(newSkills);
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
                          const newSkills = hardSkills.filter((_, i) => i !== index);
                          setHardSkills(newSkills);
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
                    onClick={() => setHardSkills([...hardSkills, ''])}
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

              {materials.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
                  {materials.map((material, index) => (
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
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-500 hover:bg-red-50"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-center gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
                className="rounded-xl px-6"
              >
                {t('createAssignment.cancel')}
              </Button>
              <Button type="submit" disabled={loading} className="rounded-xl px-6 bg-indigo-600 hover:bg-indigo-700">
                {loading ? (
                  <>
                    <Loader2 className={`h-4 w-4 animate-spin ${isRTL ? 'ml-2' : 'mr-2'}`} />
                    {t('editAssignment.saving')}
                  </>
                ) : (
                  t('editAssignment.save')
                )}
              </Button>
            </div>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
