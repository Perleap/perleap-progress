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
import { Sparkles, X, Upload, Link as LinkIcon, Loader2, BookOpen, Calendar, Target, FileText, Plus, Eye } from 'lucide-react';
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
  const [uploadProgress, setUploadProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [classroomDomains, setClassroomDomains] = useState<Array<{ name: string; components: string[] }>>([]);
  const [selectedDomain, setSelectedDomain] = useState<string>('');
  const [availableComponents, setAvailableComponents] = useState<string[]>([]);
  const [classroomMaterials, setClassroomMaterials] = useState<Array<{ type: 'pdf' | 'link'; url: string; name: string }>>([]);
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<Set<number>>(new Set());
  const [rephrasingInstructions, setRephrasingInstructions] = useState(false);
  const [originalInstructions, setOriginalInstructions] = useState<string | null>(null);

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

  // Update state when assignment changes and load hard_skills - only when dialog opens
  useEffect(() => {
    if (!open) return;

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
        } catch (e) {
          console.error('Error parsing hard_skills:', e);
          // Fallback to comma-separated if it was stored that way by mistake
          if (typeof data.hard_skills === 'string') {
            const fallback = data.hard_skills.split(',').map(s => s.trim()).filter(Boolean);
            setHardSkills(fallback);
          } else {
            setHardSkills([]);
          }
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
  }, [open, assignment.id, classroomDomains]); // assignment.id is more stable than the whole assignment object

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
        });

      if (uploadError) {
        console.error('Supabase upload error:', uploadError);
        throw uploadError;
      }

      console.log('Upload successful, getting public URL...', data);
      const {
        data: { publicUrl },
      } = supabase.storage.from('assignment-materials').getPublicUrl(fileName);

      setMaterials([...materials, { type: 'pdf', url: publicUrl, name: file.name }]);
      toast.success(t('createClassroom.success.pdfUploaded'));
      e.target.value = ''; // Reset file input
    } catch (error: any) {
      console.error('Detailed upload error:', error);
      toast.error(`${t('editAssignment.errors.saving')}: ${error.message || 'Unknown error'}`);
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

  const handleRephraseInstructions = async () => {
    if (!instructions.trim()) {
      toast.error(t('createAssignment.rephraseError'));
      return;
    }

    setRephrasingInstructions(true);
    setOriginalInstructions(instructions);
    try {
      const { data, error } = await supabase.functions.invoke('rephrase-text', {
        body: {
          text: instructions,
          language: isRTL ? 'he' : 'en',
        },
      });

      if (error) throw error;

      if (data?.rephrasedText) {
        setInstructions(data.rephrasedText);
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
                actorId: user!.id,
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
      <DialogContent dir={isRTL ? 'rtl' : 'ltr'} className="sm:max-w-6xl max-h-[90vh] p-0 overflow-hidden rounded-xl border-none shadow-2xl bg-background">
        <DialogHeader className="px-8 pt-8 pb-6 bg-gradient-to-br from-muted/20 to-transparent">
          <div className="flex items-center gap-3 mb-2">
            <DialogTitle className="text-2xl md:text-3xl font-bold tracking-tight text-heading">
              {t('editAssignment.title')}
            </DialogTitle>
          </div>
          <p className={`text-subtle text-body ms-1 ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('editAssignment.description')}
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
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="rounded-xl h-11 focus-visible:ring-primary"
                  dir={isRTL ? 'rtl' : 'ltr'}
                  autoDirection
                />
              </div>

              <div className="space-y-2">
                <div className={`flex items-center justify-between gap-4 mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <Label htmlFor="instructions" className={`text-body font-medium mb-0 ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('createAssignment.instructionsLabel')} <span className="text-destructive">*</span>
                  </Label>
                  <div className="flex gap-2">
                    {originalInstructions !== null && originalInstructions !== instructions && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setInstructions(originalInstructions);
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
                      disabled={!instructions.trim() || rephrasingInstructions}
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
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
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
                    value={type}
                    onValueChange={setType}
                  >
                    <SelectTrigger className={`rounded-xl h-11 ${isRTL ? 'text-right' : 'text-left'}`} dir={isRTL ? 'rtl' : 'ltr'}>
                      <SelectValue>
                        {type ? t(`createAssignment.typeOptions.${type}`) : t('createAssignment.type')}
                      </SelectValue>
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
                  <div className="relative">
                    <Input
                      id="due_at"
                      type="datetime-local"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="rounded-xl h-11 ps-10"
                      dir={isRTL ? 'rtl' : 'ltr'}
                      autoDirection
                    />
                    <Calendar className="absolute start-3 top-3 h-5 w-5 text-muted-foreground" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status" className={`text-body font-medium block ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('assignments.status.label')}
                </Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className={`rounded-xl h-11 ${isRTL ? 'text-right' : 'text-left'}`} dir={isRTL ? 'rtl' : 'ltr'}>
                    <SelectValue>
                      {status ? t(`assignments.status.${status}`) : t('assignments.status.label')}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="rounded-xl" dir={isRTL ? 'rtl' : 'ltr'}>
                    <SelectItem value="draft" className={isRTL ? 'text-right' : 'text-left'}>{t('assignments.status.draft')}</SelectItem>
                    <SelectItem value="published" className={isRTL ? 'text-right' : 'text-left'}>{t('assignments.status.published')}</SelectItem>
                  </SelectContent>
                </Select>
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
                {t('editAssignment.subjectAreasHelper')}
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
                        setHardSkillDomain(value);
                        // Load components for selected domain
                        const domain = classroomDomains.find(d => d.name === value);
                        if (domain) {
                          setAvailableComponents(domain.components);
                        }
                      }}
                    >
                      <SelectTrigger className={`rounded-xl bg-background h-11 ${isRTL ? 'text-right' : 'text-left'}`} dir={isRTL ? 'rtl' : 'ltr'}>
                        <SelectValue>
                          {selectedDomain || t('createAssignment.selectFromDomains')}
                        </SelectValue>
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
                        if (!hardSkills.includes(value)) {
                          setHardSkills([...hardSkills, value]);
                        }
                      }}
                    >
                      <SelectTrigger className={`rounded-xl bg-background h-11 ${isRTL ? 'text-right' : 'text-left'}`} dir={isRTL ? 'rtl' : 'ltr'}>
                        <SelectValue>
                          {t('createAssignment.selectFromSkills', { domain: selectedDomain })}
                        </SelectValue>
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
                        className="flex-1 rounded-lg bg-background/80 h-10"
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
                    onClick={() => setHardSkills([...hardSkills, ''])}
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
                  <div className="border border-border rounded-xl p-4 max-h-40 overflow-y-auto space-y-2 bg-background shadow-inner">
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
                            <Upload className="h-3 w-3 text-primary flex-shrink-0" />
                          ) : (
                            <LinkIcon className="h-3 w-3 text-primary flex-shrink-0" />
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

              {materials.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                  {materials.map((material, index) => (
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
                {loading ? (
                  <>
                    <Loader2 className={`h-4 w-4 animate-spin ${isRTL ? 'ml-2' : 'mr-2'}`} />
                    {t('editAssignment.saving')}
                  </>
                ) : (
                  t('editAssignment.saveButton')
                )}
              </Button>
            </div>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
