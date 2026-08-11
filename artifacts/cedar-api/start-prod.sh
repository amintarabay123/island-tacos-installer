#!/bin/sh
# Production startup: use Replit's injected DATABASE_URL directly.
# (The "cedarcafe" DB name swap is only needed in local dev where the dev
#  Postgres is shared; the production managed Postgres already has its own DB.)
exec node --enable-source-maps artifacts/cedar-api/dist/index.mjs
