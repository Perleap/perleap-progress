from pathlib import Path

p = Path(__file__).resolve().parent.parent / "src" / "integrations" / "supabase" / "types.ts"
t = p.read_text(encoding="utf-8").replace("\r\n", "\n")

OLD_ASSIGNMENTS = r"""      assignments: {
        Row: {
          active: boolean
          assigned_student_id: string | null
          auto_publish_ai_feedback: boolean
          attempt_mode: Database["public"]["Enums"]["assignment_attempt_mode"]
          classroom_id: string
          created_at: string
          deleted_at: string | null
          due_at: string | null
          hard_skill_domain: string | null
          hard_skills: string | null
          id: string
          instructions: string
          materials: Json | null
          personalization_flag: boolean | null
          status: Database["public"]["Enums"]["assignment_status"]
          target_dimensions: Json
          title: string
          type: Database["public"]["Enums"]["assignment_type"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          assigned_student_id?: string | null
          auto_publish_ai_feedback?: boolean
          attempt_mode?: Database["public"]["Enums"]["assignment_attempt_mode"]
          classroom_id: string
          created_at?: string
          deleted_at?: string | null
          due_at?: string | null
          hard_skill_domain?: string | null
          hard_skills?: string | null
          id?: string
          instructions: string
          materials?: Json | null
          personalization_flag?: boolean | null
          status?: Database["public"]["Enums"]["assignment_status"]
          target_dimensions?: Json
          title: string
          type?: Database["public"]["Enums"]["assignment_type"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          assigned_student_id?: string | null
          auto_publish_ai_feedback?: boolean
          attempt_mode?: Database["public"]["Enums"]["assignment_attempt_mode"]
          classroom_id?: string
          created_at?: string
          deleted_at?: string | null
          due_at?: string | null
          hard_skill_domain?: string | null
          hard_skills?: string | null
          id?: string
          instructions?: string
          materials?: Json | null
          personalization_flag?: boolean | null
          status?: Database["public"]["Enums"]["assignment_status"]
          target_dimensions?: Json
          title?: string
          type?: Database["public"]["Enums"]["assignment_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
        ]
      }"""

NEW_ASSIGNMENTS = r"""      assignments: {
        Row: {
          active: boolean
          assigned_student_id: string | null
          auto_publish_ai_feedback: boolean
          attempt_mode: Database["public"]["Enums"]["assignment_attempt_mode"]
          classroom_id: string
          created_at: string
          deleted_at: string | null
          due_at: string | null
          grading_category_id: string | null
          hard_skill_domain: string | null
          hard_skills: string | null
          id: string
          instructions: string
          materials: Json | null
          personalization_flag: boolean | null
          status: Database["public"]["Enums"]["assignment_status"]
          student_facing_task: string | null
          syllabus_section_id: string | null
          target_dimensions: Json
          title: string
          type: Database["public"]["Enums"]["assignment_type"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          assigned_student_id?: string | null
          auto_publish_ai_feedback?: boolean
          attempt_mode?: Database["public"]["Enums"]["assignment_attempt_mode"]
          classroom_id: string
          created_at?: string
          deleted_at?: string | null
          due_at?: string | null
          grading_category_id?: string | null
          hard_skill_domain?: string | null
          hard_skills?: string | null
          id?: string
          instructions: string
          materials?: Json | null
          personalization_flag?: boolean | null
          status?: Database["public"]["Enums"]["assignment_status"]
          student_facing_task?: string | null
          syllabus_section_id?: string | null
          target_dimensions?: Json
          title: string
          type?: Database["public"]["Enums"]["assignment_type"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          assigned_student_id?: string | null
          auto_publish_ai_feedback?: boolean
          attempt_mode?: Database["public"]["Enums"]["assignment_attempt_mode"]
          classroom_id?: string
          created_at?: string
          deleted_at?: string | null
          due_at?: string | null
          grading_category_id?: string | null
          hard_skill_domain?: string | null
          hard_skills?: string | null
          id?: string
          instructions?: string
          materials?: Json | null
          personalization_flag?: boolean | null
          status?: Database["public"]["Enums"]["assignment_status"]
          student_facing_task?: string | null
          syllabus_section_id?: string | null
          target_dimensions?: Json
          title?: string
          type?: Database["public"]["Enums"]["assignment_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_assigned_student_id_fkey_profiles"
            columns: ["assigned_student_id"]
            isOneToOne: false
            referencedRelation: "student_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }"""

OLD_SUBMISSIONS = r"""      submissions: {
        Row: {
          assignment_id: string
          attempt_number: number
          awaiting_teacher_feedback_release: boolean
          file_url: string | null
          id: string
          status: Database["public"]["Enums"]["submission_status"]
          student_id: string
          submitted_at: string
          text_body: string | null
        }
        Insert: {
          assignment_id: string
          attempt_number?: number
          awaiting_teacher_feedback_release?: boolean
          file_url?: string | null
          id?: string
          status?: Database["public"]["Enums"]["submission_status"]
          student_id: string
          submitted_at?: string
          text_body?: string | null
        }
        Update: {
          assignment_id?: string
          attempt_number?: number
          awaiting_teacher_feedback_release?: boolean
          file_url?: string | null
          id?: string
          status?: Database["public"]["Enums"]["submission_status"]
          student_id?: string
          submitted_at?: string
          text_body?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
        ]
      }"""

NEW_SUBMISSIONS = r"""      submissions: {
        Row: {
          assignment_id: string
          attempt_number: number
          awaiting_teacher_feedback_release: boolean
          conversation_complete_at_submit: boolean | null
          file_url: string | null
          id: string
          status: Database["public"]["Enums"]["submission_status"]
          student_id: string
          submitted_at: string
          text_body: string | null
        }
        Insert: {
          assignment_id: string
          attempt_number?: number
          awaiting_teacher_feedback_release?: boolean
          conversation_complete_at_submit?: boolean | null
          file_url?: string | null
          id?: string
          status?: Database["public"]["Enums"]["submission_status"]
          student_id: string
          submitted_at?: string
          text_body?: string | null
        }
        Update: {
          assignment_id?: string
          attempt_number?: number
          awaiting_teacher_feedback_release?: boolean
          conversation_complete_at_submit?: boolean | null
          file_url?: string | null
          id?: string
          status?: Database["public"]["Enums"]["submission_status"]
          student_id?: string
          submitted_at?: string
          text_body?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_student_id_fkey_profiles"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }"""

def main() -> None:
    if OLD_ASSIGNMENTS not in t:
        raise SystemExit("OLD_ASSIGNMENTS not found")
    if OLD_SUBMISSIONS not in t:
        raise SystemExit("OLD_SUBMISSIONS not found")

    out = t.replace(OLD_ASSIGNMENTS, NEW_ASSIGNMENTS, 1).replace(OLD_SUBMISSIONS, NEW_SUBMISSIONS, 1)
    p.write_text(out, encoding="utf-8", newline="\n")
    print("patched", p)


if __name__ == "__main__":
    main()
