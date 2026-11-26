alter table public.patient_care_profiles
  add column water_goal_ml integer check (water_goal_ml between 1 and 20000);
grant update (water_goal_ml) on public.patient_care_profiles to authenticated;

create table public.hydration_logs (
  id uuid not null,
  patient_id uuid not null references public.patients(id) on delete cascade,
  patient_user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  log_date date not null check (isfinite(log_date)),
  amount_ml integer not null check (amount_ml between 1 and 5000),
  created_at timestamptz not null default now(),
  primary key (patient_user_id, id)
);
create index hydration_logs_patient_date_idx on public.hydration_logs (patient_id, log_date, created_at desc);
alter table public.hydration_logs enable row level security;
revoke all on public.hydration_logs from public, anon, authenticated;
grant select, insert (id, patient_id, log_date, amount_ml) on public.hydration_logs to authenticated;

create policy hydration_logs_select_linked on public.hydration_logs for select to authenticated
  using (exists (
    select 1 from public.patients p join public.profiles viewer on viewer.id = (select auth.uid())
    where p.id = hydration_logs.patient_id and (
      (viewer.role = 'PROFESIONAL' and p.professional_id = viewer.id) or
      (viewer.role = 'PACIENTE' and p.status = 'ACTIVE' and p.patient_user_id = viewer.id
        and hydration_logs.patient_user_id = viewer.id)
    )
  ));
create policy hydration_logs_insert_patient on public.hydration_logs for insert to authenticated
  with check (
    hydration_logs.patient_user_id = (select auth.uid())
    and hydration_logs.log_date <= (now() at time zone 'America/Mexico_City')::date
    and exists (
      select 1 from public.patients p join public.profiles viewer on viewer.id = (select auth.uid())
      where p.id = hydration_logs.patient_id and p.patient_user_id = viewer.id
        and p.status = 'ACTIVE' and viewer.role = 'PACIENTE'
    )
  );

create function public.record_hydration(p_request_id uuid, p_patient_id uuid, p_day date, p_amount_ml integer)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare saved_id uuid;
begin
  if p_request_id is null or p_patient_id is null or p_day is null or not isfinite(p_day)
    or p_day > (now() at time zone 'America/Mexico_City')::date
    or p_amount_ml is null or p_amount_ml not between 1 and 5000 then
    raise exception using errcode = '22023', message = 'Datos de hidratación inválidos';
  end if;
  insert into public.hydration_logs (id, patient_id, log_date, amount_ml)
    values (p_request_id, p_patient_id, p_day, p_amount_ml)
    on conflict (patient_user_id, id) do nothing returning id into saved_id;
  if saved_id is null then
    select id into saved_id from public.hydration_logs
      where patient_user_id = auth.uid() and id = p_request_id and patient_id = p_patient_id
        and log_date = p_day and amount_ml = p_amount_ml;
    if not found then
      raise exception using errcode = '23505', message = 'El identificador ya corresponde a otro registro';
    end if;
  end if;
  return saved_id;
end;
$$;
revoke all on function public.record_hydration(uuid,uuid,date,integer) from public, anon, authenticated;
grant execute on function public.record_hydration(uuid,uuid,date,integer) to authenticated;
