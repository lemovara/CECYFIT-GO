begin;
do $test$
declare patient uuid; professional uuid; actor uuid; other uuid := gen_random_uuid(); meal uuid; request uuid:=gen_random_uuid(); snapshot jsonb; denied boolean;
  today date := (now() at time zone 'America/Mexico_City')::date;
begin
  select p.id,p.professional_id,p.patient_user_id into patient,professional,actor from public.patients p
    join public.profiles pr on pr.id=p.professional_id and pr.role='PROFESIONAL'
    where p.status='ACTIVE' and p.patient_user_id is not null limit 1;
  if patient is null then raise exception 'A linked patient is needed'; end if;
  insert into auth.users(id) values(other);
  perform set_config('request.jwt.claim.sub',professional::text,true); execute 'set local role authenticated';
  meal:=public.assign_branded_product_with_metadata(patient,date '2199-01-01',time '00:19','Prueba','Marca','12345678',150,'g',200,10,null,5,null,array['Leche'],array['Soya'],array['exceso de calorias']);
  select nutrition_snapshot into snapshot from public.patient_meals where id=meal;
  if snapshot->'allergens' <> '["Leche"]'::jsonb or snapshot->'traces' <> '["Soya"]'::jsonb or snapshot->'labels' <> '["exceso de calorias"]'::jsonb or (snapshot->>'kcal')::numeric <> 300 then
    raise exception 'Product metadata or nutrients not preserved'; end if;
  denied:=false;
  begin perform public.assign_branded_product_with_metadata(patient,date '2199-01-01',time '00:20','Prueba','','12345678',100,'g',1,null,null,null,null,array[repeat('a',121)],array[]::text[],array[]::text[]);
  exception when invalid_parameter_value then denied:=true; end;
  if not denied then raise exception 'Oversized metadata accepted'; end if;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  select nutrition_snapshot into snapshot from public.patient_meals where id=meal;
  if snapshot->'allergens' <> '["Leche"]'::jsonb then raise exception 'Patient cannot read assigned allergens'; end if;
  snapshot:='{"version":1,"kind":"product","food_id":"off:12345678","food_name":"Prueba","allergens":["Leche"],"traces":["Soya"],"labels":[],"kcal":100}'::jsonb;
  perform public.record_extra_food(request,patient,today,'Prueba','100 g',100,snapshot);
  select nutrition_snapshot into snapshot from public.extra_meal_logs where id=request and patient_user_id=actor;
  if snapshot->'allergens' <> '["Leche"]'::jsonb then raise exception 'Self-reported allergens not retained'; end if;
  denied:=false;
  begin perform public.assign_branded_product_with_metadata(patient,date '2199-01-01',time '00:21','Prueba','','12345678',100,'g',1,null,null,null,null,array[]::text[],array[]::text[],array[]::text[]);
  exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Patient assigned own meal'; end if;
  perform set_config('request.jwt.claim.sub',other::text,true);
  select nutrition_snapshot into snapshot from public.patient_meals where id=meal;
  if snapshot is not null then raise exception 'Another user read assigned meal'; end if;
end $test$;
rollback;
