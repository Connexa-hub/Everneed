-- R25: globally unique normalized store display names.
-- Normalization: trim leading/trailing whitespace, collapse whitespace runs, and case-fold with lower().
-- Accents and punctuation are preserved intentionally. Existing owner/slug unique constraints remain.
begin;

do $check$
begin
  if exists (
    select 1 from public.stores
    group by lower(btrim(regexp_replace(name, '[[:space:]]+', ' ', 'g')))
    having count(*) > 1
  ) then
    raise exception 'Cannot add store-name uniqueness: existing normalized duplicates require owner-approved reconciliation.';
  end if;
end
$check$;

create unique index if not exists stores_name_normalized_key
  on public.stores (lower(btrim(regexp_replace(name, '[[:space:]]+', ' ', 'g'))));

commit;
