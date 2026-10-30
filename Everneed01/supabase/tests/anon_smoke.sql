-- Anonymous visitors must be able to read every public surface without permission errors (run after all migrations).
set role anon;
select 'banners', count(*) from public.banners;
select 'products', count(*) from public.products;
select 'public_products', count(*) from public.public_products;
select 'auto_offers', count(*) from public.auto_offers;
select 'settings NG', count(*) from public.settings where id='NG';
select 'collections', count(*) from public.collections;
select 'size_charts', count(*) from public.size_charts;
select 'reviews', count(*) from public.public_reviews;
