export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type LeadSource = "manual" | "email" | "call" | "referral";
export type LeadStatus = "draft" | "confirmed" | "dismissed" | "merged";
export type LeadConfidence = "high" | "medium" | "low";
export type BuyerTemperature = "hot" | "warm" | "cool" | "cold";
export type DealStage =
  | "prospecting"
  | "touring"
  | "pre_offer"
  | "negotiating"
  | "under_contract"
  | "inspection"
  | "appraisal"
  | "closing"
  | "closed"
  | "dead";
export type CommunicationType = "email" | "call";
export type CommunicationDirection = "inbound" | "outbound";
export type CommunicationClassification =
  | "deal_relevant"
  | "new_lead"
  | "noise"
  | "action_required";
export type AgentTaskType =
  | "zillow_search"
  | "property_detail"
  | "cross_reference"
  | "comp_analysis"
  | "listing_monitor"
  | "listing_agent_profile"
  | "full_research_pipeline";
export type AgentTaskStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";
export type OfferType =
  | "initial"
  | "counter"
  | "best_and_final"
  | "accepted"
  | "rejected";
export type ActivityEventType =
  | "lead_detected"
  | "lead_confirmed"
  | "lead_dismissed"
  | "buyer_created"
  | "buyer_updated"
  | "buyer_criteria_changed"
  | "research_started"
  | "research_completed"
  | "properties_sent"
  | "property_price_change"
  | "property_status_change"
  | "email_received"
  | "email_sent"
  | "email_drafted"
  | "call_completed"
  | "call_analyzed"
  | "deal_created"
  | "deal_stage_changed"
  | "offer_submitted"
  | "counter_received"
  | "deal_accepted"
  | "dashboard_viewed"
  | "property_favorited"
  | "comment_added"
  | "inspection_analyzed"
  | "appraisal_received"
  | "deadline_approaching"
  | "deal_closed"
  | "property_imported";

export interface AgentPreferences {
  // Notifications
  new_leads: boolean;
  email_activity: boolean;
  property_changes: boolean;
  deadline_reminders: boolean;
  // Voice AI
  auto_create_leads_from_calls: boolean;
  // Enrichment
  auto_enrich_properties: boolean;
  // AI Features
  ai_property_scoring: boolean;
  ai_email_classification: boolean;
}

export const DEFAULT_PREFERENCES: AgentPreferences = {
  new_leads: true,
  email_activity: true,
  property_changes: true,
  deadline_reminders: true,
  auto_create_leads_from_calls: true,
  auto_enrich_properties: true,
  ai_property_scoring: true,
  ai_email_classification: true,
};

