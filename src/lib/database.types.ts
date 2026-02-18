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
      media: {
        Row: {
          id: string
          path: string
          name: string
          size_bytes: number
          type: 'movie' | 'series'
          category: string
          thumbnail_path: string | null
          is_copyable: boolean
          added_at: string
        }
        Insert: {
          id?: string
          path: string
          name: string
          size_bytes: number
          type: 'movie' | 'series'
          category: string
          thumbnail_path?: string | null
          is_copyable?: boolean
          added_at?: string
        }
        Update: {
          id?: string
          path?: string
          name?: string
          size_bytes?: number
          type?: 'movie' | 'series'
          category?: string
          thumbnail_path?: string | null
          is_copyable?: boolean
          added_at?: string
        }
      }
      drives: {
        Row: {
          id: string
          path: string
          label: string
          capacity_bytes: number
          available_bytes: number
          is_connected: boolean
          locked_by_job_id: string | null
          detected_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          path: string
          label: string
          capacity_bytes: number
          available_bytes: number
          is_connected?: boolean
          locked_by_job_id?: string | null
          detected_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          path?: string
          label?: string
          capacity_bytes?: number
          available_bytes?: number
          is_connected?: boolean
          locked_by_job_id?: string | null
          detected_at?: string
          updated_at?: string
        }
      }
      jobs: {
        Row: {
          id: string
          media_id: string
          drive_id: string
          status: 'pending' | 'active' | 'completed' | 'failed' | 'cancelled'
          progress_bytes: number
          total_bytes: number
          throughput_mbps: number | null
          error_message: string | null
          created_at: string
          started_at: string | null
          completed_at: string | null
          customer_ip: string | null
        }
        Insert: {
          id?: string
          media_id: string
          drive_id: string
          status?: 'pending' | 'active' | 'completed' | 'failed' | 'cancelled'
          progress_bytes?: number
          total_bytes: number
          throughput_mbps?: number | null
          error_message?: string | null
          created_at?: string
          started_at?: string | null
          completed_at?: string | null
          customer_ip?: string | null
        }
        Update: {
          id?: string
          media_id?: string
          drive_id?: string
          status?: 'pending' | 'active' | 'completed' | 'failed' | 'cancelled'
          progress_bytes?: number
          total_bytes?: number
          throughput_mbps?: number | null
          error_message?: string | null
          created_at?: string
          started_at?: string | null
          completed_at?: string | null
          customer_ip?: string | null
        }
      }
      sales: {
        Row: {
          id: string
          job_id: string
          media_id: string
          price_charged: number
          currency: string
          payment_ref: string | null
          payment_confirmed: boolean
          timestamp: string
          shop_id: string
        }
        Insert: {
          id?: string
          job_id: string
          media_id: string
          price_charged: number
          currency?: string
          payment_ref?: string | null
          payment_confirmed?: boolean
          timestamp?: string
          shop_id?: string
        }
        Update: {
          id?: string
          job_id?: string
          media_id?: string
          price_charged?: number
          currency?: string
          payment_ref?: string | null
          payment_confirmed?: boolean
          timestamp?: string
          shop_id?: string
        }
      }
      admin_users: {
        Row: {
          id: string
          username: string
          password_hash: string
          role: 'admin' | 'operator'
          created_at: string
          last_login: string | null
        }
        Insert: {
          id?: string
          username: string
          password_hash: string
          role?: 'admin' | 'operator'
          created_at?: string
          last_login?: string | null
        }
        Update: {
          id?: string
          username?: string
          password_hash?: string
          role?: 'admin' | 'operator'
          created_at?: string
          last_login?: string | null
        }
      }
      pricing_tiers: {
        Row: {
          id: string
          name: string
          category: string
          price: number
          currency: string
          active: boolean
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          category: string
          price: number
          currency?: string
          active?: boolean
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          category?: string
          price?: number
          currency?: string
          active?: boolean
          updated_at?: string
        }
      }
    }
  }
}
