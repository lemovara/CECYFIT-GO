-- Validates provenance and patient snapshots without persisting test records.
begin;
do $test$
declare patient uuid; actor uuid; recipe uuid; meal uuid; snapshot jsonb; sample public.food_ingredients%rowtype; rejected boolean:=false;
begin
 select p.id,p.professional_id into patient,actor from public.patients p join public.profiles pr on pr.id=p.professional_id
 where p.status='ACTIVE' and pr.role='PROFESIONAL' limit 1;
 if patient is null then raise exception 'No active patient available for test'; end if;
 select * into sample from public.food_ingredients where id='usda-fdc-2747663';
 if not found or sample.source_license <> 'CC0 1.0' or sample.source_id <> '2747663' then raise exception 'USDA data missing'; end if;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 execute 'set local role authenticated';
 recipe := public.save_professional_recipe('Prueba temporal USDA','Preparación','{"usda-fdc-2747663":100}'::jsonb,null);
 meal := public.assign_professional_recipe(patient,date '2099-12-04',time '04:10',recipe);
 select nutrition_snapshot into snapshot from public.patient_meals where id=meal;
 if not exists(select 1 from jsonb_array_elements(snapshot->'ingredients') i
   where i->>'source_id'='2747663' and i->>'source_license'='CC0 1.0'
     and (i->'nutrients_per_100g'->>'kcal')::numeric = sample.kcal) then
   raise exception 'Provenance snapshot failed';
 end if;
 begin perform public.save_professional_recipe('Prueba','','{"usda-fdc-9999999":100}'::jsonb,null);
 exception when invalid_parameter_value then rejected:=true; end;
 if not rejected then raise exception 'Unknown ingredient was accepted'; end if;
end $test$;
rollback;
