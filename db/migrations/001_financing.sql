-- plata.pe — Mapa de Financiamiento Político Peruano
-- Migration 001: financing_records

CREATE TABLE IF NOT EXISTS financing_records (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  source           TEXT        NOT NULL,        -- 'claridad' | 'legacy_onpe' | 'pdf'
  year             INT         NOT NULL,
  electoral_process TEXT,                        -- 'EG2021', 'EM2018', etc.
  party_name       TEXT        NOT NULL,
  party_type       TEXT,                         -- 'partido' | 'movimiento_regional' | 'alianza' | 'lista_independiente'
  financing_type   TEXT,                         -- 'privado' | 'publico_directo' | 'publico_indirecto'
  donor_name       TEXT,
  donor_dni_ruc    TEXT,
  donor_type       TEXT,                         -- 'persona_natural' | 'persona_juridica'
  amount_soles     NUMERIC(15, 2),
  donation_type    TEXT,                         -- 'efectivo' | 'especie' | 'bancarizado'
  date             DATE,
  candidate_name   TEXT,
  raw_data         JSONB,                        -- raw scraped data for debugging
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_financing_records_year_party
  ON financing_records (year, party_name);

CREATE INDEX IF NOT EXISTS idx_financing_records_donor_dni
  ON financing_records (donor_dni_ruc);

CREATE INDEX IF NOT EXISTS idx_financing_records_party_name
  ON financing_records (party_name);

CREATE INDEX IF NOT EXISTS idx_financing_records_year
  ON financing_records (year);

CREATE INDEX IF NOT EXISTS idx_financing_records_amount
  ON financing_records (amount_soles DESC);