export interface Database {
  public: {
    Tables: {
      agents: {
        Row: {
          id: string;
          user_id: string;
          email: string;
          full_name: string;
          phone: string | null;
          brokerage: string | null;
          gmail_connected: boolean;
          gmail_access_token: string | null;
          gmail_refresh_token: string | null;
          gmail_token_expires_at: string | null;
          gmail_last_scan_at: string | null;
          calendar_connected: boolean;
          notification_preferences: Json;
          email_signature: string | null;
          communication_tone: string;
          negotiation_style_profile: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          email: string;
          full_name: string;
          phone?: string | null;
          brokerage?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["agents"]["Row"]>;
      };
      leads: {
        Row: {
          id: string;
          agent_id: string;
          status: LeadStatus;
          source: LeadSource;
          confidence: LeadConfidence;
          name: string | null;
          email: string | null;
          phone: string | null;
          raw_source_content: string | null;
          extracted_info: Json;
          potential_duplicate_of: string | null;
          merged_into_buyer_id: string | null;
          source_communication_id: string | null;
          detected_at: string;
          confirmed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          agent_id: string;
          source: LeadSource;
          status?: LeadStatus;
          confidence?: LeadConfidence;
          name?: string | null;
          email?: string | null;
          phone?: string | null;
          raw_source_content?: string | null;
          extracted_info?: Json;
        };
        Update: Partial<Database["public"]["Tables"]["leads"]["Row"]>;
      };
      buyers: {
        Row: {
          id: string;
          agent_id: string;
          full_name: string;
          email: string | null;
          phone: string | null;
          dashboard_token: string;
          intent_profile: Json;
          temperature: BuyerTemperature;
          last_activity_at: string | null;
          last_dashboard_visit_at: string | null;
          dashboard_visit_count: number;
          source: LeadSource;
          referral_source: string | null;
          referral_buyer_id: string | null;
          original_lead_id: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          agent_id: string;
          full_name: string;
          source: LeadSource;
          email?: string | null;
          phone?: string | null;
          intent_profile?: Json;
          temperature?: BuyerTemperature;
          referral_source?: string | null;
          original_lead_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["buyers"]["Row"]>;
      };
      properties: {
        Row: {
          id: string;
          agent_id: string;
          address: string;
          city: string | null;
          state: string | null;
          zip: string | null;
          latitude: number | null;
          longitude: number | null;
          listing_price: number | null;
          beds: number | null;
          baths: number | null;
          sqft: number | null;
          lot_sqft: number | null;
          year_built: number | null;
          property_type: string | null;
          hoa_monthly: number | null;
          tax_annual: number | null;
          tax_assessed_value: number | null;
          listing_description: string | null;
          photos: Json;
          amenities: Json;
          walk_score: number | null;
          transit_score: number | null;
          school_ratings: Json;
          commute_data: Json;
          days_on_market: number | null;
          listing_status: string;
          zillow_url: string | null;
          zillow_id: string | null;
          mls_number: string | null;
          price_history: Json;
          seller_motivation_score: number | null;
          seller_motivation_reasoning: string | null;
          listing_changes_log: Json;
          listing_agent_id: string | null;
          is_monitored: boolean;
          last_monitored_at: string | null;
          monitoring_interval_hours: number;
          scraped_at: string | null;
          enrichment_data: Json;
          research_task_id: string | null;
          enrichment_data: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          agent_id: string;
          address: string;
          city?: string | null;
          state?: string | null;
          zip?: string | null;
          listing_price?: number | null;
          beds?: number | null;
          baths?: number | null;
          sqft?: number | null;
          enrichment_data?: Json;
        };
        Update: Partial<Database["public"]["Tables"]["properties"]["Row"]>;
      };
      buyer_property_scores: {
        Row: {
          id: string;
          buyer_id: string;
          property_id: string;
          match_score: number;
          score_reasoning: string | null;
          score_breakdown: Json;
          buyer_favorable_comps: Json;
          seller_favorable_comps: Json;
          fair_market_value_low: number | null;
          fair_market_value_mid: number | null;
          fair_market_value_high: number | null;
          agent_rank: number | null;
          agent_notes: string | null;
          is_sent_to_buyer: boolean;
          sent_at: string | null;
          is_favorited: boolean;
          favorited_at: string | null;
          view_count: number;
          total_dwell_seconds: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          buyer_id: string;
          property_id: string;
          match_score: number;
          score_reasoning?: string | null;
          score_breakdown?: Json;
        };
        Update: Partial<Database["public"]["Tables"]["buyer_property_scores"]["Row"]>;
      };
      deals: {
        Row: {
          id: string;
          agent_id: string;
          buyer_id: string;
          property_id: string;
          stage: DealStage;
          stage_entered_at: string;
          stage_history: Json;
          current_offer_price: number | null;
          agreed_price: number | null;
          contract_date: string | null;
          closing_date: string | null;
          earnest_money: number | null;
          contingencies: Json;
          deal_probability: number | null;
          intelligence_dossier: Json;
          offer_strategy_brief: Json;
          inspection_report_url: string | null;
          inspection_analysis: Json;
          repair_negotiation_strategy: Json;
          appraised_value: number | null;
          appraisal_scenarios: Json;
          closing_checklist: Json;
          final_walkthrough_checklist: Json;
          satisfaction_score: number | null;
          closed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          agent_id: string;
          buyer_id: string;
          property_id: string;
          stage?: DealStage;
        };
        Update: Partial<Database["public"]["Tables"]["deals"]["Row"]>;
      };
      offers: {
        Row: {
          id: string;
          deal_id: string;
          round_number: number;
          offer_type: OfferType;
          price: number;
          closing_days: number | null;
          contingencies_waived: Json;
          personal_property_included: Json;
          personal_property_excluded: Json;
          other_terms: string | null;
          ai_analysis: Json;
          source_communication_id: string | null;
          submitted_at: string;
          response_deadline: string | null;
          created_at: string;
        };
        Insert: {
          deal_id: string;
          round_number: number;
          offer_type: OfferType;
          price: number;
          closing_days?: number | null;
          other_terms?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["offers"]["Row"]>;
      };
      communications: {
        Row: {
          id: string;
          agent_id: string;
          type: CommunicationType;
          direction: CommunicationDirection;
          buyer_id: string | null;
          deal_id: string | null;
          lead_id: string | null;
          subject: string | null;
          raw_content: string | null;
          from_address: string | null;
          to_address: string | null;
          duration_seconds: number | null;
          recording_url: string | null;
          classification: CommunicationClassification | null;
          ai_analysis: Json;
          gmail_message_id: string | null;
          gmail_thread_id: string | null;
          is_processed: boolean;
          processed_at: string | null;
          occurred_at: string;
          created_at: string;
        };
        Insert: {
          agent_id: string;
          type: CommunicationType;
          direction: CommunicationDirection;
          occurred_at?: string;
          buyer_id?: string | null;
          deal_id?: string | null;
          subject?: string | null;
          raw_content?: string | null;
          from_address?: string | null;
          to_address?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["communications"]["Row"]>;
      };
      activity_feed: {
        Row: {
          id: string;
          agent_id: string;
          event_type: ActivityEventType;
          buyer_id: string | null;
          property_id: string | null;
          deal_id: string | null;
          communication_id: string | null;
          task_id: string | null;
          title: string;
          description: string | null;
          metadata: Json;
          is_read: boolean;
          is_action_required: boolean;
          occurred_at: string;
          created_at: string;
        };
        Insert: {
          agent_id: string;
          event_type: ActivityEventType;
          title: string;
          description?: string | null;
          metadata?: Json;
          is_action_required?: boolean;
          buyer_id?: string | null;
          property_id?: string | null;
          deal_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["activity_feed"]["Row"]>;
      };
      agent_tasks: {
        Row: {
          id: string;
          agent_id: string;
          buyer_id: string | null;
          task_type: AgentTaskType;
          status: AgentTaskStatus;
          priority: number;
          input_params: Json;
          output_data: Json;
          started_at: string | null;
          completed_at: string | null;
          failed_at: string | null;
          error_message: string | null;
          retry_count: number;
          max_retries: number;
          execution_log: Json;
          is_recurring: boolean;
          recurrence_interval_hours: number | null;
          next_run_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          agent_id: string;
          task_type: AgentTaskType;
          input_params: Json;
          buyer_id?: string | null;
          priority?: number;
        };
        Update: Partial<Database["public"]["Tables"]["agent_tasks"]["Row"]>;
      };
      listing_agents: {
        Row: {
          id: string;
          name: string;
          brokerage: string | null;
          phone: string | null;
          email: string | null;
          active_listing_count: number | null;
          avg_days_on_market: number | null;
          avg_list_to_sale_ratio: number | null;
          avg_counter_rounds: number | null;
          typical_first_counter_drop: number | null;
          total_deals_analyzed: number;
          profile_data: Json;
          last_profiled_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          name: string;
          brokerage?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["listing_agents"]["Row"]>;
      };
      dashboard_sessions: {
        Row: {
          id: string;
          buyer_id: string;
          started_at: string;
          ended_at: string | null;
          duration_seconds: number | null;
          page_views: Json;
          actions: Json;
          created_at: string;
        };
        Insert: {
          buyer_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["dashboard_sessions"]["Row"]>;
      };
      buyer_comments: {
        Row: {
          id: string;
          buyer_id: string;
          property_id: string;
          content: string;
          created_at: string;
        };
        Insert: {
          buyer_id: string;
          property_id: string;
          content: string;
        };
        Update: Partial<Database["public"]["Tables"]["buyer_comments"]["Row"]>;
      };
      enrichment_cache: {
        Row: {
          id: string;
          address_normalized: string;
          lat: number | null;
          lng: number | null;
          provider: string;
          data: Json;
          fetched_at: string;
          expires_at: string;
        };
        Insert: {
          address_normalized: string;
          provider: string;
          data: Json;
          lat?: number | null;
          lng?: number | null;
          fetched_at?: string;
          expires_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["enrichment_cache"]["Row"]>;
      };
    };
  };
}
