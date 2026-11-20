alter table public.patient_meals add column revision integer not null default 0;

grant update (scheduled_time, name, ingredients, notes, kcal)
  on public.patient_meals to authenticated;

-- The RLS condition also applies when a caller accesses the table directly.
create policy patient_meals_update_future_professional
  on public.patient_meals for update to authenticated
  using (
    meal_date > (now() at time zone 'America/Mexico_City')::date
    and exists (
      select 1 from public.patients p join public.profiles pr
        on pr.id = p.professional_id and pr.role = 'PROFESIONAL'
      where p.id = patient_id and p.professional_id = (select auth.uid()) and p.status = 'ACTIVE'
    )
  );

create function private.prepare_patient_meal_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name := btrim(coalesce(new.name, ''), E' \t\r\n');
  new.ingredients := btrim(coalesce(new.ingredients, ''), E' \t\r\n');
  new.notes := btrim(coalesce(new.notes, ''), E' \t\r\n');

  if new.scheduled_time is null or new.scheduled_time >= time '24:00'
    or extract(second from new.scheduled_time) <> 0 then
    raise exception using errcode = '22023', message = 'Horario de comida inválido';
  end if;
  new.revision := old.revision + 1;
  return new;
end;
$$;

revoke execute on function private.prepare_patient_meal_update() from public, anon, authenticated;
create trigger prepare_patient_meal_update before update on public.patient_meals
  for each row execute function private.prepare_patient_meal_update();

create function public.update_patient_meal(
  p_patient_id uuid,
  p_meal_id uuid,
  p_revision integer,
  p_scheduled_time time without time zone,
  p_name text,
  p_ingredients text default '',
  p_notes text default '',
  p_kcal integer default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  meal_id uuid;
begin
  update public.patient_meals
    set scheduled_time = p_scheduled_time, name = p_name,
      ingredients = p_ingredients, notes = p_notes, kcal = p_kcal
    where id = p_meal_id and patient_id = p_patient_id and revision = p_revision
    returning id into meal_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'La comida ya no está disponible para esta edición';
  end if;
  return meal_id;
end;
$$;

create function public.copy_patient_meals(
  p_patient_id uuid,
  p_source_date date,
  p_target_date date
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  copied integer;
begin
  if p_patient_id is null or p_source_date is null or p_target_date is null
    or not isfinite(p_source_date) or not isfinite(p_target_date)
    or p_source_date = p_target_date
    or p_target_date <= (now() at time zone 'America/Mexico_City')::date then
    raise exception using errcode = '22023', message = 'Selecciona un día de origen distinto y un destino futuro';
  end if;

  if not exists (
    select 1 from public.patients p join public.profiles pr
      on pr.id = p.professional_id and pr.role = 'PROFESIONAL'
    where p.id = p_patient_id and p.professional_id = auth.uid() and p.status = 'ACTIVE'
  ) then
    raise exception using errcode = '42501', message = 'La ficha no está disponible';
  end if;

  insert into public.patient_meals (patient_id, meal_date, scheduled_time, name, ingredients, notes, kcal)
    select patient_id, p_target_date, scheduled_time, name, ingredients, notes, kcal
    from public.patient_meals
    where patient_id = p_patient_id and meal_date = p_source_date
    order by scheduled_time;
  get diagnostics copied = row_count;
  return copied;
end;
$$;

revoke all on function public.update_patient_meal(uuid, uuid, integer, time, text, text, text, integer),
  public.copy_patient_meals(uuid, date, date) from public, anon, authenticated;
grant execute on function public.update_patient_meal(uuid, uuid, integer, time, text, text, text, integer),
  public.copy_patient_meals(uuid, date, date) to authenticated;
