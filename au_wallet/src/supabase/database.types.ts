type UntypedTable = {
  Row: Record<string, unknown>;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
  Relationships: [];
};

export type WalletAccountStatus =
  'pending' | 'active' | 'rejected' | 'suspended';

type HolderAccountTable = {
  Row: {
    holder_account_id: number;
    auth_user_id: string;
    university_email: string | null;
    personal_email: string;
    account_status: WalletAccountStatus;
    confirmed_at: string | null;
    created_at: string;
    updated_at: string;
  };
  Insert: {
    holder_account_id?: number;
    auth_user_id: string;
    university_email?: string | null;
    personal_email: string;
    account_status?: WalletAccountStatus;
    confirmed_at?: string | null;
    created_at?: string;
    updated_at?: string;
  };
  Update: {
    holder_account_id?: number;
    auth_user_id?: string;
    university_email?: string | null;
    personal_email?: string;
    account_status?: WalletAccountStatus;
    confirmed_at?: string | null;
    created_at?: string;
    updated_at?: string;
  };
  Relationships: [];
};

type LoginHistoryTable = {
  Row: {
    login_history_id: number;
    auth_user_id: string | null;
    holder_account_id: number | null;
    email: string | null;
    ip_address: string | null;
    user_agent: string | null;
    login_status: 'SUCCESS' | 'FAILED' | 'LOGGED_OUT';
    failure_reason: string | null;
    login_time: string;
    created_at: string;
  };
  Insert: {
    login_history_id?: number;
    auth_user_id?: string | null;
    holder_account_id?: number | null;
    email?: string | null;
    ip_address?: string | null;
    user_agent?: string | null;
    login_status: 'SUCCESS' | 'FAILED' | 'LOGGED_OUT';
    failure_reason?: string | null;
    login_time?: string;
    created_at?: string;
  };
  Update: {
    login_history_id?: number;
    auth_user_id?: string | null;
    holder_account_id?: number | null;
    email?: string | null;
    ip_address?: string | null;
    user_agent?: string | null;
    login_status?: 'SUCCESS' | 'FAILED' | 'LOGGED_OUT';
    failure_reason?: string | null;
    login_time?: string;
    created_at?: string;
  };
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
      holder_account: HolderAccountTable;
      login_history: LoginHistoryTable;
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
