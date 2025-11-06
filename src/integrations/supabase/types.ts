export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      ai_evaluations: {
        Row: {
          created_at: string
          id: string
          narrative_feedback: string | null
          progress_delta: Json | null
          scores: Json
          submission_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          narrative_feedback?: string | null
          progress_delta?: Json | null
          scores?: Json
          submission_id: string
        }
        Update: {
          created_at?: string
          id?: string
          narrative_feedback?: string | null
          progress_delta?: Json | null
          scores?: Json
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_evaluations_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: true
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_lesson_plans: {
        Row: {
          activities: Json | null
          created_at: string
          id: string
          outline: string | null
          skills: string[] | null
          teacher_id: string
          topic: string
        }
        Insert: {
          activities?: Json | null
          created_at?: string
          id?: string
          outline?: string | null
          skills?: string[] | null
          teacher_id: string
          topic: string
        }
        Update: {
          activities?: Json | null
          created_at?: string
          id?: string
          outline?: string | null
          skills?: string[] | null
          teacher_id?: string
          topic?: string
        }
        Relationships: []
      }
      assignments: {
        Row: {
          classroom_id: string
          created_at: string
          due_at: string | null
          id: string
          instructions: string
          personalization_flag: boolean | null
          status: Database["public"]["Enums"]["assignment_status"]
          target_dimensions: Json
          title: string
          type: Database["public"]["Enums"]["assignment_type"]
          updated_at: string
        }
        Insert: {
          classroom_id: string
          created_at?: string
          due_at?: string | null
          id?: string
          instructions: string
          personalization_flag?: boolean | null
          status?: Database["public"]["Enums"]["assignment_status"]
          target_dimensions?: Json
          title: string
          type?: Database["public"]["Enums"]["assignment_type"]
          updated_at?: string
        }
        Update: {
          classroom_id?: string
          created_at?: string
          due_at?: string | null
          id?: string
          instructions?: string
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
      }
      classrooms: {
        Row: {
          course_duration: string | null
          course_outline: string | null
          course_title: string | null
          created_at: string
          end_date: string | null
          goals: string | null
          id: string
          invite_code: string
          key_challenges: Json | null
          learning_outcomes: Json | null
          name: string
          resources: string | null
          start_date: string | null
          subject: string | null
          teacher_id: string
          updated_at: string
        }
        Insert: {
          course_duration?: string | null
          course_outline?: string | null
          course_title?: string | null
          created_at?: string
          end_date?: string | null
          goals?: string | null
          id?: string
          invite_code?: string
          key_challenges?: Json | null
          learning_outcomes?: Json | null
          name: string
          resources?: string | null
          start_date?: string | null
          subject?: string | null
          teacher_id: string
          updated_at?: string
        }
        Update: {
          course_duration?: string | null
          course_outline?: string | null
          course_title?: string | null
          created_at?: string
          end_date?: string | null
          goals?: string | null
          id?: string
          invite_code?: string
          key_challenges?: Json | null
          learning_outcomes?: Json | null
          name?: string
          resources?: string | null
          start_date?: string | null
          subject?: string | null
          teacher_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          classroom_id: string
          created_at: string
          id: string
          student_id: string
        }
        Insert: {
          classroom_id: string
          created_at?: string
          id?: string
          student_id: string
        }
        Update: {
          classroom_id?: string
          created_at?: string
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
        ]
      }
      five_d_snapshots: {
        Row: {
          created_at: string
          delta: Json | null
          id: string
          scores: Json
          source: Database["public"]["Enums"]["snapshot_source"]
          user_id: string
        }
        Insert: {
          created_at?: string
          delta?: Json | null
          id?: string
          scores?: Json
          source: Database["public"]["Enums"]["snapshot_source"]
          user_id: string
        }
        Update: {
          created_at?: string
          delta?: Json | null
          id?: string
          scores?: Json
          source?: Database["public"]["Enums"]["snapshot_source"]
          user_id?: string
        }
        Relationships: []
      }
      student_profiles: {
        Row: {
          additional_notes: string | null
          created_at: string
          feedback_preferences: string | null
          full_name: string | null
          help_preferences: string | null
          id: string
          learning_goal: string | null
          learning_methods: string | null
          mentor_tone_ref: string | null
          motivation_factors: string | null
          preferences_quiz: Json | null
          scheduled_vs_flexible: string | null
          solo_vs_group: string | null
          special_needs: string | null
          teacher_preferences: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          additional_notes?: string | null
          created_at?: string
          feedback_preferences?: string | null
          full_name?: string | null
          help_preferences?: string | null
          id?: string
          learning_goal?: string | null
          learning_methods?: string | null
          mentor_tone_ref?: string | null
          motivation_factors?: string | null
          preferences_quiz?: Json | null
          scheduled_vs_flexible?: string | null
          solo_vs_group?: string | null
          special_needs?: string | null
          teacher_preferences?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          additional_notes?: string | null
          created_at?: string
          feedback_preferences?: string | null
          full_name?: string | null
          help_preferences?: string | null
          id?: string
          learning_goal?: string | null
          learning_methods?: string | null
          mentor_tone_ref?: string | null
          motivation_factors?: string | null
          preferences_quiz?: Json | null
          scheduled_vs_flexible?: string | null
          solo_vs_group?: string | null
          special_needs?: string | null
          teacher_preferences?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      submissions: {
        Row: {
          assignment_id: string
          file_url: string | null
          id: string
          student_id: string
          submitted_at: string
          text_body: string | null
        }
        Insert: {
          assignment_id: string
          file_url?: string | null
          id?: string
          student_id: string
          submitted_at?: string
          text_body?: string | null
        }
        Update: {
          assignment_id?: string
          file_url?: string | null
          id?: string
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
      }
      teacher_profiles: {
        Row: {
          challenging_question_response: string | null
          created_at: string
          difficult_concept_example: string | null
          discussion_timing: string | null
          disruptive_student_response: string | null
          educational_values: string | null
          encouragement_phrases: string | null
          full_name: string | null
          hard_work_feedback_example: string | null
          id: string
          lesson_ending: string | null
          lesson_start_approach: string | null
          lesson_structure: string | null
          mistake_response: string | null
          misunderstanding_feedback_example: string | null
          no_understanding_response: string | null
          phone_number: string | null
          phrases_to_avoid: string | null
          question_types: string | null
          sample_explanation: string | null
          skills_to_develop: string | null
          specialization_1: string | null
          specialization_2: string | null
          strongest_qualities: string | null
          student_age_range: string | null
          student_education_level: string | null
          student_objectives: string | null
          student_types: string | null
          style_notes: string | null
          subjects: string[] | null
          teaching_examples: string | null
          teaching_goals: string | null
          typical_student_count: string | null
          updated_at: string
          user_id: string
          workplace: string | null
          years_experience: number | null
        }
        Insert: {
          challenging_question_response?: string | null
          created_at?: string
          difficult_concept_example?: string | null
          discussion_timing?: string | null
          disruptive_student_response?: string | null
          educational_values?: string | null
          encouragement_phrases?: string | null
          full_name?: string | null
          hard_work_feedback_example?: string | null
          id?: string
          lesson_ending?: string | null
          lesson_start_approach?: string | null
          lesson_structure?: string | null
          mistake_response?: string | null
          misunderstanding_feedback_example?: string | null
          no_understanding_response?: string | null
          phone_number?: string | null
          phrases_to_avoid?: string | null
          question_types?: string | null
          sample_explanation?: string | null
          skills_to_develop?: string | null
          specialization_1?: string | null
          specialization_2?: string | null
          strongest_qualities?: string | null
          student_age_range?: string | null
          student_education_level?: string | null
          student_objectives?: string | null
          student_types?: string | null
          style_notes?: string | null
          subjects?: string[] | null
          teaching_examples?: string | null
          teaching_goals?: string | null
          typical_student_count?: string | null
          updated_at?: string
          user_id: string
          workplace?: string | null
          years_experience?: number | null
        }
        Update: {
          challenging_question_response?: string | null
          created_at?: string
          difficult_concept_example?: string | null
          discussion_timing?: string | null
          disruptive_student_response?: string | null
          educational_values?: string | null
          encouragement_phrases?: string | null
          full_name?: string | null
          hard_work_feedback_example?: string | null
          id?: string
          lesson_ending?: string | null
          lesson_start_approach?: string | null
          lesson_structure?: string | null
          mistake_response?: string | null
          misunderstanding_feedback_example?: string | null
          no_understanding_response?: string | null
          phone_number?: string | null
          phrases_to_avoid?: string | null
          question_types?: string | null
          sample_explanation?: string | null
          skills_to_develop?: string | null
          specialization_1?: string | null
          specialization_2?: string | null
          strongest_qualities?: string | null
          student_age_range?: string | null
          student_education_level?: string | null
          student_objectives?: string | null
          student_types?: string | null
          style_notes?: string | null
          subjects?: string[] | null
          teaching_examples?: string | null
          teaching_goals?: string | null
          typical_student_count?: string | null
          updated_at?: string
          user_id?: string
          workplace?: string | null
          years_experience?: number | null
        }
        Relationships: []
      }
      teacher_reviews: {
        Row: {
          created_at: string
          edited_feedback: string | null
          evaluation_id: string
          id: string
          published_at: string | null
          published_to_student: boolean | null
          reviewer_id: string
        }
        Insert: {
          created_at?: string
          edited_feedback?: string | null
          evaluation_id: string
          id?: string
          published_at?: string | null
          published_to_student?: boolean | null
          reviewer_id: string
        }
        Update: {
          created_at?: string
          edited_feedback?: string | null
          evaluation_id?: string
          id?: string
          published_at?: string | null
          published_to_student?: boolean | null
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_reviews_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "ai_evaluations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_invite_code: { Args: never; Returns: string }
      is_classroom_teacher: {
        Args: { _classroom_id: string; _user_id: string }
        Returns: boolean
      }
      is_enrolled_in_classroom: {
        Args: { _classroom_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      assignment_status: "draft" | "published" | "archived"
      assignment_type:
        | "text_essay"
        | "quiz_mcq"
        | "creative_task"
        | "discussion_prompt"
        | "multimedia"
      snapshot_source: "onboarding" | "assignment" | "reassess"
      user_role: "teacher" | "student"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      assignment_status: ["draft", "published", "archived"],
      assignment_type: [
        "text_essay",
        "quiz_mcq",
        "creative_task",
        "discussion_prompt",
        "multimedia",
      ],
      snapshot_source: ["onboarding", "assignment", "reassess"],
      user_role: ["teacher", "student"],
    },
  },
} as const
