begin;
do $test$
declare patient uuid; professional uuid; actor uuid; other uuid := gen_random_uuid(); meal uuid; request uuid := gen_random_uuid();
  first jsonb; answer jsonb; stamp timestamptz; denied boolean;
begin
  select p.id,p.professional_id,p.patient_user_id into patient,professional,actor from public.patients p
    join public.profiles pr on pr.id=p.professional_id and pr.role='PROFESIONAL'
    where p.status='ACTIVE' and p.patient_user_id is not null limit 1;
  if patient is null then raise exception 'A linked patient is needed'; end if;
  insert into auth.users(id) values(other);
  perform set_config('request.jwt.claim.sub',professional::text,true);
  execute 'set local role authenticated';
  insert into public.patient_meals(patient_id,meal_date,scheduled_time,name) values(patient,date '1901-01-01',time '00:13','Prueba temporal') returning id into meal;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  first := public.record_meal_status_conditional(request,meal,'CONSUMED',0,null);
  if first->>'result' <> 'applied' or first->>'replayed' <> 'false' then raise exception 'Initial operation failed'; end if;
  answer := public.record_meal_status_conditional(request,meal,'CONSUMED',0,null);
  if answer->>'replayed' <> 'true' then raise exception 'Retry not idempotent'; end if;
  answer := public.record_meal_status_conditional(gen_random_uuid(),meal,'SKIPPED',0,null);
  if answer->>'reason' <> 'status_changed' then raise exception 'Stale status not detected'; end if;
  perform public.record_meal_status(meal,'SKIPPED');
  answer := public.record_meal_status_conditional(request,meal,'CONSUMED',0,null);
  if answer->>'status' <> 'SKIPPED' or answer->>'replayed' <> 'true' then raise exception 'Retry overwrote newer status'; end if;
  select logged_at into stamp from public.meal_logs where meal_id=meal and patient_user_id=actor;
  answer := public.record_meal_status_conditional(gen_random_uuid(),meal,'CONSUMED',0,stamp);
  if answer->>'result' <> 'applied' then raise exception 'Current version could not be recorded'; end if;
  execute 'reset role';
  update public.patient_meals set notes='Plan cambiado' where id=meal;
  execute 'set local role authenticated';
  select logged_at into stamp from public.meal_logs where meal_id=meal and patient_user_id=actor;
  answer := public.record_meal_status_conditional(gen_random_uuid(),meal,'SKIPPED',0,stamp);
  if answer->>'reason' <> 'plan_changed' then raise exception 'Stale plan not detected'; end if;
  denied:=false;
  begin perform 1 from nutrition_internal.meal_status_operations limit 1; exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Direct operation access allowed'; end if;
  perform set_config('request.jwt.claim.sub',other::text,true);
  denied:=false;
  begin perform public.record_meal_status_conditional(gen_random_uuid(),meal,'CONSUMED',0,null);
  exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Unlinked user accepted'; end if;
end $test$;
rollback;
