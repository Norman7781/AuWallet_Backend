type UntypedTable = {
  Row: Record<string, unknown>;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
  Relationships: [];
};

type EmptySchema = {
  Tables: {
    [_ in never]: never;
  };
  Views: {
    [_ in never]: never;
  };
  Functions: {
    [_ in never]: never;
  };
};

export type Database = {
  public: EmptySchema;
  academic: {
    Tables: {
      academic_term: UntypedTable;
      course: UntypedTable;
      course_result: UntypedTable;
      graduation_record: UntypedTable;
      program: UntypedTable;
      student: UntypedTable;
      student_program_enrollment: UntypedTable;
      transcript: UntypedTable;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
  };
  wallet: {
    Tables: {
      holder_account: UntypedTable;
      uploaded_identity_document: UntypedTable;
      wallet_onboarding_request: UntypedTable;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
  };
};
