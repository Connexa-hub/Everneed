-- 021: split public and authenticated policy reads so anonymous access never depends on admin RPC grants.
begin;
drop policy if exists "policy documents read" on public.policy_documents;
create policy "policy documents public read" on public.policy_documents
  for select to anon using (published and effective_at <= now());
create policy "policy documents signed-in read" on public.policy_documents
  for select to authenticated using ((published and effective_at <= now()) or public.is_admin());
commit;
