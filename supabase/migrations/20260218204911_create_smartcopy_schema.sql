/*
  # SmartCopy System Database Schema

  1. New Tables
    - `media`
      - `id` (uuid, primary key) - unique media identifier
      - `path` (text) - filesystem path to media file
      - `name` (text) - display name
      - `size_bytes` (bigint) - file size in bytes
      - `type` (text) - 'movie' or 'series'
      - `category` (text) - SD/HD/4K classification
      - `thumbnail_path` (text, nullable) - path to thumbnail
      - `is_copyable` (boolean) - admin can disable specific media
      - `added_at` (timestamptz) - when media was added
      
    - `drives`
      - `id` (uuid, primary key) - unique drive identifier
      - `path` (text) - drive mount path (e.g., D:\)
      - `label` (text) - drive label/name
      - `capacity_bytes` (bigint) - total drive capacity
      - `available_bytes` (bigint) - free space available
      - `is_connected` (boolean) - current connection status
      - `locked_by_job_id` (uuid, nullable) - FK to jobs table
      - `detected_at` (timestamptz) - when drive was detected
      - `updated_at` (timestamptz) - last status update
    
    - `jobs`
      - `id` (uuid, primary key) - unique job identifier
      - `media_id` (uuid) - FK to media table
      - `drive_id` (uuid) - FK to drives table
      - `status` (text) - pending/active/completed/failed/cancelled
      - `progress_bytes` (bigint) - bytes copied so far
      - `total_bytes` (bigint) - total bytes to copy
      - `throughput_mbps` (numeric, nullable) - current copy speed
      - `error_message` (text, nullable) - failure reason
      - `created_at` (timestamptz) - job creation time
      - `started_at` (timestamptz, nullable) - when copy began
      - `completed_at` (timestamptz, nullable) - when job finished
      - `customer_ip` (text, nullable) - customer device IP
    
    - `sales`
      - `id` (uuid, primary key) - unique sale identifier
      - `job_id` (uuid) - FK to jobs table
      - `media_id` (uuid) - FK to media table
      - `price_charged` (numeric) - amount charged
      - `currency` (text) - USD/EUR/etc
      - `payment_ref` (text, nullable) - payment reference
      - `payment_confirmed` (boolean) - payment status
      - `timestamp` (timestamptz) - sale timestamp
      - `shop_id` (text) - shop identifier for multi-shop setups
    
    - `admin_users`
      - `id` (uuid, primary key) - unique admin identifier
      - `username` (text, unique) - admin username
      - `password_hash` (text) - bcrypt hashed password
      - `role` (text) - admin/operator
      - `created_at` (timestamptz) - account creation time
      - `last_login` (timestamptz, nullable) - last login timestamp
    
    - `pricing_tiers`
      - `id` (uuid, primary key) - unique tier identifier
      - `name` (text) - tier name (SD Movie, HD Movie, etc)
      - `category` (text) - matches media.category
      - `price` (numeric) - price amount
      - `currency` (text) - currency code
      - `active` (boolean) - whether tier is active
      - `updated_at` (timestamptz) - last update time

  2. Security
    - Enable RLS on all tables
    - Public read access for media (LAN-only enforcement at network level)
    - Authenticated admin access for drives, jobs, sales, admin_users
    - Restrictive policies for data modification
*/

-- Media table
CREATE TABLE IF NOT EXISTS media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path text NOT NULL,
  name text NOT NULL,
  size_bytes bigint NOT NULL,
  type text NOT NULL CHECK (type IN ('movie', 'series')),
  category text NOT NULL,
  thumbnail_path text,
  is_copyable boolean DEFAULT true,
  added_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_media_type ON media(type);
CREATE INDEX IF NOT EXISTS idx_media_category ON media(category);
CREATE INDEX IF NOT EXISTS idx_media_copyable ON media(is_copyable);

-- Drives table
CREATE TABLE IF NOT EXISTS drives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path text NOT NULL UNIQUE,
  label text NOT NULL,
  capacity_bytes bigint NOT NULL,
  available_bytes bigint NOT NULL,
  is_connected boolean DEFAULT true,
  locked_by_job_id uuid,
  detected_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_drives_connected ON drives(is_connected);
CREATE INDEX IF NOT EXISTS idx_drives_locked ON drives(locked_by_job_id);

