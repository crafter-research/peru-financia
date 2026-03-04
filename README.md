# peru-financia

Mapa open-source de financiamiento político peruano. Sankey diagrams de flujos de dinero hacia partidos, movimientos regionales y candidatos.

**Datos**: ONPE 1995–2026 (Claridad + legacy + PDFs históricos)

## Stack

- **Frontend**: Next.js 15 + React 19 (App Router)
- **DB**: Neon (Postgres)
- **Visualización**: Recharts Sankey
- **Runtime**: Bun
- **Linting**: Biome
- **Scraping**: Firecrawl

## Fuentes de datos

| Fuente | Cobertura | Estado |
|--------|-----------|--------|
| Legacy ONPE Verificación | 1995–2021 | Pendiente |
| Legacy ONPE Aportes Limpios | 2005–2018 | Pendiente |
| PDFs históricos | 2011–2017 | Pendiente |
| Claridad ONPE | 2018–2026 | Pendiente (CAPTCHA) |

## Setup

```bash
# Instalar dependencias
bun install

# Configurar variables de entorno
cp apps/web/.env.example apps/web/.env.local
# Editar .env.local con DATABASE_URL y FIRECRAWL_API_KEY

# Correr migración
bun db:migrate

# Iniciar dev
bun dev
```

## Scripts de scraping

```bash
# Probar si Claridad tiene API REST subyacente
bun probe-claridad

# Scraper legacy ONPE (sin CAPTCHA, 1995-2021)
bun scrape-legacy --year 2020 --type partido

# Parse PDFs históricos
bun parse-pdfs

# Scraper Claridad 2018-2026 (con Firecrawl agent)
bun scrape-claridad --year 2024

# Deduplicar donantes con Claude Haiku
bun entity-resolution
```

## Licencia

AGPL-3.0 — cualquier institución que use este código debe open-sourcear sus modificaciones.

---

Proyecto de [Crafter Station](https://crafterstation.com). Civic tech para Perú.
