create table public.patient_habits (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 500),
  goal text not null default '' check (char_length(goal) <= 120),
  weekdays smallint[] not null check (cardinality(weekdays) between 1 and 7 and weekdays <@ array[1,2,3,4,5,6,7]::smallint[] and array_position(weekdays,null) is null),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index patient_habits_patient_idx on public.patient_habits(patient_id,active,created_at desc);
alter table public.patient_habits enable row level security;
revoke all on public.patient_habits from public,anon,authenticated;
grant select on public.patient_habits to authenticated;
grant insert(patient_id,title,description,goal,weekdays), update(active) on public.patient_habits to authenticated;
create policy habits_read on public.patient_habits for select to authenticated
  using (exists (select 1 from public.patients p where p.id=patient_habits.patient_id));
create policy habits_create on public.patient_habits for insert to authenticated
  with check (exists (select 1 from public.patients p join public.profiles v on v.id=p.professional_id
    where p.id=patient_habits.patient_id and p.professional_id=(select auth.uid()) and p.status='ACTIVE' and v.role='PROFESIONAL'));
create policy habits_update on public.patient_habits for update to authenticated
  using (exists (select 1 from public.patients p join public.profiles v on v.id=p.professional_id
    where p.id=patient_habits.patient_id and p.professional_id=(select auth.uid()) and p.status='ACTIVE' and v.role='PROFESIONAL'))
  with check (exists (select 1 from public.patients p join public.profiles v on v.id=p.professional_id
    where p.id=patient_habits.patient_id and p.professional_id=(select auth.uid()) and p.status='ACTIVE' and v.role='PROFESIONAL'));

create table public.habit_logs (
  habit_id uuid not null references public.patient_habits(id) on delete cascade,
  patient_user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  log_date date not null check (isfinite(log_date)),
  completed boolean not null,
  updated_at timestamptz not null default now(),
  primary key(habit_id,patient_user_id,log_date)
);
create index habit_logs_date_idx on public.habit_logs(patient_user_id,log_date desc);
alter table public.habit_logs enable row level security;
revoke all on public.habit_logs from public,anon,authenticated;
grant select on public.habit_logs to authenticated;
grant insert(habit_id,log_date,completed), update(completed,updated_at) on public.habit_logs to authenticated;
create policy habit_logs_read on public.habit_logs for select to authenticated
  using (exists (select 1 from public.patient_habits h join public.patients p on p.id=h.patient_id
    where h.id=habit_logs.habit_id and (p.professional_id=(select auth.uid()) or (p.patient_user_id=(select auth.uid()) and habit_logs.patient_user_id=(select auth.uid())))));
create policy habit_logs_insert on public.habit_logs for insert to authenticated
  with check (patient_user_id=(select auth.uid()) and exists (
    select 1 from public.patient_habits h join public.patients p on p.id=h.patient_id join public.profiles v on v.id=p.patient_user_id
    where h.id=habit_logs.habit_id and h.active and p.status='ACTIVE' and p.patient_user_id=(select auth.uid()) and v.role='PACIENTE'
      and log_date between (h.created_at at time zone 'America/Mexico_City')::date and (now() at time zone 'America/Mexico_City')::date
      and extract(isodow from log_date)::smallint=any(h.weekdays)));
create policy habit_logs_update on public.habit_logs for update to authenticated
  using (patient_user_id=(select auth.uid()) and exists (
    select 1 from public.patient_habits h join public.patients p on p.id=h.patient_id
    where h.id=habit_logs.habit_id and h.active and p.status='ACTIVE' and p.patient_user_id=(select auth.uid())))
  with check (patient_user_id=(select auth.uid()) and exists (
    select 1 from public.patient_habits h join public.patients p on p.id=h.patient_id join public.profiles v on v.id=p.patient_user_id
    where h.id=habit_logs.habit_id and h.active and p.status='ACTIVE' and p.patient_user_id=(select auth.uid()) and v.role='PACIENTE'
      and log_date between (h.created_at at time zone 'America/Mexico_City')::date and (now() at time zone 'America/Mexico_City')::date
      and extract(isodow from log_date)::smallint=any(h.weekdays)));
create function public.record_habit(p_habit_id uuid,p_date date,p_completed boolean)
returns void language sql security invoker set search_path='' as $$
  insert into public.habit_logs(habit_id,log_date,completed) values(p_habit_id,p_date,p_completed)
  on conflict(habit_id,patient_user_id,log_date) do update set completed=excluded.completed,updated_at=now();
$$;
revoke all on function public.record_habit(uuid,date,boolean) from public,anon,authenticated;
grant execute on function public.record_habit(uuid,date,boolean) to authenticated;
