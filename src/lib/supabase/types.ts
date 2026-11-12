// Minimal type helpers. Full codegen (`supabase gen types typescript`)
// recommended once the project is linked, per Supabase docs.
export type Json = unknown;

export interface Quartier {
  id: string;
  name: string;
  city: string;
  lat: number | null;
  lng: number | null;
  created_at: string;
}

export interface Profile {
  id: string;
  phone: string | null;
  email: string | null;
  language: "en" | "fr";
  home_quartier_id: string | null;
  role: "user" | "admin";
  is_blocked: boolean;
  created_at: string;
}

// PDF §8 "subscriptions": id, user_id, quartier_id, type, channel
export type AlertChannel = "whatsapp" | "sms";

export interface Subscription {
  id: string;
  user_id: string;
  quartier_id: string;
  type: ReportType;
  channel: AlertChannel;
  created_at: string;
}

export type ReportType = "light" | "water";
export type ReportStatus = "out" | "restored";
export type QuartierStatus = "out" | "unconfirmed" | "ok" | "unknown";

export interface Report {
  id: string;
  user_id: string;
  quartier_id: string;
  type: ReportType;
  status: ReportStatus;
  created_at: string;
  source: "app" | "chat";
  raw_text: string | null;
  ai_confidence: number | null;
}

export interface QuartierStatusRow {
  quartier_id: string;
  name: string;
  city: string;
  lat: number | null;
  lng: number | null;
  type: ReportType;
  status: QuartierStatus;
  reports_30m: number;
  confirmed_count: number;
  latest_at: string | null;
  outage_minutes_30d: number;
}

export interface Database {
  public: {
    Tables: {
      quartiers: {
        Row: Quartier;
        Insert: Omit<Quartier, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Quartier>;
      };
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, "created_at"> & { created_at?: string };
        Update: Partial<Profile>;
      };
      reports: {
        Row: Report;
        Insert: Omit<Report, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Report>;
      };
      subscriptions: {
        Row: Subscription;
        Insert: Omit<Subscription, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Subscription>;
      };
    };
    Views: {
      quartier_statuses: { Row: QuartierStatusRow };
    };
    // Other tables (confirmations, incidents, push_subscriptions,
    // ai_usage) are only touched via RLS-safe SQL/RPC — see
    // supabase/migrations/0001 + 0002.
    Functions: {
      insert_report: {
        Args: {
          p_quartier_id: string;
          p_type: string;
          p_status: string;
          p_source?: string;
          p_raw_text?: string | null;
          p_ai_confidence?: number | null;
        };
        Returns: Report;
      };
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
