create table public.patient_workouts (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  activity_date date not null check (isfinite(activity_date)),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  exercises jsonb not null check (jsonb_typeof(exercises) = 'array' and jsonb_array_length(exercises) between 1 and 30),
  created_at timestamptz not null default now()
);
create index patient_workouts_date_idx on public.patient_workouts (patient_id, activity_date);
alter table public.patient_workouts enable row level security;
revoke all on public.patient_workouts from public, anon, authenticated;
grant select on public.patient_workouts to authenticated;
grant insert (patient_id,activity_date,title,exercises) on public.patient_workouts to authenticated;
create policy workouts_read on public.patient_workouts for select to authenticated
  using (exists (select 1 from public.patients p where p.id=patient_workouts.patient_id));
create policy workouts_create on public.patient_workouts for insert to authenticated
  with check (exists (
    select 1 from public.patients p join public.profiles viewer on viewer.id=p.professional_id
    where p.id=patient_workouts.patient_id and p.professional_id=(select auth.uid())
      and p.status='ACTIVE' and viewer.role='PROFESIONAL'
  ));

create table public.workout_logs (
  workout_id uuid not null references public.patient_workouts(id) on delete cascade,
  patient_user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  status text not null check (status in ('PAUSED','COMPLETED','INTERRUPTED')),
  exercise_index integer not null default 0 check (exercise_index between 0 and 30),
  updated_at timestamptz not null default now(),
  primary key (workout_id,patient_user_id)
);
alter table public.workout_logs enable row level security;
revoke all on public.workout_logs from public, anon, authenticated;
grant select on public.workout_logs to authenticated;
grant insert (workout_id,status,exercise_index), update (status,exercise_index,updated_at) on public.workout_logs to authenticated;
create policy workout_logs_read on public.workout_logs for select to authenticated
  using (exists (select 1 from public.patient_workouts w join public.patients p on p.id=w.patient_id
    where w.id=workout_logs.workout_id and
      (p.professional_id=(select auth.uid()) or workout_logs.patient_user_id=(select auth.uid()))));
create policy workout_logs_insert on public.workout_logs for insert to authenticated
  with check (patient_user_id=(select auth.uid()) and exists (
    select 1 from public.patient_workouts w join public.patients p on p.id=w.patient_id
    join public.profiles viewer on viewer.id=p.patient_user_id
    where w.id=workout_logs.workout_id and p.patient_user_id=(select auth.uid())
      and p.status='ACTIVE' and viewer.role='PACIENTE'
      and w.activity_date <= (now() at time zone 'America/Mexico_City')::date
      and workout_logs.exercise_index <= jsonb_array_length(w.exercises)
  ));
create policy workout_logs_update on public.workout_logs for update to authenticated
  using (patient_user_id=(select auth.uid()) and exists (
    select 1 from public.patient_workouts w join public.patients p on p.id=w.patient_id
    where w.id=workout_logs.workout_id and p.patient_user_id=(select auth.uid()) and p.status='ACTIVE'
  ))
  with check (patient_user_id=(select auth.uid()) and exists (
    select 1 from public.patient_workouts w join public.patients p on p.id=w.patient_id
    join public.profiles viewer on viewer.id=p.patient_user_id
    where w.id=workout_logs.workout_id and p.patient_user_id=(select auth.uid())
      and p.status='ACTIVE' and viewer.role='PACIENTE'
      and w.activity_date <= (now() at time zone 'America/Mexico_City')::date
      and workout_logs.exercise_index <= jsonb_array_length(w.exercises)
  ));

create function public.record_workout(p_workout_id uuid,p_status text,p_exercise_index integer)
returns void language sql security invoker set search_path='' as $$
  insert into public.workout_logs(workout_id,status,exercise_index)
    values(p_workout_id,p_status,p_exercise_index)
  on conflict(workout_id,patient_user_id) do update
    set status=excluded.status,exercise_index=excluded.exercise_index,updated_at=now();
$$;
revoke all on function public.record_workout(uuid,text,integer) from public, anon, authenticated;
grant execute on function public.record_workout(uuid,text,integer) to authenticated;
