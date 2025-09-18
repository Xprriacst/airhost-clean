export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      properties: {
        Row: {
          id: string
          host_id: string // References auth.users.id
          name: string
          address: string
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          host_id: string // References auth.users.id
          name: string
          address: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          host_id?: string // References auth.users.id
          name?: string
          address?: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      conversations: {
        Row: {
          id: string
          property_id: string
          host_id: string // References auth.users.id
          guest_number: string
          guest_name: string | null
          guest_phone: string | null
          check_in_date: string | null
          check_out_date: string | null
          status: string
          unread_count: number
          last_message: string | null
          last_message_at: string
          lodgify_booking_id: string | null
          lodgify_thread_uid: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          property_id: string
          host_id: string // References auth.users.id
          guest_number: string
          guest_name?: string | null
          guest_phone?: string | null
          check_in_date?: string | null
          check_out_date?: string | null
          status?: string
          unread_count?: number
          last_message?: string | null
          last_message_at?: string
          lodgify_booking_id?: string | null
          lodgify_thread_uid?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          property_id?: string
          host_id?: string // References auth.users.id
          guest_number?: string
          guest_name?: string | null
          guest_phone?: string | null
          check_in_date?: string | null
          check_out_date?: string | null
          status?: string
          unread_count?: number
          last_message?: string | null
          last_message_at?: string
          lodgify_booking_id?: string | null
          lodgify_thread_uid?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          content: string
          type: 'text' | 'template'
          direction: 'inbound' | 'outbound'
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          content: string
          type: 'text' | 'template'
          direction: 'inbound' | 'outbound'
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          content?: string
          type?: 'text' | 'template'
          direction?: 'inbound' | 'outbound'
          created_at?: string
        }
      }
      templates: {
        Row: {
          id: string
          host_id: string // References auth.users.id
          name: string
          language: string
          content: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          host_id: string // References auth.users.id
          name: string
          language: string
          content: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          host_id?: string // References auth.users.id
          name?: string
          language?: string
          content?: string
          created_at?: string
          updated_at?: string
        }
      }
      lodgify_config: {
        Row: {
          id: string
          host_id: string // References auth.users.id
          api_key: string
          webhook_configured: boolean
          booking_webhook_id: string | null
          message_webhook_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          host_id: string // References auth.users.id
          api_key: string
          webhook_configured?: boolean
          booking_webhook_id?: string | null
          message_webhook_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          host_id?: string // References auth.users.id
          api_key?: string
          webhook_configured?: boolean
          booking_webhook_id?: string | null
          message_webhook_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      whatsapp_config: {
        Row: {
          id: string
          host_id: string // References auth.users.id
          phone_number_id: string
          access_token: string
          verify_token: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          host_id: string // References auth.users.id
          phone_number_id: string
          access_token: string
          verify_token?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          host_id?: string // References auth.users.id
          phone_number_id?: string
          access_token?: string
          verify_token?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      messaging_config: {
        Row: {
          id: string
          host_id: string // References auth.users.id
          preferred_channel: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          host_id: string // References auth.users.id
          preferred_channel: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          host_id?: string // References auth.users.id
          preferred_channel?: string
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}
