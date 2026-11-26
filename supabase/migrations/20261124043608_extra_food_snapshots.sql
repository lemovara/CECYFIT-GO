-- A snapshot reflects the information displayed to the patient at registration.
-- It is self-reported, not a clinical validation or a value recalculated later.
alter table public.extra_meal_logs add column nutrition_snapshot jsonb
  check (nutrition_snapshot is null or (jsonb_typeof(nutrition_snapshot) = 'object' and pg_column_size(nutrition_snapshot) <= 8192));
grant insert (nutrition_snapshot) on public.extra_meal_logs to authenticated;

create function public.record_extra_food(
  p_request_id uuid, p_patient_id uuid, p_meal_date date, p_name text,
  p_portion text, p_kcal integer, p_nutrition_snapshot jsonb
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  log_id uuid;
  meal_name text := btrim(coalesce(p_name, ''), E' \t\r\n');
  meal_portion text := btrim(coalesce(p_portion, ''), E' \t\r\n');
begin
  if p_request_id is null or p_patient_id is null or p_meal_date is null or not isfinite(p_meal_date)
    or p_meal_date > (now() at time zone 'America/Mexico_City')::date
    or char_length(meal_name) not between 1 and 120 or char_length(meal_portion) not between 1 and 120
    or p_kcal not between 0 and 10000 or p_nutrition_snapshot is null
    or jsonb_typeof(p_nutrition_snapshot) <> 'object' or pg_column_size(p_nutrition_snapshot) > 8192 then
    raise exception using errcode='22023', message='Datos de consumo inválidos';
  end if;
  insert into public.extra_meal_logs(id,patient_id,meal_date,name,portion,kcal,nutrition_snapshot)
    values(p_request_id,p_patient_id,p_meal_date,meal_name,meal_portion,p_kcal,p_nutrition_snapshot)
    on conflict (patient_user_id,id) do nothing returning id into log_id;
  if log_id is null then
    select id into log_id from public.extra_meal_logs
      where id=p_request_id and patient_user_id=auth.uid() and patient_id=p_patient_id
        and meal_date=p_meal_date and name=meal_name and portion=meal_portion
        and kcal is not distinct from p_kcal and nutrition_snapshot=p_nutrition_snapshot;
    if not found then raise exception using errcode='23505', message='El registro ya fue utilizado para otros datos'; end if;
  end if;
  return log_id;
end;
$$;
revoke all on function public.record_extra_food(uuid,uuid,date,text,text,integer,jsonb) from public,anon,authenticated;
grant execute on function public.record_extra_food(uuid,uuid,date,text,text,integer,jsonb) to authenticated;
