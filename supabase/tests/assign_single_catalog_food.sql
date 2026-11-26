begin;
do $test$
declare patient uuid; professional uuid; actor uuid; meal uuid; prepared uuid; snapshot jsonb; expected numeric;
begin
  select p.id,p.professional_id,p.patient_user_id into patient,professional,actor from public.patients p
    join public.profiles pr on pr.id=p.professional_id and pr.role='PROFESIONAL'
    where p.status='ACTIVE' and p.patient_user_id is not null limit 1;
  if patient is null then raise exception 'A linked patient is needed'; end if;
  perform set_config('request.jwt.claim.sub',professional::text,true); execute 'set local role authenticated';
  meal:=public.create_and_assign_professional_recipe(patient,date '2199-01-01',time '00:27','Avena seca','Preparar según indicaciones',jsonb_build_object('avena',50));
  select kcal into expected from public.food_ingredients where id='usda-fndds-2708515';
  if expected is null then raise exception 'FNDDS food missing'; end if;
  prepared:=public.create_and_assign_professional_recipe(patient,date '2199-01-01',time '00:28','Taco de referencia','Verifica la preparación',jsonb_build_object('usda-fndds-2708515',100));
  perform set_config('request.jwt.claim.sub',actor::text,true);
  select nutrition_snapshot into snapshot from public.patient_meals where id=meal;
  if snapshot->'ingredients'->0->>'id' <> 'avena' or (snapshot->'ingredients'->0->>'grams')::numeric <> 50
    or (snapshot->>'kcal')::numeric <> 189.5 then raise exception 'Assigned food snapshot incorrect'; end if;
  select nutrition_snapshot into snapshot from public.patient_meals where id=prepared;
  if snapshot->'ingredients'->0->>'id' <> 'usda-fndds-2708515' or (snapshot->>'kcal')::numeric <> expected
    then raise exception 'Prepared food snapshot incorrect'; end if;
end $test$;
rollback;
