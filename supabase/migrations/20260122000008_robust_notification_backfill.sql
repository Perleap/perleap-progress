-- More aggressive backfill for actor_id in notifications
-- This targets older notifications that have assignment_id or submission_id in metadata but no explicit student_id/teacher_id

-- 1. Backfill for feedback_received (from teacher)
UPDATE public.notifications n
SET actor_id = c.teacher_id
FROM public.submissions s
JOIN public.assignments a ON s.assignment_id = a.id
JOIN public.classrooms c ON a.classroom_id = c.id
WHERE n.actor_id IS NULL
  AND n.type = 'feedback_received'
  AND n.metadata->>'submission_id' IS NOT NULL
  AND n.metadata->>'submission_id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND s.id = (n.metadata->>'submission_id')::uuid
  AND EXISTS (SELECT 1 FROM auth.users WHERE id = c.teacher_id);

-- 2. Backfill for assignment_created (from teacher)
UPDATE public.notifications n
SET actor_id = c.teacher_id
FROM public.assignments a
JOIN public.classrooms c ON a.classroom_id = c.id
WHERE n.actor_id IS NULL
  AND n.type = 'assignment_created'
  AND n.metadata->>'assignment_id' IS NOT NULL
  AND n.metadata->>'assignment_id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND a.id = (n.metadata->>'assignment_id')::uuid
  AND EXISTS (SELECT 1 FROM auth.users WHERE id = c.teacher_id);

-- 3. Backfill for student_completed_activity (from student)
UPDATE public.notifications n
SET actor_id = s.student_id
FROM public.submissions s
WHERE n.actor_id IS NULL
  AND n.type = 'student_completed_activity'
  AND n.metadata->>'submission_id' IS NOT NULL
  AND n.metadata->>'submission_id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND s.id = (n.metadata->>'submission_id')::uuid
  AND EXISTS (SELECT 1 FROM auth.users WHERE id = s.student_id);

-- 4. Backfill for student_enrolled (from student)
UPDATE public.notifications n
SET actor_id = (n.metadata->>'student_id')::uuid
WHERE n.actor_id IS NULL
  AND n.type = 'student_enrolled'
  AND n.metadata->>'student_id' IS NOT NULL
  AND n.metadata->>'student_id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND EXISTS (SELECT 1 FROM auth.users WHERE id = (n.metadata->>'student_id')::uuid);
