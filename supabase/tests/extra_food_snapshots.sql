-- Uses a linked test patient; all writes are rolled back.
begin;
do $test$
declare
  patient uuid; actor uuid; professional uuid; other_user uuid := gen_random_uuid();
  request uuid := gen_random_uuid(); manual_request uuid := gen_random_uuid(); returned uuid; saved jsonb; count_rows integer; denied boolean;
  snapshot jsonb := '{"version":1,"food_id":"avena","food_name":"Avena seca","grams":50,"source_name":"Prueba","kcal":189.5,"protein":6.58,"carbs":33.85,"fat":3.26,"fiber":5.05}'::jsonb;
begin
  select p.id,p.patient_user_id,p.professional_id into patient,actor,professional
    from public.patients p join public.profiles pr on pr.id=p.patient_user_id
    where p.status='ACTIVE' and pr.role='PACIENTE' limit 1;
  if patient is null then raise exception 'A linked patient is needed'; end if;
  insert into auth.users(id) values(other_user);
  perform set_config('request.jwt.claim.sub',actor::text,true);
  execute 'set local role authenticated';
  returned := public.record_extra_food(request,patient,(now() at time zone 'America/Mexico_City')::date,'Avena','50 g',190,snapshot);
  if returned<>request then raise exception 'Wrong identifier'; end if;
  returned := public.record_extra_food(request,patient,(now() at time zone 'America/Mexico_City')::date,'Avena','50 g',190,snapshot);
  select count(*),max(nutrition_snapshot::text)::jsonb into count_rows,saved from public.extra_meal_logs where id=request;
  if count_rows<>1 or saved<>snapshot then raise exception 'Snapshot missing or request duplicated'; end if;
  perform public.record_extra_food(manual_request,patient,(now() at time zone 'America/Mexico_City')::date,
    'Registro manual','2 piezas',null,'{"version":1,"kind":"manual","consumed_time":"14:30","time_zone":"America/Mexico_City","protein":null}'::jsonb);
  select nutrition_snapshot into saved from public.extra_meal_logs where id=manual_request;
  if saved->>'consumed_time' <> '14:30' or saved->'protein' <> 'null'::jsonb then raise exception 'Manual intake time not preserved'; end if;
  denied:=false;
  begin
    perform public.record_extra_food(request,patient,(now() at time zone 'America/Mexico_City')::date,'Avena','50 g',190,snapshot || '{"protein":10}'::jsonb);
  exception when unique_violation then denied:=true; end;
  if not denied then raise exception 'Same request accepted different content'; end if;
  perform set_config('request.jwt.claim.sub',professional::text,true);
  select count(*) into count_rows from public.extra_meal_logs where id=request;
  if count_rows<>1 then raise exception 'Linked professional cannot read'; end if;
  perform set_config('request.jwt.claim.sub',other_user::text,true);
  select count(*) into count_rows from public.extra_meal_logs where id=request;
  if count_rows<>0 then raise exception 'Unrelated patient can read'; end if;
  denied:=false;
  begin
    perform public.record_extra_food(gen_random_uuid(),patient,(now() at time zone 'America/Mexico_City')::date,'Avena','50 g',190,snapshot);
  exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Unrelated patient can write'; end if;
end $test$;
rollback;
