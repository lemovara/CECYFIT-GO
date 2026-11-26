alter table public.extra_meal_logs add column revision integer not null default 0 check (revision >= 0);
grant update(name,portion,kcal) on public.extra_meal_logs to authenticated;
create policy extra_meal_logs_update_own on public.extra_meal_logs for update to authenticated
  using (patient_user_id=(select auth.uid()) and exists (
    select 1 from public.patients p join public.profiles v on v.id=p.patient_user_id
    where p.id=extra_meal_logs.patient_id and p.patient_user_id=(select auth.uid()) and p.status='ACTIVE' and v.role='PACIENTE'))
  with check (patient_user_id=(select auth.uid()) and exists (
    select 1 from public.patients p join public.profiles v on v.id=p.patient_user_id
    where p.id=extra_meal_logs.patient_id and p.patient_user_id=(select auth.uid()) and p.status='ACTIVE' and v.role='PACIENTE'));

-- A manual correction cannot retain nutrient values calculated for an older quantity.
create function public.prepare_extra_meal_correction() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  new.revision := old.revision + 1;
  new.nutrition_snapshot := null;
  return new;
end;
$$;
revoke all on function public.prepare_extra_meal_correction() from public,anon,authenticated;
create trigger prepare_extra_meal_correction before update on public.extra_meal_logs
  for each row execute function public.prepare_extra_meal_correction();

create function public.correct_extra_food(p_patient_id uuid,p_id uuid,p_expected_revision integer,p_name text,p_portion text,p_kcal integer)
returns integer language plpgsql security invoker set search_path='' as $$
declare new_revision integer;
begin
  if p_patient_id is null or p_id is null or p_expected_revision is null or p_expected_revision < 0
    or char_length(btrim(coalesce(p_name,''),E' \t\r\n')) not between 1 and 120
    or char_length(btrim(coalesce(p_portion,''),E' \t\r\n')) not between 1 and 120
    or (p_kcal is not null and p_kcal not between 0 and 10000) then
    raise exception using errcode='22023',message='Datos de consumo inválidos';
  end if;
  update public.extra_meal_logs set name=btrim(p_name,E' \t\r\n'),portion=btrim(p_portion,E' \t\r\n'),kcal=p_kcal
    where patient_id=p_patient_id and patient_user_id=auth.uid() and id=p_id and revision=p_expected_revision
    returning revision into new_revision;
  if new_revision is null then raise exception using errcode='40001',message='El registro cambió o ya no está disponible'; end if;
  return new_revision;
end;
$$;
revoke all on function public.correct_extra_food(uuid,uuid,integer,text,text,integer) from public,anon,authenticated;
grant execute on function public.correct_extra_food(uuid,uuid,integer,text,text,integer) to authenticated;
