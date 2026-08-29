#!/usr/bin/env bash
# Vercel-Build: Migrationen robust ausführen, dann Next.js bauen.
#
# - Migrationen laufen über die UNGEPOOLTE Datenbank-URL, falls vorhanden
#   (Advisory-Locks können am Connection-Pooler hängenbleiben → P1002).
# - Ist das Schema bereits aktuell, wird der Migrationsschritt übersprungen
#   (prisma migrate status nimmt keinen Advisory-Lock).
# - Bei P1002-Flakes wird die Migration nach 20 s einmal wiederholt.
set -e

MIGRATE_URL="${DIRECT_DATABASE_URL:-${POSTGRES_URL_NON_POOLING:-${DATABASE_URL_UNPOOLED:-$DATABASE_URL}}}"

if DATABASE_URL="$MIGRATE_URL" npx prisma migrate status 2>&1 | grep -q "up to date"; then
  echo "Migrationen aktuell – Migrationsschritt übersprungen."
else
  echo "Wende Migrationen an…"
  DATABASE_URL="$MIGRATE_URL" npx prisma migrate deploy || {
    echo "Migration fehlgeschlagen – zweiter Versuch in 20 s…"
    sleep 20
    DATABASE_URL="$MIGRATE_URL" npx prisma migrate deploy
  }
fi

npx next build
