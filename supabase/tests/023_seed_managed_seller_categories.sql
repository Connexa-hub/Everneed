-- 023 managed category catalogue checks.
begin;
select ok((select count(*)>=20 from public.collections),'seller catalogue has at least twenty managed categories');
select ok((select count(*)=count(distinct name) from public.collections),'category names are unique');
select ok((select count(*)=0 from public.collections where name='' or icon is null or icon=''),'seeded categories have names and icons');
rollback;
