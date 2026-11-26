begin;
do $test$
declare
  patient uuid; professional uuid; actor uuid; other uuid := gen_random_uuid();
  item uuid := gen_random_uuid(); occupied uuid := gen_random_uuid(); with_history uuid := gen_random_uuid();
  future_day date := (now() at time zone 'America/Mexico_City')::date + 3640;
  today date := (now() at time zone 'America/Mexico_City')::date;
  snap jsonb := '{"kcal":200,"ingredients":[{"id":"test","grams":100}]}'::jsonb;
begin
  select p.id,p.professional_id,p.patient_user_id into patient,professional,actor from public.patients p
    join public.profiles pr on pr.id=p.professional_id and pr.role='PROFESIONAL'
    where p.status='ACTIVE' and p.patient_user_id is not null limit 1;
  if patient is null then raise exception 'A linked patient is needed'; end if;
  insert into public.patient_meals(id,patient_id,meal_date,scheduled_time,name,nutrition_snapshot) values
    (item,patient,future_day,'02:01','Prueba temporal',snap),
    (occupied,patient,future_day+1,'02:02','Horario ocupado',null),
    (with_history,patient,future_day,'02:03','Tiene historial',null);
  insert into public.meal_logs(meal_id,patient_user_id,status) values(with_history,actor,'CONSUMED');
  perform set_config('request.jwt.claim.sub',other::text,true); execute 'set local role authenticated';
  begin
    perform public.reschedule_future_meal(patient,item,0,future_day+1,'02:04');
    raise exception 'Other user could move meal';
  exception when no_data_found then null; end;
  perform set_config('request.jwt.claim.sub',professional::text,true);
  begin
    perform public.reschedule_future_meal(patient,item,1,future_day+1,'02:04');
    raise exception 'Stale revision accepted';
  exception when no_data_found then null; end;
  begin
    perform public.reschedule_future_meal(patient,item,0,today,'02:04');
    raise exception 'Current day accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.reschedule_future_meal(patient,with_history,0,future_day+1,'02:04');
    raise exception 'History moved';
  exception when check_violation then null; end;
  begin
    perform public.reschedule_future_meal(patient,item,0,future_day+1,'02:02');
    raise exception 'Overlapping time accepted';
  exception when unique_violation then null; end;
  perform public.reschedule_future_meal(patient,item,0,future_day+1,'02:04');
  if not exists (select 1 from public.patient_meals where id=item and meal_date=future_day+1
    and scheduled_time='02:04' and revision=1 and nutrition_snapshot=snap) then
    raise exception 'Move did not preserve snapshot or advance revision';
  end if;
end $test$;
rollback;
