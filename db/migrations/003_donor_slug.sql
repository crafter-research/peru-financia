-- Migration 003: Add donor_slug for public-facing URLs
-- Replaces DNI/RUC exposure with privacy-safe slugs
-- DNI/RUC stays in DB for dedup/scraping but is never sent to frontend

ALTER TABLE financing_records
  ADD COLUMN IF NOT EXISTS donor_slug TEXT;

UPDATE financing_records
SET donor_slug = lower(
  regexp_replace(
    regexp_replace(
      coalesce(donor_name, 'anonimo'),
      '[^a-zA-Z0-9\s]', '', 'g'
    ),
    '\s+', '-', 'g'
  )
) || '-' || left(md5(coalesce(donor_dni_ruc, id::text)), 6)
WHERE donor_slug IS NULL;

CREATE INDEX IF NOT EXISTS idx_financing_records_donor_slug
  ON financing_records (donor_slug);
