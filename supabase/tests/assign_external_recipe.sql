begin;
do $test$
declare patient uuid; actor uuid; patient_actor uuid; other_user uuid := gen_random_uuid(); meal uuid; before_count integer; after_count integer; denied boolean; snapshot jsonb;
begin
  select p.id,p.professional_id,p.patient_user_id into patient,actor,patient_actor
  from public.patients p join public.profiles pr on pr.id=p.professional_id
  where p.status='ACTIVE' and pr.role='PROFESIONAL' and p.patient_user_id is not null limit 1;
  if patient is null then raise exception 'A linked patient is needed'; end if;
  insert into auth.users(id) values(other_user);
  perform set_config('request.jwt.claim.sub',actor::text,true);
  execute 'set local role authenticated';
  select count(*) into before_count from public.professional_recipe_versions;
  meal := public.create_and_assign_professional_recipe(patient,date '2099-12-01',time '03:21','Prueba temporal','Preparar', '{"avena":50,"platano":100}'::jsonb);
  select nutrition_snapshot into snapshot from public.patient_meals where id=meal;
  if (snapshot->>'kcal')::numeric <> 278.5 or jsonb_array_length(snapshot->'ingredients') <> 2 then
    raise exception 'Missing or incorrect nutritional snapshot'; end if;
  select count(*) into after_count from public.professional_recipe_versions;
  if after_count<>before_count+1 then raise exception 'Recipe not saved'; end if;
  denied:=false;
  begin
    perform public.create_and_assign_professional_recipe(patient,date '2099-12-01',time '03:21','Otra prueba','', '{"avena":50}'::jsonb);
  exception when unique_violation then denied:=true; end;
  if not denied then raise exception 'Duplicate schedule accepted'; end if;
  select count(*) into after_count from public.professional_recipe_versions;
  if after_count<>before_count+1 then raise exception 'Failed assignment left a recipe'; end if;
  perform set_config('request.jwt.claim.sub',patient_actor::text,true);
  select nutrition_snapshot into snapshot from public.patient_meals where id=meal;
  if snapshot is null then raise exception 'Patient cannot read published snapshot'; end if;
  perform set_config('request.jwt.claim.sub',other_user::text,true);
  select nutrition_snapshot into snapshot from public.patient_meals where id=meal;
  if found then raise exception 'Unrelated user can read patient meal'; end if;
  denied:=false;
  begin perform public.create_and_assign_professional_recipe(patient,date '2099-12-01',time '03:22','No permitida','', '{"avena":50}'::jsonb);
  exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Unrelated user created recipe'; end if;
end $test$;
rollback;
