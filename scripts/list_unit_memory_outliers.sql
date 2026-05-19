-- Completed submissions missing course-memory processing (see processed_submission_ids).
-- Section-level markers: facts[] in student_section_unit_memory.
-- Ops: npm run extract:unit-memory-outliers (after deploy + migrate:section-memory-to-course)

WITH eligible AS (
  SELECT
    s.id AS submission_id,
    s.student_id,
    s.submitted_at,
    a.title AS assignment_title,
    a.type AS assignment_type,
    a.classroom_id,
    a.syllabus_section_id
  FROM submissions s
  JOIN assignments a ON a.id = s.assignment_id
  WHERE s.status = 'completed'
    AND COALESCE(s.is_teacher_attempt, false) = false
    AND a.classroom_id IS NOT NULL
    AND a.syllabus_section_id IS NOT NULL
)
SELECT
  e.submission_id,
  e.submitted_at,
  e.assignment_title,
  e.assignment_type,
  EXISTS (
    SELECT 1
    FROM student_section_unit_memory m
    WHERE m.student_id = e.student_id
      AND m.classroom_id = e.classroom_id
      AND m.syllabus_section_id = e.syllabus_section_id
  ) AS unit_row_exists,
  (
    SELECT jsonb_array_length(m.facts)
    FROM student_section_unit_memory m
    WHERE m.student_id = e.student_id
      AND m.classroom_id = e.classroom_id
      AND m.syllabus_section_id = e.syllabus_section_id
  ) AS facts_in_unit
FROM eligible e
WHERE NOT EXISTS (
  SELECT 1
  FROM student_section_unit_memory m
  CROSS JOIN LATERAL jsonb_array_elements(m.facts) AS f
  WHERE m.student_id = e.student_id
    AND m.classroom_id = e.classroom_id
    AND m.syllabus_section_id = e.syllabus_section_id
    AND f->>'submission_id' = e.submission_id::text
)
ORDER BY facts_in_unit ASC NULLS FIRST, e.submitted_at ASC;
