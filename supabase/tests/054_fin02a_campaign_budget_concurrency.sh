#!/usr/bin/env bash
set -euo pipefail
DB_URL="${1:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
OFFER_ID="$(cat /proc/sys/kernel/random/uuid)"
ORDER_A="$(cat /proc/sys/kernel/random/uuid)"
ORDER_B="$(cat /proc/sys/kernel/random/uuid)"
APPROVER="$(cat /proc/sys/kernel/random/uuid)"
TMP="$(mktemp -d)"
cleanup() {
  psql "$DB_URL" -v ON_ERROR_STOP=1 -c "delete from private.offer_budget_reservations where offer_id='$OFFER_ID'; delete from private.offer_campaign_budgets where offer_id='$OFFER_ID'; delete from public.offers where id='$OFFER_ID';" >/dev/null || true
  rm -rf "$TMP"
}
trap cleanup EXIT

psql "$DB_URL" -v ON_ERROR_STOP=1 -c "insert into public.offers(id,name,kind,value,scope,active) values('$OFFER_ID','Concurrent reservation CI fixture','fixed',1,'all',true); insert into private.offer_campaign_budgets(offer_id,currency,approved_budget_minor,reserved_minor,consumed_minor,approved_by,approval_note) values('$OFFER_ID','NGN',1000,0,0,'$APPROVER','CI concurrent reservation test');" >/dev/null

reserve() {
  local order="$1" output="$2"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -Atc "select private.reserve_offer_campaign_budget('$order','$OFFER_ID','NGN',600);" >"$output" 2>&1
}
set +e
reserve "$ORDER_A" "$TMP/a" &
PID_A=$!
reserve "$ORDER_B" "$TMP/b" &
PID_B=$!
wait "$PID_A"; RC_A=$?
wait "$PID_B"; RC_B=$?
set -e
SUCCESSES=$(( (RC_A==0) + (RC_B==0) ))
if [ "$SUCCESSES" -ne 1 ]; then
  echo "Expected exactly one concurrent 600-minor-unit reservation to succeed against a 1,000 budget."
  cat "$TMP/a" "$TMP/b"
  exit 1
fi
psql "$DB_URL" -v ON_ERROR_STOP=1 -Atc "select reserved_minor || ':' || (select count(*) from private.offer_budget_reservations where offer_id='$OFFER_ID' and status='reserved') from private.offer_campaign_budgets where offer_id='$OFFER_ID' and currency='NGN';" >"$TMP/state"
if [ "$(cat "$TMP/state")" != "600:1" ]; then
  echo "Concurrent reservation invariant failed: expected 600:1, got $(cat "$TMP/state")"
  cat "$TMP/a" "$TMP/b"
  exit 1
fi
echo "PASS: concurrent reservations serialized; exactly one hold (600 minor units) accepted."
