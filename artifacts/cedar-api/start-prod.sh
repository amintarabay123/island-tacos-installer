#!/bin/sh
# Production startup: take Replit's injected DATABASE_URL and swap the database
# name to "cedarcafe", preserving any query string (e.g. sslmode=require).
BASE="${DATABASE_URL%%\?*}"       # everything before the first '?'
QUERY="${DATABASE_URL#*\?}"       # everything after the first '?'
BASE_NO_DB="${BASE%/*}"           # strip the database name path segment

if [ "$QUERY" = "$DATABASE_URL" ]; then
  # No query string present
  export DATABASE_URL="${BASE_NO_DB}/cedarcafe"
else
  export DATABASE_URL="${BASE_NO_DB}/cedarcafe?${QUERY}"
fi

exec node --enable-source-maps artifacts/cedar-api/dist/index.mjs
