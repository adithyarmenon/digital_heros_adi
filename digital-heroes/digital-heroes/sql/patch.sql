-- Run this ONLY if you already executed the earlier combined schema script in chat.
-- It fixes one gap: users could SELECT their own subscription but not INSERT/UPDATE it,
-- which the simulated checkout needs to do directly from the browser.

drop policy if exists own_subs on subscriptions;
create policy own_subs on subscriptions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Also confirms the storage bucket + policies exist (safe to re-run, no-ops if already there)
insert into storage.buckets (id, name, public) values ('proofs','proofs',false) on conflict do nothing;

drop policy if exists proof_upload on storage.objects;
create policy proof_upload on storage.objects for insert to authenticated
  with check (bucket_id='proofs' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists proof_read on storage.objects;
create policy proof_read on storage.objects for select to authenticated
  using (bucket_id='proofs' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
