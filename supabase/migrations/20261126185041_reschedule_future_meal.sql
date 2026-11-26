-- Reschedule only a future assignment and preserve its immutable nutrition snapshot.
-- Client roles do not receive permission to update meal_date directly.
create function nutrition_internal.reschedule_future_meal(
  p_patient_id uuid, p_meal_id uuid, p_revision integer, p_day date, p_time time
) returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); target uuid;
begin
  if actor is null or p_patient_id is null or p_meal_id is null or p_revision is null or p_revision < 0
    or p_day is null or not isfinite(p_day) or p_day <= (now() at time zone 'America/Mexico_City')::date
    or p_time is null or p_time >= time '24:00' or extract(second from p_time) <> 0 then
    raise exception using errcode = '22023', message = 'Fecha u horario inválidos';
  end if;
  select m.id into target from public.patient_meals m
    join public.patients p on p.id = m.patient_id
    join public.profiles pr on pr.id = p.professional_id and pr.role = 'PROFESIONAL'
    where m.id = p_meal_id and m.patient_id = p_patient_id and m.revision = p_revision
      and m.meal_date > (now() at time zone 'America/Mexico_City')::date
      and p.professional_id = actor and p.status = 'ACTIVE'
    for update of m for share of p;
  if not found then raise exception using errcode = 'P0002', message = 'Comida modificada o no disponible'; end if;
  if exists (select 1 from public.meal_logs where meal_id = target)
    or exists (select 1 from nutrition_internal.meal_status_operations where meal_id = target) then
    raise exception using errcode = '23514', message = 'La comida tiene historial y no puede cambiarse de fecha';
  end if;
  update public.patient_meals set meal_date = p_day, scheduled_time = p_time where id = target;
  return target;
end;
$$;
revoke all on function nutrition_internal.reschedule_future_meal(uuid,uuid,integer,date,time) from public,anon,authenticated;
grant execute on function nutrition_internal.reschedule_future_meal(uuid,uuid,integer,date,time) to authenticated;

create function public.reschedule_future_meal(p_patient_id uuid,p_meal_id uuid,p_revision integer,p_day date,p_time time)
returns uuid language sql security invoker set search_path = '' as $$
  select nutrition_internal.reschedule_future_meal(p_patient_id,p_meal_id,p_revision,p_day,p_time);
$$;
revoke all on function public.reschedule_future_meal(uuid,uuid,integer,date,time) from public,anon,authenticated;
grant execute on function public.reschedule_future_meal(uuid,uuid,integer,date,time) to authenticated;
