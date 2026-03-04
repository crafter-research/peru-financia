# peru-financia

Herramienta open-source para visualizar y explorar el financiamiento político en el Perú. Consulta quién dona, cuánto, a qué partido y en qué proceso electoral — de forma clara y accesible para cualquier ciudadano.

**Datos**: ONPE Claridad 2018–2025 (12,956 aportantes)

## Qué puedes hacer

- Ver el flujo de dinero hacia los partidos con diagramas Sankey por proceso electoral
- Explorar el ranking de partidos por monto recibido
- Consultar el perfil de cualquier donante: total donado, a cuántos partidos, historial completo
- Buscar partidos y donantes por nombre o RUC/DNI
- Ver tendencias históricas de financiamiento por partido
- Descargar los datos en CSV

## Rutas

| Ruta | Descripción |
|------|-------------|
| `/` | Sankey + tabla + ranking por proceso electoral |
| `/donante` | Índice de donantes con métricas y distribución |
| `/donante/[ruc]` | Perfil individual de un donante |
| `/partido/[slug]` | Perfil de partido con tendencia histórica |

## Stack

- **Frontend**: Next.js 16 + React 19 (App Router, Server Components)
- **DB**: Neon (Postgres)
- **Visualización**: d3-sankey + Recharts
- **Runtime**: Bun
- **Linting**: Biome

## Fuentes de datos

| Fuente | Cobertura | Estado |
|--------|-----------|--------|
| Claridad ONPE | 2018–2025 | Activo |
| Legacy ONPE | 1995–2021 | Pendiente |
| PDFs históricos | 2011–2017 | Pendiente |

## Setup

```bash
bun install

cp apps/web/.env.example apps/web/.env.local
# Agregar DATABASE_URL

bun db:migrate
bun dev
```

## Licencia

AGPL-3.0 — cualquier institución que use este código debe open-sourcear sus modificaciones.

---

Proyecto de [Crafter Station](https://crafterstation.com). Civic tech para Perú.
