#!/bin/sh
set -e

# spusti migrácie (len ak je definované DATABASE_URL)
if [ -n "$DATABASE_URL" ]; then
  echo "Running prisma migrate deploy..."
  npx prisma migrate deploy || true
fi

exec "$@"
