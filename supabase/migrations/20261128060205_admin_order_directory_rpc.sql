-- Secure admin order directory API with search, filtering and pagination.
begin;

create or replace function public.admin_order_directory(
  p_search text default null,
  p_status text default null,
  p_payment_status text default null,
  p_payment_method text default null,
  p_page integer default 1,
  p_page_size integer default 25
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_search text := nullif(left(trim(coalesce(p_search, '')), 120), '');
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_size integer := least(greatest(coalesce(p_page_size, 25), 1), 100);
  v_total bigint;
  v_items jsonb;
begin
  perform private.need_admin();

  with filtered as (
    select
      o.id,
      o.status,
      o.payment_status,
      o.pm,
      o.total,
      o.currency,
      o.at,
      o.ref,
      o.user_id,
      coalesce(nullif(o.cust->>'name',''), p.name, 'Customer') as buyer_name,
      coalesce(nullif(o.cust->>'phone',''), p.phone) as buyer_phone,
      p.email as buyer_email,
      coalesce(so.seller_count, 0) as seller_count,
      coalesce(so.store_names, array[]::text[]) as store_names
    from public.orders o
    left join public.profiles p on p.id = o.user_id
    left join lateral (
      select count(distinct s.store_id)::integer seller_count,
             array_agg(distinct st.name order by st.name) filter (where st.name is not null) store_names
      from public.seller_orders s
      left join public.stores st on st.id = s.store_id
      where s.order_id = o.id
    ) so on true
    where (p_status is null or o.status = p_status)
      and (p_payment_status is null or o.payment_status = p_payment_status)
      and (p_payment_method is null or o.pm = p_payment_method)
      and (
        v_search is null
        or o.id ilike '%' || v_search || '%'
        or coalesce(o.ref,'') ilike '%' || v_search || '%'
        or coalesce(o.cust->>'name','') ilike '%' || v_search || '%'
        or coalesce(o.cust->>'phone','') ilike '%' || v_search || '%'
        or coalesce(p.name,'') ilike '%' || v_search || '%'
        or coalesce(p.phone,'') ilike '%' || v_search || '%'
        or coalesce(p.email,'') ilike '%' || v_search || '%'
        or exists (
          select 1 from public.seller_orders ss
          join public.stores stt on stt.id = ss.store_id
          where ss.order_id = o.id and stt.name ilike '%' || v_search || '%'
        )
      )
  ),
  counted as (
    select *, count(*) over() total_rows
    from filtered
    order by at desc, id desc
    offset (v_page - 1) * v_size
    limit v_size
  )
  select coalesce(max(total_rows), 0),
         coalesce(jsonb_agg(jsonb_build_object(
           'orderId', id,
           'status', status,
           'paymentStatus', payment_status,
           'paymentMethod', pm,
           'total', total,
           'currency', currency,
           'createdAt', at,
           'reference', ref,
           'buyer', jsonb_build_object('name', buyer_name, 'email', buyer_email, 'phone', buyer_phone),
           'sellerCount', seller_count,
           'stores', store_names
         ) order by at desc, id desc), '[]'::jsonb)
    into v_total, v_items
  from counted;

  return jsonb_build_object(
    'items', v_items,
    'total', v_total,
    'page', v_page,
    'pageSize', v_size,
    'hasMore', (v_page * v_size) < v_total
  );
end
$function$;

revoke all on function public.admin_order_directory(text,text,text,text,integer,integer) from public, anon;
grant execute on function public.admin_order_directory(text,text,text,text,integer,integer) to authenticated;

comment on function public.admin_order_directory(text,text,text,text,integer,integer)
is 'Admin-only searchable order directory. Uses private.need_admin, bounded page size and returns buyer contact summary/store names without raw order customer JSON.';

commit;
