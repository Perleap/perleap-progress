import { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/useAuth';
import { createBulkNotifications } from '@/lib/notificationService';
import { buildModuleContextTextFromSyllabusResources } from '@/lib/moduleContextTextFromSyllabus';
import {
  setAssignmentLinkedActivities,
  getLinkedActivitiesForAssignment,
  getSectionResourceIdsForSectionInOrder,
} from '@/services/assignmentModuleActivityService';
import {
  useSyllabus,
  syllabusKeys,
  assignmentKeys,
  syncModuleFlowToResolvedDisplayForSection,
} from '@/hooks/queries';
import { moduleFlowKeys } from '@/hooks/queries/useModuleFlowQueries';
import { testKeys } from '@/hooks/queries/useTestQueries';
import { WizardStepIndicator, type WizardStep } from '@/components/features/syllabus/WizardStepIndicator';
import type { TestQuestionDraft } from '@/components/features/assignment/TestQuestionBuilder';
import { AssignmentBasicsStep } from './steps/AssignmentBasicsStep';
import { AssignmentFormatStep } from './steps/AssignmentFormatStep';
import { AssignmentCourseReleaseStep } from './steps/AssignmentCourseReleaseStep';
import { AssignmentSkillsMaterialsStep } from './steps/AssignmentSkillsMaterialsStep';
import { AssignmentTestStep } from './steps/AssignmentTestStep';
import { AssignmentReviewStep } from './steps/AssignmentReviewStep';
import {
  distinctDomains,
  parseHardSkillsFromDb,
  resolveHardSkillDomainForDb,
  type HardSkillPair,
} from '@/lib/hardSkillsFormat';
import {
  ASSIGNMENT_WIZARD_FIRST_STEP,
  assignmentCreateDraftKey,
  assignmentWizardStepOrder,
  getDefaultAssignmentWizardFormData,
  type AssignmentCreateDraftV1,
  type AssignmentForWizardEdit,
  type AssignmentWizardCreateInitialData,
  type AssignmentWizardFormData,
  type AssignmentWizardStepId,
} from './assignmentWizardTypes';
import type { HardSkillsSuggestionStatus } from './steps/AssignmentSkillsMaterialsStep';

type DialogOpenProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export type AssignmentWizardDialogProps =
  | (DialogOpenProps & {
      mode: 'create';
      classroomId: string;
      onSuccess: () => void;
      initialData?: AssignmentWizardCreateInitialData;
      assignedStudentId?: string;
      studentName?: string;
      lockSyllabusSection?: boolean;
      onCreatedAssignment?: (assignmentId: string) => void;
    })
  | (DialogOpenProps & {
      mode: 'edit';
      assignment: AssignmentForWizardEdit;
      onSuccess: () => void;
    });

function formatDueForForm(dueAt: string | null | undefined): string {
  if (!dueAt) return '';
  const d = new Date(dueAt);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function dbRowToTestDraft(row: {
  id: string;
  question_text: string;
  question_type: string;
  options: unknown;
  correct_option_id: string | null;
  order_index: number;
}): TestQuestionDraft {
  const opts = row.options as { id: string; text: string }[] | null;
  return {
    id: row.id,
    question_text: row.question_text,
    question_type: row.question_type as 'multiple_choice' | 'open_ended',
    options: Array.isArray(opts) ? opts : [],
    correct_option_id: row.correct_option_id || '',
    order_index: row.order_index,
  };
}

export function AssignmentWizardDialog(props: AssignmentWizardDialogProps) {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const isCreate = props.mode === 'create';
  const classroomId = isCreate ? props.classroomId : props.assignment.classroom_id;
  const initialData = isCreate ? props.initialData : undefined;
  const lockSyllabusSection = isCreate ? (props.lockSyllabusSection ?? false) : false;
  const assignedStudentId = isCreate ? props.assignedStudentId : undefined;
  const onCreatedAssignment = isCreate ? props.onCreatedAssignment : undefined;

  const assignment = !isCreate ? props.assignment : null;

  const { open, onOpenChange, onSuccess } = props;

  const { data: syllabus, isLoading: isSyllabusLoading } = useSyllabus(classroomId);

  const [currentStepId, setCurrentStepId] = useState<AssignmentWizardStepId>(ASSIGNMENT_WIZARD_FIRST_STEP);
  const [formData, setFormData] = useState<AssignmentWizardFormData>(() => getDefaultAssignmentWizardFormData());
  const [loading, setLoading] = useState(false);
  const [uploadingMaterial, setUploadingMaterial] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [linkInput, setLinkInput] = useState('');
  const [classroomDomains, setClassroomDomains] = useState<Array<{ name: string; components: string[] }>>([]);
  const [classroomMaterials, setClassroomMaterials] = useState<
    Array<{ type: 'pdf' | 'link'; url: string; name: string }>
  >([]);
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<Set<number>>(new Set());
  const [selectedDomain, setSelectedDomain] = useState<string>('');
  const [availableComponents, setAvailableComponents] = useState<string[]>([]);
  const [rephrasingInstructions, setRephrasingInstructions] = useState(false);
  const [testQuestions, setTestQuestions] = useState<TestQuestionDraft[]>([]);
  const [syllabusSectionId, setSyllabusSectionId] = useState<string>('');
  const [gradingCategoryId, setGradingCategoryId] = useState<string>('');
  const [linkedModuleActivityIds, setLinkedModuleActivityIds] = useState<string[]>([]);
  const moduleLinkInitKeyRef = useRef<string>('');
  const assignmentDraftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const assignmentDraftHydratedSessionRef = useRef(false);
  const syllabusSectionPrevRef = useRef<string | null>(null);

  const [aiMetadata, setAiMetadata] = useState<AssignmentCreateDraftV1['aiMetadata']>({});

  const [hasSubmissions, setHasSubmissions] = useState(false);

  const [hardSkillsSuggestionStatus, setHardSkillsSuggestionStatus] =
    useState<HardSkillsSuggestionStatus>('idle');
  const suggestHardSkillsTokenRef = useRef(0);

  const hasDueDateInDb = Boolean(assignment?.due_at?.trim());
  const policyFrozen = !isCreate && hasSubmissions && hasDueDateInDb;

  const stepOrder = useMemo(() => assignmentWizardStepOrder(formData.type), [formData.type]);

  const indicatorSteps: WizardStep[] = useMemo(
    () =>
      stepOrder.map((id) => ({
        id,
        title: t(`createAssignment.wizard.steps.${id}`),
      })),
    [stepOrder, t],
  );

  const currentStepIndex = Math.max(0, stepOrder.indexOf(currentStepId));
  const isLastStep = currentStepId === 'review';

  const resetCreateDefaults = useCallback(() => {
    setFormData(getDefaultAssignmentWizardFormData());
    setTestQuestions([]);
    setLinkInput('');
    setSelectedMaterialIds(new Set());
    setSelectedDomain('');
    setAvailableComponents([]);
    setRephrasingInstructions(false);
    setAiMetadata({});
    setUploadingMaterial(false);
    setUploadProgress(0);
    setLinkedModuleActivityIds([]);
    moduleLinkInitKeyRef.current = '';
    setHardSkillsSuggestionStatus('idle');
  }, []);

  useEffect(() => {
    if (!open) return;
    setCurrentStepId(ASSIGNMENT_WIZARD_FIRST_STEP);
  }, [open, isCreate ? classroomId : assignment?.id]);

  useEffect(() => {
    if (currentStepId === 'test' && formData.type !== 'test') {
      setCurrentStepId('review');
      return;
    }
    if (!stepOrder.includes(currentStepId)) {
      setCurrentStepId('review');
    }
  }, [formData.type, currentStepId, stepOrder]);

  useEffect(() => {
    if (!open) assignmentDraftHydratedSessionRef.current = false;
  }, [open]);

  useEffect(() => {
    if (!open || !isCreate) return;
    if (initialData) return;
    resetCreateDefaults();
  }, [open, initialData, resetCreateDefaults, isCreate]);

  useLayoutEffect(() => {
    if (!isCreate) return;
    if (!open || !classroomId || assignmentDraftHydratedSessionRef.current) return;
    if (initialData == null) return;
    const sectionKey = syllabusSectionId || initialData?.syllabus_section_id || 'none';
    const hasRichInitial =
      Boolean(initialData?.title?.trim()) ||
      Boolean(initialData?.instructions?.trim()) ||
      (Boolean(initialData?.type) && initialData.type !== 'chatbot');
    assignmentDraftHydratedSessionRef.current = true;
    if (hasRichInitial) return;
    try {
      const raw = sessionStorage.getItem(assignmentCreateDraftKey(classroomId, sectionKey));
      if (!raw) return;
      const draft = JSON.parse(raw) as AssignmentCreateDraftV1;
      if (draft.formData && typeof draft.formData === 'object') {
        setFormData(() => {
          const merged = { ...getDefaultAssignmentWizardFormData(), ...draft.formData };
          const hs = merged.hard_skills as unknown;
          if (Array.isArray(hs) && hs.length > 0 && typeof (hs as unknown[])[0] === 'string') {
            merged.hard_skills = parseHardSkillsFromDb(hs as string[], merged.hard_skill_domain);
          }
          return merged;
        });
      }
      if (Array.isArray(draft.testQuestions)) setTestQuestions(draft.testQuestions);
      if (typeof draft.gradingCategoryId === 'string') setGradingCategoryId(draft.gradingCategoryId);
      if (Array.isArray(draft.linkedModuleActivityIds)) setLinkedModuleActivityIds(draft.linkedModuleActivityIds);
      if (draft.aiMetadata && typeof draft.aiMetadata === 'object') setAiMetadata(draft.aiMetadata);
      if (typeof draft.syllabusSectionId === 'string' && draft.syllabusSectionId && !lockSyllabusSection) {
        setSyllabusSectionId(draft.syllabusSectionId);
      }
    } catch {
      /* ignore */
    }
  }, [open, classroomId, syllabusSectionId, initialData, lockSyllabusSection, isCreate]);

  useEffect(() => {
    if (!isCreate || !open || !classroomId || assignmentDraftHydratedSessionRef.current) return;
    if (initialData != null) return;
    const sectionKey = syllabusSectionId || 'none';
    assignmentDraftHydratedSessionRef.current = true;
    try {
      const raw = sessionStorage.getItem(assignmentCreateDraftKey(classroomId, sectionKey));
      if (!raw) return;
      const draft = JSON.parse(raw) as AssignmentCreateDraftV1;
      if (draft.formData && typeof draft.formData === 'object') {
        setFormData(() => {
          const merged = { ...getDefaultAssignmentWizardFormData(), ...draft.formData };
          const hs = merged.hard_skills as unknown;
          if (Array.isArray(hs) && hs.length > 0 && typeof (hs as unknown[])[0] === 'string') {
            merged.hard_skills = parseHardSkillsFromDb(hs as string[], merged.hard_skill_domain);
          }
          return merged;
        });
      }
      if (Array.isArray(draft.testQuestions)) setTestQuestions(draft.testQuestions);
      if (typeof draft.gradingCategoryId === 'string') setGradingCategoryId(draft.gradingCategoryId);
      if (Array.isArray(draft.linkedModuleActivityIds)) setLinkedModuleActivityIds(draft.linkedModuleActivityIds);
      if (draft.aiMetadata && typeof draft.aiMetadata === 'object') setAiMetadata(draft.aiMetadata);
      if (typeof draft.syllabusSectionId === 'string' && draft.syllabusSectionId && !lockSyllabusSection) {
        setSyllabusSectionId(draft.syllabusSectionId);
      }
    } catch {
      /* ignore */
    }
  }, [open, classroomId, initialData, syllabusSectionId, lockSyllabusSection, isCreate]);

  useEffect(() => {
    if (!isCreate || !open || !classroomId) return;
    if (assignmentDraftSaveTimerRef.current) clearTimeout(assignmentDraftSaveTimerRef.current);
    assignmentDraftSaveTimerRef.current = setTimeout(() => {
      assignmentDraftSaveTimerRef.current = null;
      const sectionKey = syllabusSectionId || initialData?.syllabus_section_id || 'none';
      try {
        const draft: AssignmentCreateDraftV1 = {
          formData,
          testQuestions,
          syllabusSectionId,
          gradingCategoryId,
          linkedModuleActivityIds,
          aiMetadata,
        };
        const raw = JSON.stringify(draft);
        if (raw.length > 4 * 1024 * 1024) return;
        sessionStorage.setItem(assignmentCreateDraftKey(classroomId, sectionKey), raw);
      } catch {
        /* quota */
      }
    }, 400);
    return () => {
      if (assignmentDraftSaveTimerRef.current) clearTimeout(assignmentDraftSaveTimerRef.current);
    };
  }, [
    isCreate,
    open,
    classroomId,
    formData,
    testQuestions,
    syllabusSectionId,
    gradingCategoryId,
    linkedModuleActivityIds,
    aiMetadata,
    initialData?.syllabus_section_id,
  ]);

  useEffect(() => {
    if (!open || !classroomId) return;
    let cancelled = false;
    (async () => {
      try {
        const { data: classroomData, error: classroomError } = await supabase
          .from('classrooms')
          .select('domains, materials')
          .eq('id', classroomId)
          .single();
        if (classroomError) throw classroomError;
        if (cancelled) return;
        const classroomDataWithExtras = classroomData as {
          domains?: Array<{ name: string; components: string[] }>;
          materials?: Array<{ type: 'pdf' | 'link'; url: string; name: string }>;
        };
        let domains: Array<{ name: string; components: string[] }> = [];
        if (classroomDataWithExtras?.domains) {
          domains = classroomDataWithExtras.domains;
          setClassroomDomains(domains);
        }
        if (classroomDataWithExtras?.materials) {
          setClassroomMaterials(classroomDataWithExtras.materials);
        }

        if (isCreate) {
          const { data: lastAssignment, error: assignmentError } = await supabase
            .from('assignments')
            .select('hard_skill_domain, hard_skills')
            .eq('classroom_id', classroomId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (!assignmentError && lastAssignment && !cancelled) {
            const rawSkills = lastAssignment.hard_skills;
            let parsedList: unknown = rawSkills;
            if (typeof rawSkills === 'string') {
              try {
                parsedList = JSON.parse(rawSkills);
              } catch {
                parsedList = rawSkills.split(',').map((s) => s.trim()).filter(Boolean);
              }
            }
            const pairs = parseHardSkillsFromDb(parsedList, lastAssignment.hard_skill_domain);
            if (pairs.length > 0) {
              const doms = distinctDomains(pairs);
              const singleDomain = doms.length === 1 ? doms[0]! : '';
              setFormData((prev) => ({
                ...prev,
                hard_skill_domain: singleDomain,
                hard_skills: pairs,
              }));
              if (singleDomain) {
                setSelectedDomain(singleDomain);
                const domain = domains.find((d) => d.name === singleDomain);
                if (domain) setAvailableComponents(domain.components);
              }
            } else if (lastAssignment.hard_skill_domain) {
              setSelectedDomain(lastAssignment.hard_skill_domain);
              const domain = domains.find((d) => d.name === lastAssignment.hard_skill_domain);
              if (domain) setAvailableComponents(domain.components);
            }
          }
        }
      } catch (e) {
        console.error('Error fetching classroom data:', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [classroomId, open, isCreate]);

  useEffect(() => {
    if (!open) return;
    if (isCreate) {
      setSyllabusSectionId(initialData?.syllabus_section_id ?? '');
      setGradingCategoryId(initialData?.grading_category_id ?? '');
    }
  }, [open, classroomId, initialData?.syllabus_section_id, initialData?.grading_category_id, isCreate]);

  useEffect(() => {
    if (!open || isCreate) return;
    if (!assignment?.id) return;
    let cancelled = false;
    (async () => {
      const { count } = await supabase
        .from('submissions')
        .select('id', { count: 'exact', head: true })
        .eq('assignment_id', assignment.id);
      if (!cancelled) setHasSubmissions((count ?? 0) > 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, assignment?.id, isCreate]);

  useEffect(() => {
    if (!open || !isCreate) return;
    const key = `${syllabusSectionId}|${syllabus?.id ?? ''}`;
    if (!syllabusSectionId || !syllabus?.section_resources) {
      if (!syllabusSectionId) {
        moduleLinkInitKeyRef.current = '';
        setLinkedModuleActivityIds([]);
      }
      return;
    }
    const list = syllabus.section_resources[syllabusSectionId] ?? [];
    if (key !== moduleLinkInitKeyRef.current) {
      moduleLinkInitKeyRef.current = key;
      setLinkedModuleActivityIds(list.map((r) => r.id));
    }
  }, [open, isCreate, syllabusSectionId, syllabus]);

  useEffect(() => {
    if (open && initialData && isCreate) {
      setFormData((prev) => ({
        ...prev,
        title: initialData.title || prev.title || '',
        instructions: initialData.instructions || prev.instructions || '',
        type: initialData.type || prev.type || 'chatbot',
        due_at: initialData.due_at || prev.due_at || '',
        target_dimensions:
          initialData.target_dimensions ||
          prev.target_dimensions || {
            vision: false,
            values: false,
            thinking: false,
            connection: false,
            action: false,
          },
      }));
      setAiMetadata({
        difficulty_level: initialData.difficulty_level,
        success_criteria: initialData.success_criteria,
        scaffolding_tips: initialData.scaffolding_tips,
      });
    }
    if (!open && isCreate) {
      setTestQuestions([]);
    }
  }, [open, isCreate, initialData == null ? '' : JSON.stringify(initialData)]);

  useEffect(() => {
    if (!open || !assignment || isCreate) return;

    setFormData({
      ...getDefaultAssignmentWizardFormData(),
      title: assignment.title,
      instructions: assignment.instructions,
      type: assignment.type,
      status: assignment.status,
      due_at: formatDueForForm(assignment.due_at),
      attempt_mode: assignment.attempt_mode ?? 'single',
    });

    const loadAssignmentData = async () => {
      const { data } = await supabase
        .from('assignments')
        .select(
          'hard_skills, hard_skill_domain, materials, auto_publish_ai_feedback, syllabus_section_id, grading_category_id',
        )
        .eq('id', assignment.id)
        .single();

      setFormData((prev) => ({
        ...prev,
        auto_publish_ai_feedback: data?.auto_publish_ai_feedback !== false,
      }));
      setSyllabusSectionId((data as { syllabus_section_id?: string | null })?.syllabus_section_id || '');
      setGradingCategoryId((data as { grading_category_id?: string | null })?.grading_category_id || '');

      let pairs: HardSkillPair[] = [];
      if (data?.hard_skills) {
        const raw = data.hard_skills as unknown;
        let parsedList: unknown = raw;
        if (typeof raw === 'string') {
          try {
            parsedList = JSON.parse(raw);
          } catch {
            parsedList = raw.split(',').map((s) => s.trim()).filter(Boolean);
          }
        }
        pairs = parseHardSkillsFromDb(parsedList, data.hard_skill_domain);
      }
      let mats: Array<{ type: 'pdf' | 'link'; url: string; name: string }> = [];
      if (data?.materials) {
        try {
          const parsed =
            typeof data.materials === 'string' ? JSON.parse(data.materials) : data.materials;
          mats = Array.isArray(parsed) ? parsed : [];
        } catch {
          mats = [];
        }
      }
      const hd = data?.hard_skill_domain || '';
      const displayDomain =
        pairs.length === 0
          ? hd
          : distinctDomains(pairs).length === 1
            ? distinctDomains(pairs)[0]!
            : '';
      setFormData((prev) => ({
        ...prev,
        hard_skills: pairs,
        hard_skill_domain: displayDomain,
        materials: mats,
      }));

      const sid = (data as { syllabus_section_id?: string | null })?.syllabus_section_id;
      const { data: existingLinks } = await getLinkedActivitiesForAssignment(assignment.id);
      if (existingLinks && existingLinks.length > 0) {
        setLinkedModuleActivityIds(existingLinks.map((l) => l.activity_list_id));
      } else if (sid) {
        const { data: rids } = await getSectionResourceIdsForSectionInOrder(sid);
        setLinkedModuleActivityIds(rids ?? []);
      } else {
        setLinkedModuleActivityIds([]);
      }
    };

    void loadAssignmentData();
  }, [open, assignment?.id, isCreate]);

  useEffect(() => {
    if (!open || isCreate || !formData.hard_skill_domain) return;
    const domain = formData.hard_skill_domain;
    const matched = classroomDomains.find((d) => d.name === domain);
    if (matched) {
      setSelectedDomain(domain);
      setAvailableComponents(matched.components);
    }
  }, [open, isCreate, formData.hard_skill_domain, classroomDomains]);

  useEffect(() => {
    if (!open || !assignment || isCreate || assignment.type !== 'test') return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('test_questions')
        .select('*')
        .eq('assignment_id', assignment.id)
        .order('order_index', { ascending: true });
      if (cancelled || error) return;
      setTestQuestions((data ?? []).map(dbRowToTestDraft));
    })();
    return () => {
      cancelled = true;
    };
  }, [open, assignment?.id, assignment?.type, isCreate]);

  useEffect(() => {
    if (!open || isCreate) {
      syllabusSectionPrevRef.current = null;
      return;
    }
    const prev = syllabusSectionPrevRef.current;
    if (prev === null) {
      syllabusSectionPrevRef.current = syllabusSectionId;
      return;
    }
    if (prev === syllabusSectionId) return;
    if (prev === '' && syllabusSectionId) {
      syllabusSectionPrevRef.current = syllabusSectionId;
      return;
    }
    syllabusSectionPrevRef.current = syllabusSectionId;
    if (!syllabusSectionId || !syllabus?.section_resources) {
      setLinkedModuleActivityIds([]);
      return;
    }
    const list = syllabus.section_resources[syllabusSectionId] ?? [];
    setLinkedModuleActivityIds(list.map((r) => r.id));
  }, [open, isCreate, syllabusSectionId, syllabus]);

  const handleRephraseInstructions = async () => {
    if (!formData.instructions.trim()) {
      toast.error(t('createAssignment.rephraseError'));
      return;
    }
    setRephrasingInstructions(true);
    try {
      const sectionResources = syllabus?.section_resources?.[syllabusSectionId] ?? [];
      const referenceContext =
        syllabusSectionId &&
        linkedModuleActivityIds.length > 0 &&
        sectionResources.length > 0
          ? buildModuleContextTextFromSyllabusResources(linkedModuleActivityIds, sectionResources)
          : '';
      const { data, error } = await supabase.functions.invoke('rephrase-text', {
        body: {
          text: formData.instructions,
          language: isRTL ? 'he' : 'en',
          ...(referenceContext ? { referenceContext } : {}),
        },
      });
      if (error) throw error;
      if (data?.rephrasedText) {
        setFormData((prev) => ({ ...prev, instructions: data.rephrasedText }));
        toast.success(t('createAssignment.rephraseSuccess'));
      }
    } catch {
      toast.error(t('createAssignment.rephraseError'));
    } finally {
      setRephrasingInstructions(false);
    }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.type !== 'application/pdf') {
      toast.error(t(isCreate ? 'createAssignment.errors.creating' : 'editAssignment.errors.saving'));
      return;
    }
    setUploadingMaterial(true);
    setUploadProgress(0);
    try {
      const fileName = `${user.id}/${Date.now()}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from('assignment-materials')
        .upload(fileName, file, { cacheControl: '3600', upsert: true });
      if (uploadError) throw uploadError;
      const {
        data: { publicUrl },
      } = supabase.storage.from('assignment-materials').getPublicUrl(fileName);
      setFormData((prev) => ({
        ...prev,
        materials: [...prev.materials, { type: 'pdf', url: publicUrl, name: file.name }],
      }));
      toast.success(t('createClassroom.success.pdfUploaded'));
      e.target.value = '';
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`${t(isCreate ? 'createAssignment.errors.creating' : 'editAssignment.errors.saving')}: ${msg}`);
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
        url.hostname.replace('www.', '') + (url.pathname !== '/' ? url.pathname.substring(0, 30) : '');
      setFormData((prev) => ({
        ...prev,
        materials: [
          ...prev.materials,
          { type: 'link', url: linkInput.trim(), name: linkName || linkInput.trim() },
        ],
      }));
      setLinkInput('');
      toast.success(t('createClassroom.success.linkAdded'));
    } catch {
      toast.error(t('createClassroom.errors.validUrl'));
    }
  };

  const handleRemoveMaterial = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      materials: prev.materials.filter((_, i) => i !== index),
    }));
  };

  const toggleClassroomMaterial = (index: number) => {
    const material = classroomMaterials[index];
    setSelectedMaterialIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
        setFormData((fd) => ({
          ...fd,
          materials: fd.materials.filter((m) => !(m.url === material.url && m.name === material.name)),
        }));
      } else {
        newSet.add(index);
        setFormData((fd) => {
          if (!fd.materials.some((m) => m.url === material.url && m.name === material.name)) {
            return { ...fd, materials: [...fd.materials, material] };
          }
          return fd;
        });
      }
      return newSet;
    });
  };

  const dueEffectiveDisabled = policyFrozen;

  const canProceedForStep = (stepId: AssignmentWizardStepId): boolean => {
    if (stepId === 'basics') {
      return Boolean(formData.title.trim() && formData.instructions.trim());
    }
    if (stepId === 'format') {
      if (formData.attempt_mode === 'multiple_until_due' && !dueEffectiveDisabled) {
        return Boolean(formData.due_at?.trim());
      }
      return true;
    }
    return true;
  };

  const runSuggestHardSkills = useCallback(
    async (snapshot: { instructions: string; type: string; title: string }) => {
      if (!isCreate || !classroomId) {
        console.info('[Perleap] suggest-assignment-hard-skills: skipped (not create mode or no classroomId)');
        return;
      }
      if (!classroomDomains.length) {
        console.info('[Perleap] suggest-assignment-hard-skills: skipped — classroom has no domains in domains[]');
        setHardSkillsSuggestionStatus('idle');
        return;
      }
      const token = ++suggestHardSkillsTokenRef.current;
      setHardSkillsSuggestionStatus('loading');
      console.info('[Perleap] suggest-assignment-hard-skills: invoking', {
        token,
        classroomId,
        assignmentType: snapshot.type,
        title: snapshot.title?.slice(0, 80),
        instructionsPreview: snapshot.instructions?.trim().slice(0, 120),
        domainCount: classroomDomains.length,
      });
      try {
        const { data, error } = await supabase.functions.invoke<{
          suggestions?: HardSkillPair[];
          error?: string;
        }>('suggest-assignment-hard-skills', {
          body: {
            classroomId,
            instructions: snapshot.instructions,
            assignmentType: snapshot.type,
            title: snapshot.title,
            domains: classroomDomains,
            language: isRTL ? 'he' : 'en',
          },
        });
        if (token !== suggestHardSkillsTokenRef.current) {
          console.info('[Perleap] suggest-assignment-hard-skills: ignored stale response', { token, latest: suggestHardSkillsTokenRef.current });
          return;
        }
        if (error) throw error;
        const suggestions = Array.isArray(data?.suggestions) ? data!.suggestions! : [];
        const doms = distinctDomains(suggestions);
        const singleDomain = doms.length === 1 ? doms[0]! : '';
        console.info('[Perleap] suggest-assignment-hard-skills: success', {
          token,
          count: suggestions.length,
          skillsChosen: suggestions.map((p) => `${p.domain} → ${p.skill}`),
          structured: suggestions,
          singleDomainForForm: singleDomain || '(multiple or none)',
        });
        setFormData((prev) => ({
          ...prev,
          hard_skills: suggestions,
          hard_skill_domain: singleDomain,
        }));
        if (singleDomain) {
          const d = classroomDomains.find((x) => x.name === singleDomain);
          setSelectedDomain(singleDomain);
          if (d) setAvailableComponents(d.components);
        } else {
          setSelectedDomain('');
          setAvailableComponents([]);
        }
        setHardSkillsSuggestionStatus('success');
      } catch (e) {
        if (token !== suggestHardSkillsTokenRef.current) {
          console.info('[Perleap] suggest-assignment-hard-skills: error ignored (stale)', { token });
          return;
        }
        console.error('[Perleap] suggest-assignment-hard-skills: error', e);
        setHardSkillsSuggestionStatus('error');
      }
    },
    [isCreate, classroomId, classroomDomains, isRTL],
  );

  const handleNext = () => {
    if (!canProceedForStep(currentStepId)) return;
    const i = stepOrder.indexOf(currentStepId);
    if (i < 0 || i >= stepOrder.length - 1) return;
    if (currentStepId === 'format' && isCreate) {
      void runSuggestHardSkills({
        instructions: formData.instructions,
        type: formData.type,
        title: formData.title,
      });
    }
    setCurrentStepId(stepOrder[i + 1]!);
  };

  const handleBack = () => {
    const i = stepOrder.indexOf(currentStepId);
    if (i <= 0) return;
    setCurrentStepId(stepOrder[i - 1]!);
  };

  const resetWizardUi = () => {
    setCurrentStepId(ASSIGNMENT_WIZARD_FIRST_STEP);
    if (isCreate) resetCreateDefaults();
  };

  const handleDialogOpenChange = (val: boolean) => {
    onOpenChange(val);
    if (!val) resetWizardUi();
  };

  const handleSubmit = async () => {
    if (loading) return;
    if (!canProceedForStep('basics') || !canProceedForStep('format')) {
      toast.error(t('createAssignment.wizard.fixValidation'));
      return;
    }

    setLoading(true);
    try {
      if (formData.attempt_mode === 'multiple_until_due' && !formData.due_at?.trim() && !dueEffectiveDisabled) {
        toast.error(t('createAssignment.attemptMode.dueRequiredForRetries'));
        setLoading(false);
        return;
      }

      if (isCreate && classroomId) {
        const insertRow = {
          classroom_id: classroomId,
          title: formData.title,
          instructions: formData.instructions,
          type: formData.type as Database['public']['Enums']['assignment_type'],
          due_at: formData.due_at || null,
          attempt_mode: formData.attempt_mode,
          status: formData.status as Database['public']['Enums']['assignment_status'],
          hard_skills: JSON.stringify(formData.hard_skills),
          hard_skill_domain: resolveHardSkillDomainForDb(formData.hard_skills, formData.hard_skill_domain),
          materials: formData.materials,
          target_dimensions: formData.target_dimensions,
          personalization_flag: formData.personalization_flag,
          auto_publish_ai_feedback: formData.auto_publish_ai_feedback,
          assigned_student_id: assignedStudentId || null,
          syllabus_section_id: syllabusSectionId || null,
          grading_category_id: gradingCategoryId || null,
        };
        const { data: assignmentRow, error } = await supabase
          .from('assignments')
          .insert([insertRow as never])
          .select()
          .single();

        if (error) throw error;

        if (assignmentRow) {
          const items = linkedModuleActivityIds.map((id, i) => ({
            activity_list_id: id,
            order_index: i,
            include_in_ai_context: true,
          }));
          const { error: linkErr } = await setAssignmentLinkedActivities(
            assignmentRow.id,
            syllabusSectionId || null,
            items,
          );
          if (linkErr) {
            console.error('assignment module activities:', linkErr);
            toast.warning(
              t(
                'syllabus.moduleActivities.linkSaveWarning',
                'Assignment was created, but module activity links could not be saved. You can edit the assignment to fix them.',
              ),
            );
          }
        }

        if (formData.type === 'test' && testQuestions.length > 0 && assignmentRow) {
          const questionsToInsert = testQuestions.map((q) => ({
            assignment_id: assignmentRow.id,
            question_text: q.question_text,
            question_type: q.question_type,
            options: q.question_type === 'multiple_choice' ? q.options : null,
            correct_option_id: q.question_type === 'multiple_choice' ? q.correct_option_id : null,
            order_index: q.order_index,
          }));
          const { error: questionsError } = await supabase.from('test_questions').insert(questionsToInsert);
          if (questionsError) console.error('Error inserting test questions:', questionsError);
        }

        if (assignmentRow && formData.status === 'published') {
          try {
            if (assignedStudentId) {
              await createBulkNotifications([
                {
                  userId: assignedStudentId,
                  type: 'assignment_created' as const,
                  title: 'New Personalized Assignment',
                  message: `A follow-up assignment "${formData.title}" has been created for you`,
                  link: `/student/assignment/${assignmentRow.id}`,
                  actorId: user!.id,
                  metadata: {
                    assignment_id: assignmentRow.id,
                    classroom_id: classroomId,
                    assignment_title: formData.title,
                  },
                },
              ]);
            } else {
              const { data: enrollments } = await supabase
                .from('enrollments')
                .select('student_id')
                .eq('classroom_id', classroomId);
              if (enrollments && enrollments.length > 0) {
                const notifications = enrollments.map((e) => ({
                  userId: e.student_id,
                  type: 'assignment_created' as const,
                  title: 'New Assignment',
                  message: `New assignment "${formData.title}" has been posted`,
                  link: `/student/assignment/${assignmentRow.id}`,
                  actorId: user!.id,
                  metadata: {
                    assignment_id: assignmentRow.id,
                    classroom_id: classroomId,
                    assignment_title: formData.title,
                  },
                }));
                await createBulkNotifications(notifications);
              }
            }
          } catch (e) {
            console.error('Error sending notifications:', e);
          }
        }

        try {
          await supabase.from('activity_events' as never).insert([
            {
              teacher_id: user!.id,
              type: 'create',
              entity_type: 'assignment',
              entity_id: assignmentRow.id,
              title: `Created assignment: ${formData.title}`,
              route: `/teacher/classroom/${classroomId}`,
            },
          ]);
        } catch {
          /* non-critical */
        }

        toast.success(t('createAssignment.success.created'));
        if (assignmentRow?.id) onCreatedAssignment?.(assignmentRow.id);
        if (syllabusSectionId) {
          await syncModuleFlowToResolvedDisplayForSection(queryClient, classroomId, syllabusSectionId, {
            ensureAssignmentIds: assignmentRow?.id ? [assignmentRow.id] : undefined,
          });
        } else {
          await queryClient.invalidateQueries({ queryKey: syllabusKeys.byClassroom(classroomId) });
          await queryClient.invalidateQueries({ queryKey: assignmentKeys.listByClassroom(classroomId) });
          await queryClient.invalidateQueries({ queryKey: moduleFlowKeys.all });
        }
        try {
          sessionStorage.removeItem(
            assignmentCreateDraftKey(classroomId, syllabusSectionId || initialData?.syllabus_section_id || 'none'),
          );
        } catch {
          /* ignore */
        }
        handleDialogOpenChange(false);
        onSuccess();
        return;
      }

      if (!isCreate && assignment) {
        const wasPublished = assignment.status === 'draft' && formData.status === 'published';

        const baseUpdate: Record<string, unknown> = {
          title: formData.title,
          instructions: formData.instructions,
          type: formData.type as Database['public']['Enums']['assignment_type'],
          status: formData.status as Database['public']['Enums']['assignment_status'],
          hard_skills: JSON.stringify(formData.hard_skills),
          hard_skill_domain: resolveHardSkillDomainForDb(formData.hard_skills, formData.hard_skill_domain),
          materials: formData.materials,
          auto_publish_ai_feedback: formData.auto_publish_ai_feedback,
          syllabus_section_id: syllabusSectionId || null,
          grading_category_id: gradingCategoryId || null,
        };

        if (!hasSubmissions) {
          baseUpdate.due_at = formData.due_at || null;
          baseUpdate.attempt_mode = formData.attempt_mode;
        } else if (hasSubmissions && !hasDueDateInDb) {
          baseUpdate.due_at = formData.due_at || null;
          baseUpdate.attempt_mode = formData.attempt_mode;
        }

        const { error } = await supabase.from('assignments').update(baseUpdate).eq('id', assignment.id);
        if (error) throw error;

        const linkItems = linkedModuleActivityIds.map((id, i) => ({
          activity_list_id: id,
          order_index: i,
          include_in_ai_context: true,
        }));
        const { error: linkErr } = await setAssignmentLinkedActivities(
          assignment.id,
          syllabusSectionId || null,
          linkItems,
        );
        if (linkErr) {
          toast.warning(
            t(
              'syllabus.moduleActivities.linkSaveWarning',
              'Assignment was saved, but module activity links could not be updated.',
            ),
          );
        }

        if (formData.type === 'test' && !hasSubmissions) {
          const { error: delErr } = await supabase.from('test_questions').delete().eq('assignment_id', assignment.id);
          if (delErr) console.error(delErr);
          if (testQuestions.length > 0) {
            const questionsToInsert = testQuestions.map((q) => ({
              assignment_id: assignment.id,
              question_text: q.question_text,
              question_type: q.question_type,
              options: q.question_type === 'multiple_choice' ? q.options : null,
              correct_option_id: q.question_type === 'multiple_choice' ? q.correct_option_id : null,
              order_index: q.order_index,
            }));
            const { error: insErr } = await supabase.from('test_questions').insert(questionsToInsert);
            if (insErr) console.error(insErr);
          }
          await queryClient.invalidateQueries({ queryKey: testKeys.questions(assignment.id) });
        }

        if (wasPublished) {
          try {
            let classroomIdForNotify = assignment.classroom_id;
            if (!classroomIdForNotify) {
              const { data: assignmentData } = await supabase
                .from('assignments')
                .select('classroom_id')
                .eq('id', assignment.id)
                .single();
              classroomIdForNotify = assignmentData?.classroom_id;
            }
            if (classroomIdForNotify) {
              const { data: enrollments, error: enrollError } = await supabase
                .from('enrollments')
                .select('student_id')
                .eq('classroom_id', classroomIdForNotify);
              if (!enrollError && enrollments && enrollments.length > 0) {
                const notifications = enrollments.map((enrollment) => ({
                  userId: enrollment.student_id,
                  type: 'assignment_created' as const,
                  title: 'New Assignment Posted',
                  message: `${formData.title} has been assigned`,
                  link: `/student/assignment/${assignment.id}`,
                  actorId: user!.id,
                  metadata: {
                    assignment_id: assignment.id,
                    classroom_id: classroomIdForNotify,
                    assignment_title: formData.title,
                    due_at: formData.due_at || null,
                  },
                }));
                await createBulkNotifications(notifications);
              }
            }
          } catch {
            /* non-critical */
          }
        }

        toast.success(t('editAssignment.success.saved'));
        const cid = assignment.classroom_id;
        if (cid) {
          if (syllabusSectionId) {
            await syncModuleFlowToResolvedDisplayForSection(queryClient, cid, syllabusSectionId);
          } else {
            await queryClient.invalidateQueries({ queryKey: syllabusKeys.byClassroom(cid) });
            await queryClient.invalidateQueries({ queryKey: assignmentKeys.listByClassroom(cid) });
            await queryClient.invalidateQueries({ queryKey: moduleFlowKeys.all });
          }
        }
        handleDialogOpenChange(false);
        onSuccess();
      }
    } catch (e) {
      console.error(e);
      toast.error(t(isCreate ? 'createAssignment.errors.creating' : 'editAssignment.errors.saving'));
    } finally {
      setLoading(false);
    }
  };

  const basicsKey = isCreate
    ? open
      ? `${classroomId}-${initialData?.title ?? 'new'}`
      : 'closed'
    : assignment?.id ?? 'closed';

  const headerTitle = isCreate ? t('createAssignment.title') : t('editAssignment.title');

  const headerDescription = isCreate
    ? t('createAssignment.description')
    : t('editAssignment.description');

  const finalButtonLabel = isCreate
    ? t('createAssignment.createButton')
    : t('editAssignment.saveButton');

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent
        dir={isRTL ? 'rtl' : 'ltr'}
        className="sm:max-w-6xl w-[95vw] max-h-[92vh] h-[92vh] p-0 overflow-hidden rounded-xl border-none shadow-2xl bg-background flex flex-col"
        showCloseButton
      >
        <div className="px-6 pt-6 pb-4 border-b border-border bg-gradient-to-br from-muted/20 to-transparent flex-shrink-0">
          <h2
            className={`text-2xl font-bold tracking-tight text-heading mb-1 ${isRTL ? 'text-right' : 'text-left'}`}
          >
            {headerTitle}
          </h2>
          <p className={`text-subtle text-body mb-4 ${isRTL ? 'text-right' : 'text-left'}`}>{headerDescription}</p>
          <WizardStepIndicator steps={indicatorSteps} currentStep={currentStepIndex} isRTL={isRTL} />
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="px-6 py-6">
            {currentStepId === 'basics' && (
              <AssignmentBasicsStep
                formData={formData}
                onFormChange={(partial) => setFormData((prev) => ({ ...prev, ...partial }))}
                isRTL={isRTL}
                rephrasingInstructions={rephrasingInstructions}
                onRephrase={() => void handleRephraseInstructions()}
                basicsTextareaKey={basicsKey}
              />
            )}
            {currentStepId === 'format' && (
              <AssignmentFormatStep
                formData={formData}
                onFormChange={(updater) => setFormData(updater)}
                isRTL={isRTL}
                dueDateDisabled={dueEffectiveDisabled}
                attemptPolicyFrozen={policyFrozen}
              />
            )}
            {currentStepId === 'courseRelease' && (
              <AssignmentCourseReleaseStep
                syllabus={syllabus ?? undefined}
                syllabusLoading={isSyllabusLoading}
                syllabusSectionId={syllabusSectionId}
                onSyllabusSectionIdChange={setSyllabusSectionId}
                gradingCategoryId={gradingCategoryId}
                onGradingCategoryIdChange={setGradingCategoryId}
                linkedModuleActivityIds={linkedModuleActivityIds}
                onLinkedModuleActivityIdsChange={setLinkedModuleActivityIds}
                isRTL={isRTL}
                lockSyllabusSection={lockSyllabusSection}
                loading={loading}
                formData={formData}
                onFormChange={(updater) => setFormData(updater)}
              />
            )}
            {currentStepId === 'skills' && (
              <AssignmentSkillsMaterialsStep
                formData={formData}
                onFormChange={(updater) => setFormData(updater)}
                isRTL={isRTL}
                isEditMode={!isCreate}
                classroomDomains={classroomDomains}
                classroomMaterials={classroomMaterials}
                selectedDomain={selectedDomain}
                onSelectedDomainChange={setSelectedDomain}
                availableComponents={availableComponents}
                onAvailableComponentsChange={setAvailableComponents}
                selectedMaterialIds={selectedMaterialIds}
                onToggleClassroomMaterial={toggleClassroomMaterial}
                linkInput={linkInput}
                onLinkInputChange={setLinkInput}
                onAddLink={handleAddLink}
                onPdfUpload={(e) => void handlePdfUpload(e)}
                onRemoveMaterial={handleRemoveMaterial}
                uploadingMaterial={uploadingMaterial}
                uploadProgress={uploadProgress}
                hardSkillsSuggestionStatus={isCreate ? hardSkillsSuggestionStatus : 'idle'}
                onRetrySuggestHardSkills={
                  isCreate
                    ? () =>
                        void runSuggestHardSkills({
                          instructions: formData.instructions,
                          type: formData.type,
                          title: formData.title,
                        })
                    : undefined
                }
              />
            )}
            {currentStepId === 'test' && (
              <AssignmentTestStep
                questions={testQuestions}
                onQuestionsChange={setTestQuestions}
                isRTL={isRTL}
                readOnly={!isCreate && hasSubmissions}
              />
            )}
            {currentStepId === 'review' && (
              <AssignmentReviewStep
                formData={formData}
                syllabus={syllabus ?? undefined}
                syllabusSectionId={syllabusSectionId}
                testQuestions={testQuestions}
                onJumpToStep={setCurrentStepId}
                isRTL={isRTL}
              />
            )}
          </div>
        </ScrollArea>

        <div className="px-6 py-4 border-t border-border flex-shrink-0">
          <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div>
              {currentStepIndex > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleBack}
                  disabled={loading}
                  className="rounded-full gap-2"
                >
                  {isRTL ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
                  {t('syllabus.wizard.back')}
                </Button>
              )}
            </div>
            <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Button type="button" variant="ghost" onClick={() => handleDialogOpenChange(false)} disabled={loading}>
                {t('createAssignment.cancel')}
              </Button>
              {!isLastStep ? (
                <Button
                  type="button"
                  onClick={handleNext}
                  disabled={!canProceedForStep(currentStepId) || loading}
                  className="rounded-full px-8 font-bold shadow-lg shadow-primary/20 gap-2"
                >
                  {t('syllabus.wizard.next')}
                  {isRTL ? <ArrowLeft className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={loading || !canProceedForStep('basics')}
                  className="rounded-full px-10 font-bold shadow-lg shadow-primary/20"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin me-2" />
                      {!isCreate ? t('editAssignment.saving') : t('createAssignment.createButton')}
                    </>
                  ) : (
                    finalButtonLabel
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
