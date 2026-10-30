#!/bin/sh
# Rebuild the local test database from scratch and apply every migration in order.
cd "$(dirname "$0")/../.."
su postgres -c "psql -q -c 'drop database if exists en' -c 'create database en'" 2>/dev/null
su postgres -c "psql -q -v ON_ERROR_STOP=1 -d en -f $PWD/tests/local/mock_supabase.sql" || exit 1
for f in migrations/*.sql; do
  echo "== $f"; su postgres -c "psql -q -v ON_ERROR_STOP=1 -d en -f $PWD/$f" 2>&1 | grep -v NOTICE || true
done
