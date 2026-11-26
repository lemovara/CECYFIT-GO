create table public.patient_messages (
 id uuid primary key default gen_random_uuid(),
 patient_id uuid not null references public.patients(id) on delete cascade,
 sender_id uuid not null default auth.uid() references public.profiles(id),
 body text not null check (char_length(btrim(body)) between 1 and 2000),
 created_at timestamptz not null default now()
);
create index patient_messages_patient_date_idx on public.patient_messages(patient_id, created_at desc);
alter table public.patient_messages enable row level security;
revoke all on public.patient_messages from public, anon, authenticated;
grant select on public.patient_messages to authenticated;
grant insert(patient_id,body) on public.patient_messages to authenticated;
create policy patient_messages_read on public.patient_messages for select to authenticated using (
 exists(select 1 from public.patients p where p.id=patient_messages.patient_id and p.status='ACTIVE' and p.patient_user_id is not null and ((select auth.uid())=p.patient_user_id or (select auth.uid())=p.professional_id))
);
create policy patient_messages_send on public.patient_messages for insert to authenticated with check (
 sender_id=(select auth.uid()) and exists(select 1 from public.patients p where p.id=patient_messages.patient_id and p.status='ACTIVE' and p.patient_user_id is not null and ((select auth.uid())=p.patient_user_id or (select auth.uid())=p.professional_id))
);
