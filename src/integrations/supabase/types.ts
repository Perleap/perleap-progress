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
      activity_events: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["entity_type"]
          id: string
          metadata: Json | null
          route: string
          teacher_id: string
          title: string
          type: Database["public"]["Enums"]["activity_type"]
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["entity_type"]
          id?: string
          metadata?: Json | null
          route: string
          teacher_id: string
          title: string
          type: Database["public"]["Enums"]["activity_type"]
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: Database["public"]["Enums"]["entity_type"]
          id?: string
          metadata?: Json | null
          route?: string
          teacher_id?: string
          title?: string
          type?: Database["public"]["Enums"]["activity_type"]
        }
        Relationships: []
      }
      activity_list: {
        Row: {
          active: boolean
          created_at: string
          deleted_at: string | null
          id: string
          lesson_content: Json | null
          order_index: number
          resource_type: string
          section_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          deleted_at?: string | null
          id?: string
          lesson_content?: Json | null
          order_index?: number
          resource_type?: string
          section_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          deleted_at?: string | null
          id?: string
          lesson_content?: Json | null
          order_index?: number
          resource_type?: string
          section_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "section_resources_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "syllabus_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_audit_log: {
        Row: {
          action: string
          admin_user_id: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json | null
        }
        Insert: {
          action: string
          admin_user_id: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
        }
        Update: {
          action?: string
          admin_user_id?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      observability_metric_snapshots: {
        Row: {
          id: string
          recorded_at: string
          source: string
          payload: Json
        }
        Insert: {
          id?: string
          recorded_at?: string
          source: string
          payload?: Json
        }
        Update: {
          id?: string
          recorded_at?: string
          source?: string
          payload?: Json
        }
        Relationships: []
      }
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
      ai_prompts: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          language: string | null
          prompt_key: string
          prompt_name: string
          prompt_template: string
          updated_at: string | null
          variables: Json | null
          version: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          language?: string | null
          prompt_key: string
          prompt_name: string
          prompt_template: string
          updated_at?: string | null
          variables?: Json | null
          version?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          language?: string | null
          prompt_key?: string
          prompt_name?: string
          prompt_template?: string
          updated_at?: string | null
          variables?: Json | null
          version?: number | null
        }
        Relationships: []
      }
      app_admins: {
        Row: {
          created_at: string
          created_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      assignment_chat_history: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          submission_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          submission_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          submission_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_chat_history_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      },
      assignment_chat_sentence_flags: {
        Row: {
          assignment_id: string
          created_at: string
          id: string
          message_index: number
          sentence_index: number
          sentence_text: string
          student_id: string
          submission_id: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          id?: string
          message_index: number
          sentence_index: number
          sentence_text: string
          student_id: string
          submission_id: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          id?: string
          message_index?: number
          sentence_index?: number
          sentence_text?: string
          student_id?: string
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_chat_sentence_flags_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_chat_sentence_flags_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_conversations: {
        Row: {
          assignment_id: string
          created_at: string
          id: string
          messages: Json
          student_id: string
          submission_id: string
          updated_at: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          id?: string
          messages?: Json
          student_id: string
          submission_id: string
          updated_at?: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          id?: string
          messages?: Json
          student_id?: string
          submission_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_conversations_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_conversations_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_feedback: {
        Row: {
          assignment_id: string
          conversation_context: Json | null
          created_at: string
          id: string
          student_feedback: string | null
          student_id: string
          submission_id: string
          teacher_feedback: string | null
          visible_to_student: boolean
        }
        Insert: {
          assignment_id: string
          conversation_context?: Json | null
          created_at?: string
          id?: string
          student_feedback?: string | null
          student_id: string
          submission_id: string
          teacher_feedback?: string | null
          visible_to_student?: boolean
        }
        Update: {
          assignment_id?: string
          conversation_context?: Json | null
          created_at?: string
          id?: string
          student_feedback?: string | null
          student_id?: string
          submission_id?: string
          teacher_feedback?: string | null
          visible_to_student?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "assignment_feedback_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_feedback_student_id_fkey_profiles"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "assignment_feedback_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_module_activities: {
        Row: {
          activity_list_id: string
          assignment_id: string
          created_at: string
          id: string
          include_in_ai_context: boolean
          order_index: number
        }
        Insert: {
          activity_list_id: string
          assignment_id: string
          created_at?: string
          id?: string
          include_in_ai_context?: boolean
          order_index?: number
        }
        Update: {
          activity_list_id?: string
          assignment_id?: string
          created_at?: string
          id?: string
          include_in_ai_context?: boolean
          order_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "assignment_module_activities_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_module_activities_section_resource_id_fkey"
            columns: ["activity_list_id"]
            isOneToOne: false
            referencedRelation: "activity_list"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          active: boolean
          assigned_student_id: string | null
          attempt_mode: Database["public"]["Enums"]["assignment_attempt_mode"]
          auto_publish_ai_feedback: boolean
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
          attempt_mode?: Database["public"]["Enums"]["assignment_attempt_mode"]
          auto_publish_ai_feedback?: boolean
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
          attempt_mode?: Database["public"]["Enums"]["assignment_attempt_mode"]
          auto_publish_ai_feedback?: boolean
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
            foreignKeyName: "assignments_assigned_student_id_fkey_profiles"
            columns: ["assigned_student_id"]
            isOneToOne: false
            referencedRelation: "student_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "assignments_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_grading_category_id_fkey"
            columns: ["grading_category_id"]
            isOneToOne: false
            referencedRelation: "grading_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_syllabus_section_id_fkey"
            columns: ["syllabus_section_id"]
            isOneToOne: false
            referencedRelation: "syllabus_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      classrooms: {
        Row: {
          active: boolean
          course_duration: string | null
          course_outline: string | null
          course_title: string | null
          created_at: string
          deleted_at: string | null
          domains: Json | null
          end_date: string | null
          goals: string | null
          id: string
          invite_code: string
          key_challenges: Json | null
          learning_outcomes: Json | null
          materials: Json | null
          name: string
          resources: string | null
          start_date: string | null
          subject: string | null
          teacher_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          course_duration?: string | null
          course_outline?: string | null
          course_title?: string | null
          created_at?: string
          deleted_at?: string | null
          domains?: Json | null
          end_date?: string | null
          goals?: string | null
          id?: string
          invite_code?: string
          key_challenges?: Json | null
          learning_outcomes?: Json | null
          materials?: Json | null
          name: string
          resources?: string | null
          start_date?: string | null
          subject?: string | null
          teacher_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          course_duration?: string | null
          course_outline?: string | null
          course_title?: string | null
          created_at?: string
          deleted_at?: string | null
          domains?: Json | null
          end_date?: string | null
          goals?: string | null
          id?: string
          invite_code?: string
          key_challenges?: Json | null
          learning_outcomes?: Json | null
          materials?: Json | null
          name?: string
          resources?: string | null
          start_date?: string | null
          subject?: string | null
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classrooms_teacher_id_fkey_profiles"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      enrollments: {
        Row: {
          active: boolean
          classroom_id: string
          created_at: string
          deleted_at: string | null
          id: string
          student_id: string
        }
        Insert: {
          active?: boolean
          classroom_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          student_id: string
        }
        Update: {
          active?: boolean
          classroom_id?: string
          created_at?: string
          deleted_at?: string | null
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
          {
            foreignKeyName: "enrollments_student_id_fkey_profiles"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      five_d_snapshots: {
        Row: {
          classroom_id: string | null
          created_at: string
          delta: Json | null
          id: string
          score_explanations: Json | null
          scores: Json
          source: Database["public"]["Enums"]["snapshot_source"]
          submission_id: string | null
          user_id: string
        }
        Insert: {
          classroom_id?: string | null
          created_at?: string
          delta?: Json | null
          id?: string
          score_explanations?: Json | null
          scores?: Json
          source: Database["public"]["Enums"]["snapshot_source"]
          submission_id?: string | null
          user_id: string
        }
        Update: {
          classroom_id?: string | null
          created_at?: string
          delta?: Json | null
          id?: string
          score_explanations?: Json | null
          scores?: Json
          source?: Database["public"]["Enums"]["snapshot_source"]
          submission_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "five_d_snapshots_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "five_d_snapshots_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "five_d_snapshots_user_id_fkey_profiles"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "student_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      grading_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          syllabus_id: string
          updated_at: string
          weight: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          syllabus_id: string
          updated_at?: string
          weight?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          syllabus_id?: string
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "grading_categories_syllabus_id_fkey"
            columns: ["syllabus_id"]
            isOneToOne: false
            referencedRelation: "syllabi"
            referencedColumns: ["id"]
          },
        ]
      }
      hard_skill_assessments: {
        Row: {
          actionable_challenge: string
          assignment_id: string
          created_at: string
          current_level_percent: number
          domain: string
          id: string
          proficiency_description: string
          skill_component: string
          student_id: string
          submission_id: string
        }
        Insert: {
          actionable_challenge: string
          assignment_id: string
          created_at?: string
          current_level_percent: number
          domain: string
          id?: string
          proficiency_description: string
          skill_component: string
          student_id: string
          submission_id: string
        }
        Update: {
          actionable_challenge?: string
          assignment_id?: string
          created_at?: string
          current_level_percent?: number
          domain?: string
          id?: string
          proficiency_description?: string
          skill_component?: string
          student_id?: string
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hard_skill_assessments_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hard_skill_assessments_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      module_flow_steps: {
        Row: {
          activity_list_id: string | null
          assignment_id: string | null
          created_at: string
          id: string
          order_index: number
          section_id: string
          step_kind: string
          updated_at: string
        }
        Insert: {
          activity_list_id?: string | null
          assignment_id?: string | null
          created_at?: string
          id?: string
          order_index: number
          section_id: string
          step_kind: string
          updated_at?: string
        }
        Update: {
          activity_list_id?: string | null
          assignment_id?: string | null
          created_at?: string
          id?: string
          order_index?: number
          section_id?: string
          step_kind?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_flow_steps_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_flow_steps_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "syllabus_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_flow_steps_section_resource_id_fkey"
            columns: ["activity_list_id"]
            isOneToOne: false
            referencedRelation: "activity_list"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string
          metadata: Json | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message: string
          metadata?: Json | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          metadata?: Json | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      section_comments: {
        Row: {
          author_avatar_url: string | null
          author_display_name: string | null
          content: string
          created_at: string
          id: string
          parent_id: string | null
          section_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          author_avatar_url?: string | null
          author_display_name?: string | null
          content: string
          created_at?: string
          id?: string
          parent_id?: string | null
          section_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          author_avatar_url?: string | null
          author_display_name?: string | null
          content?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          section_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "section_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "section_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "section_comments_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "syllabus_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      student_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          ai_analysis: string
          alert_level: string
          alert_type: string
          assignment_id: string
          created_at: string
          id: string
          is_acknowledged: boolean
          student_id: string
          submission_id: string
          triggered_messages: Json
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          ai_analysis: string
          alert_level: string
          alert_type: string
          assignment_id: string
          created_at?: string
          id?: string
          is_acknowledged?: boolean
          student_id: string
          submission_id: string
          triggered_messages?: Json
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          ai_analysis?: string
          alert_level?: string
          alert_type?: string
          assignment_id?: string
          created_at?: string
          id?: string
          is_acknowledged?: boolean
          student_id?: string
          submission_id?: string
          triggered_messages?: Json
        }
        Relationships: [
          {
            foreignKeyName: "student_alerts_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_alerts_student_id_fkey_profiles"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "student_alerts_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      student_module_flow_progress: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          module_flow_step_id: string
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          module_flow_step_id: string
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          module_flow_step_id?: string
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_module_flow_progress_module_flow_step_id_fkey"
            columns: ["module_flow_step_id"]
            isOneToOne: false
            referencedRelation: "module_flow_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      student_nuance_events: {
        Row: {
          assignment_id: string
          created_at: string
          event_type: Database["public"]["Enums"]["nuance_event_type"]
          id: string
          metadata: Json | null
          student_id: string
          submission_id: string | null
        }
        Insert: {
          assignment_id: string
          created_at?: string
          event_type: Database["public"]["Enums"]["nuance_event_type"]
          id?: string
          metadata?: Json | null
          student_id: string
          submission_id?: string | null
        }
        Update: {
          assignment_id?: string
          created_at?: string
          event_type?: Database["public"]["Enums"]["nuance_event_type"]
          id?: string
          metadata?: Json | null
          student_id?: string
          submission_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_nuance_events_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_nuance_events_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      student_nuance_metrics: {
        Row: {
          assignment_id: string
          avg_response_latency_ms: number | null
          classroom_id: string
          completion_status: string | null
          computed_at: string
          first_interaction_latency_ms: number | null
          focus_loss_count: number | null
          id: string
          idle_ratio: number | null
          resume_count: number | null
          session_count: number | null
          student_id: string
          total_idle_time_ms: number | null
          total_session_duration_ms: number | null
          understanding_cue_count: number | null
        }
        Insert: {
          assignment_id: string
          avg_response_latency_ms?: number | null
          classroom_id: string
          completion_status?: string | null
          computed_at?: string
          first_interaction_latency_ms?: number | null
          focus_loss_count?: number | null
          id?: string
          idle_ratio?: number | null
          resume_count?: number | null
          session_count?: number | null
          student_id: string
          total_idle_time_ms?: number | null
          total_session_duration_ms?: number | null
          understanding_cue_count?: number | null
        }
        Update: {
          assignment_id?: string
          avg_response_latency_ms?: number | null
          classroom_id?: string
          completion_status?: string | null
          computed_at?: string
          first_interaction_latency_ms?: number | null
          focus_loss_count?: number | null
          id?: string
          idle_ratio?: number | null
          resume_count?: number | null
          session_count?: number | null
          student_id?: string
          total_idle_time_ms?: number | null
          total_session_duration_ms?: number | null
          understanding_cue_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "student_nuance_metrics_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_nuance_metrics_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
        ]
      }
      student_profiles: {
        Row: {
          additional_notes: string | null
          avatar_url: string | null
          created_at: string
          email: string
          feedback_preferences: string | null
          full_name: string | null
          help_preferences: string | null
          id: string
          learning_goal: string | null
          learning_methods: string | null
          mentor_tone_ref: string | null
          motivation_factors: string | null
          preferences_quiz: Json | null
          preferred_language: string | null
          scheduled_vs_flexible: string | null
          solo_vs_group: string | null
          special_needs: string | null
          teacher_preferences: string | null
          updated_at: string
          user_id: string
          voice_preference: string | null
        }
        Insert: {
          additional_notes?: string | null
          avatar_url?: string | null
          created_at?: string
          email: string
          feedback_preferences?: string | null
          full_name?: string | null
          help_preferences?: string | null
          id?: string
          learning_goal?: string | null
          learning_methods?: string | null
          mentor_tone_ref?: string | null
          motivation_factors?: string | null
          preferences_quiz?: Json | null
          preferred_language?: string | null
          scheduled_vs_flexible?: string | null
          solo_vs_group?: string | null
          special_needs?: string | null
          teacher_preferences?: string | null
          updated_at?: string
          user_id: string
          voice_preference?: string | null
        }
        Update: {
          additional_notes?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string
          feedback_preferences?: string | null
          full_name?: string | null
          help_preferences?: string | null
          id?: string
          learning_goal?: string | null
          learning_methods?: string | null
          mentor_tone_ref?: string | null
          motivation_factors?: string | null
          preferences_quiz?: Json | null
          preferred_language?: string | null
          scheduled_vs_flexible?: string | null
          solo_vs_group?: string | null
          special_needs?: string | null
          teacher_preferences?: string | null
          updated_at?: string
          user_id?: string
          voice_preference?: string | null
        }
        Relationships: []
      }
      student_recommendations: {
        Row: {
          classroom_id: string
          confidence_score: number | null
          generated_at: string
          id: string
          recommendation_text: string
          recommendation_type: string
          student_id: string
          supporting_metrics: Json | null
          trigger_reason: string
        }
        Insert: {
          classroom_id: string
          confidence_score?: number | null
          generated_at?: string
          id?: string
          recommendation_text: string
          recommendation_type: string
          student_id: string
          supporting_metrics?: Json | null
          trigger_reason: string
        }
        Update: {
          classroom_id?: string
          confidence_score?: number | null
          generated_at?: string
          id?: string
          recommendation_text?: string
          recommendation_type?: string
          student_id?: string
          supporting_metrics?: Json | null
          trigger_reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_recommendations_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
        ]
      }
      student_section_progress: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          section_id: string
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          section_id: string
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          section_id?: string
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_section_progress_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "syllabus_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          assignment_id: string
          attempt_number: number
          awaiting_teacher_feedback_release: boolean
          conversation_complete_at_submit: boolean | null
          file_url: string | null
          id: string
          is_teacher_attempt: boolean
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
          is_teacher_attempt?: boolean
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
          is_teacher_attempt?: boolean
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
      }
      syllabi: {
        Row: {
          accent_color: string | null
          active: boolean
          banner_url: string | null
          classroom_id: string
          created_at: string
          custom_settings: Json
          deleted_at: string | null
          id: string
          policies: Json
          published_at: string | null
          release_mode: string
          section_label_override: string | null
          status: string
          structure_type: string
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          active?: boolean
          banner_url?: string | null
          classroom_id: string
          created_at?: string
          custom_settings?: Json
          deleted_at?: string | null
          id?: string
          policies?: Json
          published_at?: string | null
          release_mode?: string
          section_label_override?: string | null
          status?: string
          structure_type?: string
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          active?: boolean
          banner_url?: string | null
          classroom_id?: string
          created_at?: string
          custom_settings?: Json
          deleted_at?: string | null
          id?: string
          policies?: Json
          published_at?: string | null
          release_mode?: string
          section_label_override?: string | null
          status?: string
          structure_type?: string
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "syllabi_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
        ]
      }
      syllabus_changelog: {
        Row: {
          change_summary: string
          changed_by: string
          created_at: string
          id: string
          snapshot: Json | null
          syllabus_id: string
        }
        Insert: {
          change_summary: string
          changed_by: string
          created_at?: string
          id?: string
          snapshot?: Json | null
          syllabus_id: string
        }
        Update: {
          change_summary?: string
          changed_by?: string
          created_at?: string
          id?: string
          snapshot?: Json | null
          syllabus_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "syllabus_changelog_syllabus_id_fkey"
            columns: ["syllabus_id"]
            isOneToOne: false
            referencedRelation: "syllabi"
            referencedColumns: ["id"]
          },
        ]
      }
      syllabus_sections: {
        Row: {
          active: boolean
          completion_status: string
          content: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          end_date: string | null
          id: string
          is_locked: boolean
          notes: string | null
          objectives: string[] | null
          order_index: number
          prerequisites: string[] | null
          resources: string | null
          start_date: string | null
          syllabus_id: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          completion_status?: string
          content?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          is_locked?: boolean
          notes?: string | null
          objectives?: string[] | null
          order_index?: number
          prerequisites?: string[] | null
          resources?: string | null
          start_date?: string | null
          syllabus_id: string
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          completion_status?: string
          content?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          is_locked?: boolean
          notes?: string | null
          objectives?: string[] | null
          order_index?: number
          prerequisites?: string[] | null
          resources?: string | null
          start_date?: string | null
          syllabus_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "syllabus_sections_syllabus_id_fkey"
            columns: ["syllabus_id"]
            isOneToOne: false
            referencedRelation: "syllabi"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          phone_number: string | null
          preferred_language: string | null
          sample_explanation: string | null
          student_education_level: string | null
          style_notes: string | null
          subjects: string[] | null
          teaching_examples: string | null
          teaching_goals: string | null
          updated_at: string
          user_id: string
          years_experience: number | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          phone_number?: string | null
          preferred_language?: string | null
          sample_explanation?: string | null
          student_education_level?: string | null
          style_notes?: string | null
          subjects?: string[] | null
          teaching_examples?: string | null
          teaching_goals?: string | null
          updated_at?: string
          user_id: string
          years_experience?: number | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          phone_number?: string | null
          preferred_language?: string | null
          sample_explanation?: string | null
          student_education_level?: string | null
          style_notes?: string | null
          subjects?: string[] | null
          teaching_examples?: string | null
          teaching_goals?: string | null
          updated_at?: string
          user_id?: string
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
          {
            foreignKeyName: "teacher_reviews_reviewer_id_fkey_profiles"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      test_questions: {
        Row: {
          assignment_id: string
          correct_option_id: string | null
          created_at: string | null
          id: string
          options: Json | null
          order_index: number
          question_text: string
          question_type: string
        }
        Insert: {
          assignment_id: string
          correct_option_id?: string | null
          created_at?: string | null
          id?: string
          options?: Json | null
          order_index?: number
          question_text: string
          question_type: string
        }
        Update: {
          assignment_id?: string
          correct_option_id?: string | null
          created_at?: string | null
          id?: string
          options?: Json | null
          order_index?: number
          question_text?: string
          question_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_questions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      test_responses: {
        Row: {
          created_at: string | null
          id: string
          question_id: string
          selected_option_id: string | null
          submission_id: string
          text_answer: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          question_id: string
          selected_option_id?: string | null
          submission_id: string
          text_answer?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          question_id?: string
          selected_option_id?: string | null
          submission_id?: string
          text_answer?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "test_responses_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "test_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_responses_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_is_enrolled: {
        Args: { classroom_uuid: string; student_uuid: string }
        Returns: boolean
      }
      check_is_teacher_of_student: {
        Args: { student_uuid: string; teacher_uuid: string }
        Returns: boolean
      }
      check_owns_classroom: {
        Args: { classroom_uuid: string; teacher_uuid: string }
        Returns: boolean
      }
      cleanup_orphaned_student_profiles: { Args: never; Returns: number }
      cleanup_orphaned_teacher_profiles: { Args: never; Returns: number }
      generate_invite_code: { Args: never; Returns: string }
      is_app_admin: { Args: { _user_id: string }; Returns: boolean }
      is_classroom_teacher: {
        Args: { _classroom_id: string; _user_id: string }
        Returns: boolean
      }
      is_enrolled_in_classroom: {
        Args: { _classroom_id: string; _user_id: string }
        Returns: boolean
      }
      replace_module_flow_steps: {
        Args: { p_section_id: string; p_steps: Json }
        Returns: undefined
      }
      report_assignment_chat_sentence: {
        Args: { args: Json }
        Returns: Json
      }
      split_assistant_message_into_sentences: {
        Args: { p_text: string }
        Returns: string[]
      }
      student_unenroll_from_classroom: {
        Args: { p_classroom_id: string }
        Returns: boolean
      }
    }
    Enums: {
      activity_type: "create" | "update" | "delete" | "view"
      assignment_attempt_mode:
        | "single"
        | "multiple_until_due"
        | "multiple_unlimited"
      assignment_status: "draft" | "published" | "archived"
      assignment_type:
        | "text_essay"
        | "quiz_mcq"
        | "creative_task"
        | "discussion_prompt"
        | "multimedia"
        | "project"
        | "questions"
        | "test"
        | "presentation"
        | "langchain"
        | "chatbot"
      entity_type: "classroom" | "assignment" | "submission" | "student"
      nuance_event_type:
        | "session_started"
        | "session_ended"
        | "response_started"
        | "response_submitted"
        | "page_blur"
        | "page_focus"
        | "activity_opened"
        | "understanding_cue"
      snapshot_source: "onboarding" | "assignment" | "reassess"
      submission_status: "in_progress" | "completed"
      user_role: "teacher" | "student" | "admin"
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
      activity_type: ["create", "update", "delete", "view"],
      assignment_attempt_mode: [
        "single",
        "multiple_until_due",
        "multiple_unlimited",
      ],
      assignment_status: ["draft", "published", "archived"],
      assignment_type: [
        "text_essay",
        "quiz_mcq",
        "creative_task",
        "discussion_prompt",
        "multimedia",
        "project",
        "questions",
        "test",
        "presentation",
        "langchain",
        "chatbot",
      ],
      entity_type: ["classroom", "assignment", "submission", "student"],
      nuance_event_type: [
        "session_started",
        "session_ended",
        "response_started",
        "response_submitted",
        "page_blur",
        "page_focus",
        "activity_opened",
        "understanding_cue",
      ],
      snapshot_source: ["onboarding", "assignment", "reassess"],
      submission_status: ["in_progress", "completed"],
      user_role: ["teacher", "student", "admin"],
    },
  },
} as const
