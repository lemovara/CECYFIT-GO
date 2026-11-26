begin;
do $test$
declare
  patient uuid; professional uuid; actor uuid; other uuid := gen_random_uuid();
  future_meal uuid := gen_random_uuid(); history_meal uuid := gen_random_uuid(); past_meal uuid := gen_random_uuid();
  future_day date := (now() at time zone 'America/Mexico_City')::date + 3650;
  current_day date := (now() at time zone 'America/Mexico_City')::date;
begin
  select p.id,p.professional_id,p.patient_user_id into patient,professional,actor from public.patients p
    join public.profiles pr on pr.id=p.professional_id and pr.role='PROFESIONAL'
    where p.status='ACTIVE' and p.patient_user_id is not null limit 1;
  if patient is null then raise exception 'A linked patient is needed'; end if;
  insert into public.patient_meals(id,patient_id,meal_date,scheduled_time,name) values
    (future_meal,patient,future_day,'01:01','Prueba temporal'),
    (history_meal,patient,future_day,'01:02','Prueba con historial'),
    (past_meal,patient,current_day,'01:03','Prueba histórica');
  insert into public.meal_logs(meal_id,patient_user_id,status) values(history_meal,actor,'CONSUMED');
  perform set_config('request.jwt.claim.sub',other::text,true); execute 'set local role authenticated';
  begin
    perform public.remove_future_meal(patient,future_meal,0);
    raise exception 'Other user could delete';
  exception when no_data_found then null; end;
  perform set_config('request.jwt.claim.sub',professional::text,true);
  begin
    perform public.remove_future_meal(patient,future_meal,1);
    raise exception 'Stale revision accepted';
  exception when no_data_found then null; end;
  begin
    perform public.remove_future_meal(patient,past_meal,0);
    raise exception 'Current day deletion accepted';
  exception when no_data_found then null; end;
  begin
    perform public.remove_future_meal(patient,history_meal,0);
    raise exception 'Deletion with history accepted';
  exception when check_violation then null; end;
  if public.remove_future_meal(patient,future_meal,0) <> future_meal then raise exception 'Future deletion failed'; end if;
  if exists (select 1 from public.patient_meals where id=future_meal) then raise exception 'Future meal remains'; end if;
end $test$;
rollback;