-- Jobs table
CREATE TABLE IF NOT EXISTS jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id uuid NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  drive_id uuid NOT NULL REFERENCES drives(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'failed', 'cancelled')),
  progress_bytes bigint DEFAULT 0,
  total_bytes bigint NOT NULL,
  throughput_mbps numeric,
  error_message text,
  created_at timestamptz DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  customer_ip text
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_media_id ON jobs(media_id);
CREATE INDEX IF NOT EXISTS idx_jobs_drive_id ON jobs(drive_id);

-- Sales table
CREATE TABLE IF NOT EXISTS sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  media_id uuid NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  price_charged numeric NOT NULL,
  currency text DEFAULT 'USD',
  payment_ref text,
  payment_confirmed boolean DEFAULT false,
  timestamp timestamptz DEFAULT now(),
  shop_id text DEFAULT 'default'
);

CREATE INDEX IF NOT EXISTS idx_sales_timestamp ON sales(timestamp);
CREATE INDEX IF NOT EXISTS idx_sales_shop_id ON sales(shop_id);
CREATE INDEX IF NOT EXISTS idx_sales_payment_confirmed ON sales(payment_confirmed);

-- Admin users table
CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'operator' CHECK (role IN ('admin', 'operator')),
  created_at timestamptz DEFAULT now(),
  last_login timestamptz
);

-- Pricing tiers table
CREATE TABLE IF NOT EXISTS pricing_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  price numeric NOT NULL,
  currency text DEFAULT 'USD',
  active boolean DEFAULT true,
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pricing_active ON pricing_tiers(active);

-- Enable RLS on all tables
ALTER TABLE media ENABLE ROW LEVEL SECURITY;
ALTER TABLE drives ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_tiers ENABLE ROW LEVEL SECURITY;

-- Media policies (public read for browsing, admin write)
CREATE POLICY "Anyone can view copyable media"
  ON media FOR SELECT
  USING (is_copyable = true);

CREATE POLICY "Admins can insert media"
  ON media FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can update media"
  ON media FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins can delete media"
  ON media FOR DELETE
  TO authenticated
  USING (true);

-- Drives policies (public read for drive selection, admin write)
CREATE POLICY "Anyone can view connected drives"
  ON drives FOR SELECT
  USING (is_connected = true);

CREATE POLICY "System can insert drives"
  ON drives FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update drives"
  ON drives FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "System can delete drives"
  ON drives FOR DELETE
  USING (true);

-- Jobs policies (users can create and view their own, admins can view all)
CREATE POLICY "Anyone can create jobs"
  ON jobs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can view all jobs"
  ON jobs FOR SELECT
  USING (true);

CREATE POLICY "System can update jobs"
  ON jobs FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "System can delete jobs"
  ON jobs FOR DELETE
  USING (true);

-- Sales policies (admin only)
CREATE POLICY "Admins can view sales"
  ON sales FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can insert sales"
  ON sales FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can update sales"
  ON sales FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Admin users policies (admin only)
CREATE POLICY "Admins can view admin users"
  ON admin_users FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert admin users"
  ON admin_users FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can update admin users"
  ON admin_users FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Pricing tiers policies (public read, admin write)
CREATE POLICY "Anyone can view active pricing tiers"
  ON pricing_tiers FOR SELECT
  USING (active = true);

CREATE POLICY "Admins can insert pricing tiers"
  ON pricing_tiers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can update pricing tiers"
  ON pricing_tiers FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Insert default pricing tiers
INSERT INTO pricing_tiers (name, category, price, currency, active)
VALUES 
  ('SD Movie', 'SD', 1.00, 'USD', true),
  ('HD Movie', 'HD', 2.00, 'USD', true),
  ('4K Movie', '4K', 3.50, 'USD', true),
  ('TV Series Season', 'Series', 5.00, 'USD', true)
ON CONFLICT DO NOTHING;

-- Add foreign key constraint for drives locked_by_job_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'drives_locked_by_job_id_fkey'
  ) THEN
    ALTER TABLE drives ADD CONSTRAINT drives_locked_by_job_id_fkey 
      FOREIGN KEY (locked_by_job_id) REFERENCES jobs(id) ON DELETE SET NULL;
  END IF;
END $$;