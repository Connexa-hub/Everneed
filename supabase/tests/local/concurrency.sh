#!/bin/sh
# True parallel checkout race: N buyers, 1 unit in stock. Exactly one must win, stock must end at 0.
DB=${1:-en2}; N=${2:-12}
run() { su postgres -c "psql -q -d $DB -c \"$1\"" 2>&1; }
run "insert into auth.users(id,email,aud,role) select gen_random_uuid(),'race'||g||'@t.local','authenticated','authenticated' from generate_series(1,$N) g on conflict do nothing"
run "insert into public.products(id,name,col,price,stock,status,store_id) values ('race-p','Last Unit','Race',1000,1,'published','everneed-official') on conflict (id) do update set stock=1"
run "delete from public.orders where cust->>'tag'='race'" >/dev/null
for i in $(seq 1 $N); do
  uid=$(su postgres -c "psql -q -t -d $DB -c \"select id from auth.users where email='race$i@t.local' limit 1\"" | tr -d ' ')
  cat > /tmp/race_$i.sql <<EOF
set role service_role;
select 'WIN' from public.create_order('$uid', '[{"id":"race-p","size":"","qty":1}]'::jsonb, 'NG','bank','{"tag":"race"}'::jsonb, 1,'NGN',0,null,0,null);
EOF
done
for i in $(seq 1 $N); do
  ( su postgres -c "psql -q -t -d $DB -f /tmp/race_$i.sql 2>&1" | grep -c '^ *WIN *$' > /tmp/race_$i.out ) &
done
wait
wins=$(cat /tmp/race_*.out | paste -sd+ | bc)
stock=$(su postgres -c "psql -q -t -d $DB -c \"select stock from public.products where id='race-p'\"" | tr -d ' ')
orders=$(su postgres -c "psql -q -t -d $DB -c \"select count(*) from public.orders where cust->>'tag'='race'\"" | tr -d ' ')
echo "buyers=$N winners=$wins orders_created=$orders stock_left=$stock"
[ "$wins" = "1" ] && [ "$orders" = "1" ] && [ "$stock" = "0" ] && echo "PASS: exactly one buyer got the last unit" || { echo "FAIL"; exit 1; }
