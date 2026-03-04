-- Migration 002: unique constraint for individual aportante records
-- Prevents duplicate inserts when running the download script multiple times

ALTER TABLE financing_records
  ADD COLUMN IF NOT EXISTS dedup_hash TEXT GENERATED ALWAYS AS (
    md5(
      coalesce(electoral_process, '') || '|' ||
      coalesce(party_name, '') || '|' ||
      coalesce(donor_dni_ruc, '') || '|' ||
      coalesce(amount_soles::text, '') || '|' ||
      coalesce(date::text, '') || '|' ||
      coalesce(donation_type, '')
    )
  ) STORED;

CREATE UNIQUE INDEX IF NOT EXISTS idx_financing_records_dedup
  ON financing_records (dedup_hash)
  WHERE source = 'claridad_api';
