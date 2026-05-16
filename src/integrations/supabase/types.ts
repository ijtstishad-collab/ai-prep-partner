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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      chapters: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          name_bn: string | null
          order_index: number
          readiness_status: string
          subject_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          name_bn?: string | null
          order_index?: number
          readiness_status?: string
          subject_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          name_bn?: string | null
          order_index?: number
          readiness_status?: string
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapters_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_questions: {
        Row: {
          chapter_id: string
          correct_answer: string
          created_at: string
          difficulty: Database["public"]["Enums"]["difficulty_level"]
          explanation_bn: string | null
          id: string
          options: Json | null
          question_text: string
          question_type: Database["public"]["Enums"]["question_type"]
          subject_id: string
        }
        Insert: {
          chapter_id: string
          correct_answer: string
          created_at?: string
          difficulty?: Database["public"]["Enums"]["difficulty_level"]
          explanation_bn?: string | null
          id?: string
          options?: Json | null
          question_text: string
          question_type?: Database["public"]["Enums"]["question_type"]
          subject_id: string
        }
        Update: {
          chapter_id?: string
          correct_answer?: string
          created_at?: string
          difficulty?: Database["public"]["Enums"]["difficulty_level"]
          explanation_bn?: string | null
          id?: string
          options?: Json | null
          question_text?: string
          question_type?: Database["public"]["Enums"]["question_type"]
          subject_id?: string
        }
        Relationships: []
      }
      generated_questions: {
        Row: {
          chapter_id: string
          correct_answer: string
          created_at: string
          difficulty: Database["public"]["Enums"]["difficulty_level"]
          explanation_bn: string | null
          id: string
          is_teacher_reviewed: boolean
          options: Json | null
          quality_score: number | null
          question_text: string
          question_type: Database["public"]["Enums"]["question_type"]
          source_context: Json | null
          status: string
          subject_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          chapter_id: string
          correct_answer: string
          created_at?: string
          difficulty: Database["public"]["Enums"]["difficulty_level"]
          explanation_bn?: string | null
          id?: string
          is_teacher_reviewed?: boolean
          options?: Json | null
          quality_score?: number | null
          question_text: string
          question_type: Database["public"]["Enums"]["question_type"]
          source_context?: Json | null
          status?: string
          subject_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          chapter_id?: string
          correct_answer?: string
          created_at?: string
          difficulty?: Database["public"]["Enums"]["difficulty_level"]
          explanation_bn?: string | null
          id?: string
          is_teacher_reviewed?: boolean
          options?: Json | null
          quality_score?: number | null
          question_text?: string
          question_type?: Database["public"]["Enums"]["question_type"]
          source_context?: Json | null
          status?: string
          subject_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      generation_rules: {
        Row: {
          created_at: string
          id: string
          instructions: string
          is_active: boolean
          question_type: Database["public"]["Enums"]["question_type"]
          subject_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          instructions: string
          is_active?: boolean
          question_type: Database["public"]["Enums"]["question_type"]
          subject_id: string
        }
        Update: {
          created_at?: string
          id?: string
          instructions?: string
          is_active?: boolean
          question_type?: Database["public"]["Enums"]["question_type"]
          subject_id?: string
        }
        Relationships: []
      }
      past_questions: {
        Row: {
          answer: string | null
          board: string | null
          chapter_id: string
          created_at: string
          difficulty: Database["public"]["Enums"]["difficulty_level"]
          id: string
          question_text: string
          question_type: Database["public"]["Enums"]["question_type"]
          subject_id: string
          year: number | null
        }
        Insert: {
          answer?: string | null
          board?: string | null
          chapter_id: string
          created_at?: string
          difficulty?: Database["public"]["Enums"]["difficulty_level"]
          id?: string
          question_text: string
          question_type?: Database["public"]["Enums"]["question_type"]
          subject_id: string
          year?: number | null
        }
        Update: {
          answer?: string | null
          board?: string | null
          chapter_id?: string
          created_at?: string
          difficulty?: Database["public"]["Enums"]["difficulty_level"]
          id?: string
          question_text?: string
          question_type?: Database["public"]["Enums"]["question_type"]
          subject_id?: string
          year?: number | null
        }
        Relationships: []
      }
      performance_summary: {
        Row: {
          chapter_id: string | null
          id: string
          last_attempt_at: string | null
          subject_id: string | null
          total_attempted: number
          total_correct: number
          user_id: string
        }
        Insert: {
          chapter_id?: string | null
          id?: string
          last_attempt_at?: string | null
          subject_id?: string | null
          total_attempted?: number
          total_correct?: number
          user_id: string
        }
        Update: {
          chapter_id?: string | null
          id?: string
          last_attempt_at?: string | null
          subject_id?: string | null
          total_attempted?: number
          total_correct?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_summary_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_summary_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          class: string | null
          created_at: string
          full_name: string | null
          id: string
          onboarded: boolean
          student_group: string | null
          subscription_tier: string
          target_exam_year: number | null
          updated_at: string
        }
        Insert: {
          class?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          onboarded?: boolean
          student_group?: string | null
          subscription_tier?: string
          target_exam_year?: number | null
          updated_at?: string
        }
        Update: {
          class?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          onboarded?: boolean
          student_group?: string | null
          subscription_tier?: string
          target_exam_year?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      question_reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          question_id: string
          reason: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          question_id: string
          reason: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          question_id?: string
          reason?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_reports_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      question_reviews: {
        Row: {
          action: string
          created_at: string
          generated_question_id: string
          id: string
          notes: string | null
          quality_score: number | null
          reviewer_id: string
        }
        Insert: {
          action: string
          created_at?: string
          generated_question_id: string
          id?: string
          notes?: string | null
          quality_score?: number | null
          reviewer_id: string
        }
        Update: {
          action?: string
          created_at?: string
          generated_question_id?: string
          id?: string
          notes?: string | null
          quality_score?: number | null
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_reviews_generated_question_id_fkey"
            columns: ["generated_question_id"]
            isOneToOne: false
            referencedRelation: "generated_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          chapter_id: string
          correct_answer: string
          created_at: string
          created_by: string | null
          difficulty: Database["public"]["Enums"]["difficulty_level"]
          explanation_bn: string | null
          id: string
          is_approved: boolean
          options: Json | null
          question_text: string
          question_type: Database["public"]["Enums"]["question_type"]
          source: string | null
          teacher_reviewed: boolean
        }
        Insert: {
          chapter_id: string
          correct_answer: string
          created_at?: string
          created_by?: string | null
          difficulty?: Database["public"]["Enums"]["difficulty_level"]
          explanation_bn?: string | null
          id?: string
          is_approved?: boolean
          options?: Json | null
          question_text: string
          question_type?: Database["public"]["Enums"]["question_type"]
          source?: string | null
          teacher_reviewed?: boolean
        }
        Update: {
          chapter_id?: string
          correct_answer?: string
          created_at?: string
          created_by?: string | null
          difficulty?: Database["public"]["Enums"]["difficulty_level"]
          explanation_bn?: string | null
          id?: string
          is_approved?: boolean
          options?: Json | null
          question_text?: string
          question_type?: Database["public"]["Enums"]["question_type"]
          source?: string | null
          teacher_reviewed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "questions_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          is_active: boolean
          name: string
          name_bn: string | null
          slug: string
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          name_bn?: string | null
          slug: string
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          name_bn?: string | null
          slug?: string
        }
        Relationships: []
      }
      syllabus_units: {
        Row: {
          chapter_id: string
          created_at: string
          id: string
          keywords: string[] | null
          learning_objectives: string[] | null
          subject_id: string
          title: string
          title_bn: string | null
        }
        Insert: {
          chapter_id: string
          created_at?: string
          id?: string
          keywords?: string[] | null
          learning_objectives?: string[] | null
          subject_id: string
          title: string
          title_bn?: string | null
        }
        Update: {
          chapter_id?: string
          created_at?: string
          id?: string
          keywords?: string[] | null
          learning_objectives?: string[] | null
          subject_id?: string
          title?: string
          title_bn?: string | null
        }
        Relationships: []
      }
      test_attempts: {
        Row: {
          chapter_id: string | null
          completed_at: string | null
          correct_count: number
          id: string
          score: number
          started_at: string
          subject_id: string | null
          total_questions: number
          user_id: string
        }
        Insert: {
          chapter_id?: string | null
          completed_at?: string | null
          correct_count?: number
          id?: string
          score?: number
          started_at?: string
          subject_id?: string | null
          total_questions?: number
          user_id: string
        }
        Update: {
          chapter_id?: string | null
          completed_at?: string | null
          correct_count?: number
          id?: string
          score?: number
          started_at?: string
          subject_id?: string | null
          total_questions?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_attempts_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_attempts_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      textbook_chunks: {
        Row: {
          chapter_id: string
          content: string
          created_at: string
          id: string
          page_ref: string | null
          source: string | null
          subject_id: string
        }
        Insert: {
          chapter_id: string
          content: string
          created_at?: string
          id?: string
          page_ref?: string | null
          source?: string | null
          subject_id: string
        }
        Update: {
          chapter_id?: string
          content?: string
          created_at?: string
          id?: string
          page_ref?: string | null
          source?: string | null
          subject_id?: string
        }
        Relationships: []
      }
      user_answers: {
        Row: {
          attempt_id: string
          created_at: string
          id: string
          is_correct: boolean
          question_id: string
          user_answer: string | null
          user_id: string
        }
        Insert: {
          attempt_id: string
          created_at?: string
          id?: string
          is_correct?: boolean
          question_id: string
          user_answer?: string | null
          user_id: string
        }
        Update: {
          attempt_id?: string
          created_at?: string
          id?: string
          is_correct?: boolean
          question_id?: string
          user_answer?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "test_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      compute_chapter_readiness: {
        Args: { _chapter_id: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "student"
      difficulty_level: "easy" | "medium" | "hard"
      question_type: "mcq" | "short" | "written"
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
      app_role: ["admin", "student"],
      difficulty_level: ["easy", "medium", "hard"],
      question_type: ["mcq", "short", "written"],
    },
  },
} as const
