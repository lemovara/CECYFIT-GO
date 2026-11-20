-- Assign a meal using the same ownership and active-patient rules as the table.
create function public.assign_patient_meal(
  p_patient_id uuid,
  p_meal_date date,
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
  new_id uuid;
  meal_name text := btrim(coalesce(p_name, ''), E' \t\r\n');
  ingredients_text text := btrim(coalesce(p_ingredients, ''), E' \t\r\n');
  notes_text text := btrim(coalesce(p_notes, ''), E' \t\r\n');
begin
  if p_patient_id is null or p_meal_date is null or not isfinite(p_meal_date)
    or p_scheduled_time is null or p_scheduled_time >= time '24:00'
    or extract(second from p_scheduled_time) <> 0
    or char_length(meal_name) not between 1 and 120
    or char_length(ingredients_text) > 3000 or char_length(notes_text) > 3000
    or p_kcal not between 0 and 10000 then
    raise exception using errcode = '22023', message = 'Datos de comida inválidos';
  end if;

  insert into public.patient_meals (patient_id, meal_date, scheduled_time, name, ingredients, notes, kcal)
  values (p_patient_id, p_meal_date, p_scheduled_time, meal_name, ingredients_text, notes_text, p_kcal)
  returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.assign_patient_meal(uuid, date, time, text, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.assign_patient_meal(uuid, date, time, text, text, text, integer)
  to authenticated;
