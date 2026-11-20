create table public.extra_meal_logs (
  id uuid not null,
  patient_id uuid not null references public.patients(id) on delete cascade,
  patient_user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  meal_date date not null check (isfinite(meal_date)),
  name text not null check (char_length(btrim(name, E' \t\r\n')) between 1 and 120),
  portion text not null check (char_length(btrim(portion, E' \t\r\n')) between 1 and 120),
  kcal integer check (kcal between 0 and 10000),
  created_at timestamptz not null default now(),
  primary key (patient_user_id, id)
);

create index extra_meal_logs_patient_date_idx
  on public.extra_meal_logs (patient_id, meal_date, created_at desc);

alter table public.extra_meal_logs enable row level security;
revoke all on public.extra_meal_logs from public, anon, authenticated;
grant select on public.extra_meal_logs to authenticated;
grant insert (id, patient_id, meal_date, name, portion, kcal) on public.extra_meal_logs to authenticated;

create policy extra_meal_logs_select_linked
  on public.extra_meal_logs for select to authenticated
  using (exists (
    select 1 from public.patients p
    where p.id = extra_meal_logs.patient_id and (
      p.professional_id = (select auth.uid()) or (
        p.patient_user_id = (select auth.uid()) and p.status = 'ACTIVE'
        and extra_meal_logs.patient_user_id = (select auth.uid())
      )
    )
  ));

create policy extra_meal_logs_insert_patient
  on public.extra_meal_logs for insert to authenticated
  with check (
    patient_user_id = (select auth.uid())
    and meal_date <= (now() at time zone 'America/Mexico_City')::date
    and exists (
      select 1 from public.patients p join public.profiles pr on pr.id = p.patient_user_id
      where p.id = extra_meal_logs.patient_id and p.patient_user_id = (select auth.uid())
        and p.status = 'ACTIVE' and pr.role = 'PACIENTE'
    )
  );

create function public.record_extra_meal(
  p_request_id uuid,
  p_patient_id uuid,
  p_meal_date date,
  p_name text,
  p_portion text,
  p_kcal integer default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  log_id uuid;
  meal_name text := btrim(coalesce(p_name, ''), E' \t\r\n');
  meal_portion text := btrim(coalesce(p_portion, ''), E' \t\r\n');
begin
  if p_request_id is null or p_patient_id is null or p_meal_date is null or not isfinite(p_meal_date)
    or p_meal_date > (now() at time zone 'America/Mexico_City')::date
    or char_length(meal_name) not between 1 and 120
    or char_length(meal_portion) not between 1 and 120
    or p_kcal not between 0 and 10000 then
    raise exception using errcode = '22023', message = 'Datos de consumo inválidos';
  end if;

  insert into public.extra_meal_logs (id, patient_id, meal_date, name, portion, kcal)
  values (p_request_id, p_patient_id, p_meal_date, meal_name, meal_portion, p_kcal)
  on conflict (patient_user_id, id) do nothing
  returning id into log_id;

  if log_id is null then
    select id into log_id from public.extra_meal_logs
    where id = p_request_id and patient_user_id = auth.uid() and patient_id = p_patient_id
      and meal_date = p_meal_date and name = meal_name and portion = meal_portion
      and kcal is not distinct from p_kcal;
    if not found then
      raise exception using errcode = '23505', message = 'El registro ya fue utilizado para otros datos';
    end if;
  end if;
  return log_id;
end;
$$;

revoke all on function public.record_extra_meal(uuid, uuid, date, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.record_extra_meal(uuid, uuid, date, text, text, integer)
  to authenticated;
