/**
 * Produces a short, student-facing task summary from the full assignment instructions.
 * Deploy: supabase functions deploy generate-student-facing-task
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createChatCompletion } from '../shared/openai.ts';
import { isAppAdmin } from '../shared/supabase.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, serviceKey);

    const token = authHeader.replace(/^Bearer\s+/i, '');
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const language = body.language === 'he' ? 'he' : 'en';
    const assignmentIdRaw = typeof body.assignmentId === 'string' ? body.assignmentId.trim() : '';

    let classroomId = typeof body.classroomId === 'string' ? body.classroomId.trim() : '';
    let title = typeof body.title === 'string' ? body.title : '';
    let instructions = typeof body.instructions === 'string' ? body.instructions : '';
    let persistAssignmentId: string | null = null;

    if (assignmentIdRaw) {
      const { data: row, error: rowErr } = await supabase
        .from('assignments')
        .select('id, classroom_id, title, instructions, student_facing_task, status, active, assigned_student_id')
        .eq('id', assignmentIdRaw)
        .eq('active', true)
        .maybeSingle();

      if (rowErr || !row) {
        return new Response(JSON.stringify({ error: 'Assignment not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const a = row as {
        id: string;
        classroom_id: string;
        title: string;
        instructions: string;
        student_facing_task: string | null;
        status: string;
        assigned_student_id: string | null;
      };

      if (a.student_facing_task?.trim()) {
        return new Response(
          JSON.stringify({ studentFacingTask: a.student_facing_task.trim(), source: 'db' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const { data: classroomRow, error: cErr } = await supabase
        .from('classrooms')
        .select('teacher_id')
        .eq('id', a.classroom_id)
        .maybeSingle();
      if (cErr || !classroomRow) {
        return new Response(JSON.stringify({ error: 'Classroom not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const teacherId = (classroomRow as { teacher_id: string }).teacher_id;
      const isTeacher = teacherId === user.id;
      const isAdmin = await isAppAdmin(user.id);

      let canStudent = false;
      if (!isTeacher && !isAdmin) {
        if (a.status !== 'published') {
          return new Response(JSON.stringify({ error: 'Forbidden' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        if (a.assigned_student_id && a.assigned_student_id !== user.id) {
          return new Response(JSON.stringify({ error: 'Forbidden' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const { data: enr, error: enrErr } = await supabase
          .from('enrollments')
          .select('student_id')
          .eq('classroom_id', a.classroom_id)
          .eq('student_id', user.id)
          .eq('active', true)
          .maybeSingle();
        if (enrErr || !enr) {
          return new Response(JSON.stringify({ error: 'Forbidden' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        canStudent = true;
      }

      if (!isTeacher && !isAdmin && !canStudent) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      classroomId = a.classroom_id;
      title = a.title;
      instructions = a.instructions;
      persistAssignmentId = a.id;
      if (!instructions.trim()) {
        return new Response(JSON.stringify({ error: 'instructions are empty' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      if (!classroomId) {
        return new Response(JSON.stringify({ error: 'classroomId is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (!instructions.trim()) {
        return new Response(JSON.stringify({ error: 'instructions are required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { data: classroom, error: classErr } = await supabase
        .from('classrooms')
        .select('teacher_id')
        .eq('id', classroomId)
        .maybeSingle();

      if (classErr || !classroom) {
        return new Response(JSON.stringify({ error: 'Classroom not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if ((classroom as { teacher_id: string }).teacher_id !== user.id) {
        const admin = await isAppAdmin(user.id);
        if (!admin) {
          return new Response(JSON.stringify({ error: 'Forbidden' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    const systemEn = `You write the **student task card** — a short, plain description of what the **learner is actually doing in their head** (the irreducible learning job): what to think about, decide, justify, or create, in everyday student language.

You receive the assignment **title** and the teacher's **full internal brief** (AI-tutor script, rubric, steps, mandatory openings, submission templates, validation rules for the bot, etc.).

**Extract and compress** the real learning outcome:
- **Prioritize** sections such as: Learning Outcome, "By the end… the student will…", pedagogical / learning goal, and what the student must **decide, map, or defend** in their own words.
- **Do NOT** turn into the task: chat choreography ("Step 1… Step 2…"), how Perleap or the bot should talk, MANDATORY opening lines, submission markdown or field templates, or internal scoring/validation—unless a single line is *directly* the cognitive requirement.
- **Do NOT** make the main message "use the chat" or "work with the AI" — the card is the **task**, not the delivery channel.
- 3–6 short lines; bullet list allowed; you may use "You…" / direct address. Plain line breaks only in the value (no JSON or markdown inside the string beyond simple bullets).
- Language: match the assignment text; if mixed, prefer UI language hint: ${language === 'he' ? 'Hebrew' : 'English'}.
- If you cannot infer a real cognitive task, return {"studentFacingTask":""}.

Output ONLY valid JSON: {"studentFacingTask":"<text>"}`;

    const systemHe = `אתה כותב **כרטיס משימה לתלמיד** — תיאור קצר, בשפה פשוטה, של **מה הלומד עושה בראש** (העבודה הלימודית המהותית): על מה לחשוב, מה לבחור, להנמיך, או להצדיק, במילים של תלמיד.

אתה מקבל **כותרת** ו־**מסמך הוראות מלא** (סקריפט לבוט, מחוון, שלבים, פתיח חובה, תבנית הגשה, וכו').

**מזקק** את תוצר הלמידה:
- **העדיף** מקטעים כמו: תוצר למידה, "עד סוף…", מטרה פדגוגית, **מה על התלמיד להחליט, למפות, או להגן** על בחירה.
- **אל** תהפוך למשימה: כוריאוגרפיה בצ'אט, איך הבוט מדבר, שורת פתיח, תבנית שדות הגשה, או מחוון פנימי — אלא אם שורה אחת היא *בעצם* הדרישה.
- **אל** שים במרכז "השתמשו בצ'אט" או "הבינה" — הכרטיס הוא **המשימה**, לא הערוץ.
- 3–6 שורות; אפשר רשימה; "אתה…" / פנייה ישירה. שורות פשוטות בלבד.
- שפה: כמו המסמכים; אם מעורב, עדיף ${language === 'he' ? 'עברית' : 'אנגלית'}.
- אם אי אפשר, החזר {"studentFacingTask":""}.

החזר רק JSON: {"studentFacingTask":"..."}`;

    const userBlock = `Assignment title: ${title.trim() || '(untitled)'}

When present, lean heavily on "Learning Outcome" / "learning goal" / "By the end the student"–style sections for the **cognitive** task, not the tutor script.

Full teacher/AI instruction text (for your eyes only; distill the learner task, not the bot manual):
${instructions.trim()}`;

    const { content } = (await createChatCompletion(
      language === 'he' ? systemHe : systemEn,
      [{ role: 'user', content: userBlock }],
      0.3,
      800,
      'fast',
      false,
      'json_object',
    )) as { content: string };

    let studentFacingTask = '';
    try {
      const p = JSON.parse(content || '{}') as { studentFacingTask?: unknown };
      if (typeof p.studentFacingTask === 'string') {
        studentFacingTask = p.studentFacingTask.trim();
      }
    } catch {
      studentFacingTask = '';
    }

    if (!studentFacingTask) {
      return new Response(JSON.stringify({ error: 'Could not generate student summary' }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (persistAssignmentId) {
      const { error: upErr } = await supabase
        .from('assignments')
        .update({ student_facing_task: studentFacingTask, updated_at: new Date().toISOString() })
        .eq('id', persistAssignmentId);
      if (upErr) {
        return new Response(JSON.stringify({ error: 'Failed to save student task summary' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(
      JSON.stringify({
        studentFacingTask,
        source: 'generated',
        persisted: Boolean(persistAssignmentId),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
