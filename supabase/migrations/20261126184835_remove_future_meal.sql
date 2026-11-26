-- Remove only a future assignment that has not acquired patient history.
-- No table DELETE privilege is granted to API clients.
create function nutrition_internal.remove_future_meal(p_patient_id uuid, p_meal_id uuid, p_revision integer)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  target uuid;
begin
  if actor is null or p_patient_id is null or p_meal_id is null or p_revision is null or p_revision < 0 then
    raise exception using errcode = '22023', message = 'Datos de comida inválidos';
  end if;
  select m.id into target
  from public.patient_meals m
  join public.patients p on p.id = m.patient_id
  join public.profiles pr on pr.id = p.professional_id and pr.role = 'PROFESIONAL'
  where m.id = p_meal_id and m.patient_id = p_patient_id and m.revision = p_revision
    and m.meal_date > (now() at time zone 'America/Mexico_City')::date
    and p.professional_id = actor and p.status = 'ACTIVE'
  for update of m for share of p;
  if not found then
    raise exception using errcode = 'P0002', message = 'Comida modificada o no disponible';
  end if;
  if exists (select 1 from public.meal_logs where meal_id = target)
    or exists (select 1 from nutrition_internal.meal_status_operations where meal_id = target) then
    raise exception using errcode = '23514', message = 'La comida tiene historial y no puede eliminarse';
  end if;
  delete from public.patient_meals where id = target;
  return target;
end;
$$;
revoke all on function nutrition_internal.remove_future_meal(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function nutrition_internal.remove_future_meal(uuid, uuid, integer) to authenticated;

create function public.remove_future_meal(p_patient_id uuid, p_meal_id uuid, p_revision integer)
returns uuid language sql security invoker set search_path = '' as $$
  select nutrition_internal.remove_future_meal(p_patient_id, p_meal_id, p_revision);
$$;
revoke all on function public.remove_future_meal(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.remove_future_meal(uuid, uuid, integer) to authenticated;
