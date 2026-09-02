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
    first_name: string;
    last_name: string;
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
    first_name: string;
    last_name: string;
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
    first_name?: string;
    last_name?: string;
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

export type OnboardingVerificationStatus =
  'submitted' | 'under_review' | 'matched' | 'rejected';

export type IssuerAvailability = 'available' | 'coming_soon' | 'disabled';
export type IssuerConnectionStatus =
  'pending_verification' | 'verified' | 'rejected' | 'disconnected';

type IssuerProviderTable = {
  Row: {
    issuer_provider_id: number;
    issuer_code: string;
    display_name: string;
    description: string;
    availability: IssuerAvailability;
    connection_verification_enabled: boolean;
    is_mock: boolean;
    created_at: string;
    updated_at: string;
  };
  Insert: {
    issuer_provider_id?: number;
    issuer_code: string;
    display_name: string;
    description: string;
    availability: IssuerAvailability;
    connection_verification_enabled?: boolean;
    is_mock?: boolean;
    created_at?: string;
    updated_at?: string;
  };
  Update: {
    issuer_provider_id?: number;
    issuer_code?: string;
    display_name?: string;
    description?: string;
    availability?: IssuerAvailability;
    connection_verification_enabled?: boolean;
    is_mock?: boolean;
    created_at?: string;
    updated_at?: string;
  };
  Relationships: [];
};

type HolderIssuerConnectionTable = {
  Row: {
    holder_issuer_connection_id: number;
    holder_account_id: number;
    issuer_provider_id: number;
    connection_status: IssuerConnectionStatus;
    verified_enrollment_id: number | null;
    verified_at: string | null;
    created_at: string;
    updated_at: string;
  };
  Insert: {
    holder_issuer_connection_id?: number;
    holder_account_id: number;
    issuer_provider_id: number;
    connection_status?: IssuerConnectionStatus;
    verified_enrollment_id?: number | null;
    verified_at?: string | null;
    created_at?: string;
    updated_at?: string;
  };
  Update: {
    holder_issuer_connection_id?: number;
    holder_account_id?: number;
    issuer_provider_id?: number;
    connection_status?: IssuerConnectionStatus;
    verified_enrollment_id?: number | null;
    verified_at?: string | null;
    created_at?: string;
    updated_at?: string;
  };
  Relationships: [];
};

type WalletOnboardingRequestTable = {
  Row: {
    onboarding_request_id: number;
    holder_account_id: number;
    holder_issuer_connection_id: number;
    admission_no: string;
    date_of_birth: string;
    passport_number_hmac: string;
    verification_status: OnboardingVerificationStatus;
    matched_enrollment_id: number | null;
    reviewed_by: string | null;
    reviewed_at: string | null;
    rejection_reason: string | null;
    submitted_at: string;
  };
  Insert: {
    onboarding_request_id?: number;
    holder_account_id: number;
    holder_issuer_connection_id: number;
    admission_no: string;
    date_of_birth: string;
    passport_number_hmac: string;
    verification_status?: OnboardingVerificationStatus;
    matched_enrollment_id?: number | null;
    reviewed_by?: string | null;
    reviewed_at?: string | null;
    rejection_reason?: string | null;
    submitted_at?: string;
  };
  Update: {
    onboarding_request_id?: number;
    holder_account_id?: number;
    holder_issuer_connection_id?: number;
    admission_no?: string;
    date_of_birth?: string;
    passport_number_hmac?: string;
    verification_status?: OnboardingVerificationStatus;
    matched_enrollment_id?: number | null;
    reviewed_by?: string | null;
    reviewed_at?: string | null;
    rejection_reason?: string | null;
    submitted_at?: string;
  };
  Relationships: [];
};

type IssuerAccountTable = {
  Row: {
    id: string;
    name: string;
    email: string;
    password_hash: string;
    role: string;
    issuer_provider_id: number | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  };
  Insert: {
    id?: string;
    name: string;
    email: string;
    password_hash: string;
    role?: string;
    issuer_provider_id?: number | null;
    is_active?: boolean;
    created_at?: string;
    updated_at?: string;
  };
  Update: {
    id?: string;
    name?: string;
    email?: string;
    password_hash?: string;
    role?: string;
    issuer_provider_id?: number | null;
    is_active?: boolean;
    created_at?: string;
    updated_at?: string;
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
      holder_issuer_connection: HolderIssuerConnectionTable;
      issuer_account: IssuerAccountTable;
      issuer_provider: IssuerProviderTable;
      login_history: LoginHistoryTable;
      uploaded_identity_document: UntypedTable;
      wallet_onboarding_request: WalletOnboardingRequestTable;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      approve_onboarding_request: {
        Args: {
          p_onboarding_request_id: number;
          p_reviewed_by: string;
        };
        Returns: {
          onboarding_request_id: number;
          holder_issuer_connection_id: number;
          issuer_code: string;
          connection_status: IssuerConnectionStatus;
          verification_status: OnboardingVerificationStatus;
          matched_enrollment_id: number | null;
          rejection_reason: string | null;
          reviewed_at: string | null;
          submitted_at: string;
          verified_at: string;
        }[];
      };
      reject_issuer_verification_request: {
        Args: {
          p_onboarding_request_id: number;
          p_reviewed_by: string;
          p_rejection_reason: string;
        };
        Returns: {
          onboarding_request_id: number;
          holder_issuer_connection_id: number;
          issuer_code: string;
          connection_status: IssuerConnectionStatus;
          verification_status: OnboardingVerificationStatus;
          matched_enrollment_id: number | null;
          rejection_reason: string | null;
          reviewed_at: string | null;
          submitted_at: string;
          verified_at: string | null;
        }[];
      };
      submit_issuer_connection_verification: {
        Args: {
          p_holder_account_id: number;
          p_issuer_code: string;
          p_admission_no: string;
          p_date_of_birth: string;
          p_passport_number_hmac: string;
        };
        Returns: {
          issuer_code: string;
          connection_status: IssuerConnectionStatus;
          verification_status: OnboardingVerificationStatus;
          rejection_reason: string | null;
          submitted_at: string;
          reviewed_at: string | null;
          verified_at: string | null;
        }[];
      };
    };
  };
};
