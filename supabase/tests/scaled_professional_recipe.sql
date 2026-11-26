begin;
do $test$
declare patient uuid; professional uuid; actor uuid; other uuid:=gen_random_uuid(); recipe uuid; meal uuid; snapshot jsonb; original jsonb; denied boolean;
begin
  select p.id,p.professional_id,p.patient_user_id into patient,professional,actor from public.patients p
    join public.profiles pr on pr.id=p.professional_id and pr.role='PROFESIONAL'
    where p.status='ACTIVE' and p.patient_user_id is not null limit 1;
  if patient is null then raise exception 'A linked patient is needed'; end if;
  insert into auth.users(id) values(other);
  perform set_config('request.jwt.claim.sub',professional::text,true); execute 'set local role authenticated';
  recipe:=public.save_professional_recipe('Avena temporal','Preparar',jsonb_build_object('avena',100),null);
  meal:=public.assign_scaled_professional_recipe(patient,date '2199-01-01',time '00:26',recipe,0.5);
  select nutrition_snapshot into original from public.professional_recipe_versions where id=recipe;
  if (original->'ingredients'->0->>'grams')::numeric <> 100 then raise exception 'Original changed'; end if;
  denied:=false;
  begin perform public.assign_scaled_professional_recipe(patient,date '2199-01-01',time '00:28',recipe,0); exception when invalid_parameter_value then denied:=true; end;
  if not denied then raise exception 'Invalid portion accepted'; end if;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  select nutrition_snapshot into snapshot from public.patient_meals where id=meal;
  if (snapshot->'ingredients'->0->>'grams')::numeric <> 50 or (snapshot->>'kcal')::numeric <> 189.5 or (snapshot->>'portion_multiplier')::numeric <> 0.5 then
    raise exception 'Scaled snapshot incorrect'; end if;
  perform set_config('request.jwt.claim.sub',other::text,true);
  select nutrition_snapshot into snapshot from public.patient_meals where id=meal;
  if snapshot is not null then raise exception 'Unrelated user read meal'; end if;
  denied:=false;
  begin perform public.assign_scaled_professional_recipe(patient,date '2199-01-01',time '00:29',recipe,1); exception when no_data_found then denied:=true; end;
  if not denied then raise exception 'Unrelated user assigned recipe'; end if;
end $test$;
rollback;
