-- Integration test: uses an existing linked patient, creates temporary records, then rolls back.
begin;
do $test$
declare patient uuid; actor uuid; patient_actor uuid; other_professional uuid := gen_random_uuid(); v1 uuid; v2 uuid; duplicate uuid; meal uuid; saved jsonb; denied boolean; n integer;
begin
 select p.id,p.professional_id,p.patient_user_id into patient,actor,patient_actor
 from public.patients p join public.profiles pr on pr.id=p.professional_id
 where p.status='ACTIVE' and pr.role='PROFESIONAL' and p.patient_user_id is not null limit 1;
 if patient is null then raise exception 'A linked patient is needed for the integration test'; end if;
 -- A temporary second professional verifies isolation without modifying an existing user.
 insert into auth.users(id) values(other_professional);
 update public.profiles set role='PROFESIONAL' where id=other_professional;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 execute 'set local role authenticated';
 v1 := public.save_professional_recipe('Prueba temporal','Preparación', '{"avena":80,"platano":100}'::jsonb,null);
 meal := public.assign_professional_recipe(patient,date '2099-12-02',time '03:22',v1);
 v2 := public.save_professional_recipe('Prueba temporal v2','Preparación nueva', '{"avena":100,"platano":100}'::jsonb,v1);
 duplicate := public.save_professional_recipe('Copia de prueba','Preparación', '{"avena":80,"platano":100}'::jsonb,null);
 if (select family_id from public.professional_recipe_versions where id=duplicate) =
    (select family_id from public.professional_recipe_versions where id=v1)
    or (select version from public.professional_recipe_versions where id=duplicate) <> 1 then
   raise exception 'Duplicate must start an independent recipe family';
 end if;
 select nutrition_snapshot into saved from public.patient_meals where id=meal;
 if (saved->>'kcal')::numeric <> 392.2 then raise exception 'Published snapshot changed or calculated incorrectly'; end if;
 select count(*) into n from public.professional_recipe_versions where id in(v1,v2);
 if n<>2 then raise exception 'Version missing'; end if;
 denied:=false;
 begin
   insert into public.professional_recipe_versions(professional_id,family_id,version,title,nutrition_snapshot)
     values(actor,gen_random_uuid(),1,'forged','{}');
 exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Direct insertion allowed'; end if;
 perform set_config('request.jwt.claim.sub',other_professional::text,true);
 select count(*) into n from public.professional_recipe_versions where id=v1;
 if n<>0 then raise exception 'Recipe visible to another professional'; end if;
 denied:=false;
 begin perform public.save_professional_recipe('Versión ajena','', '{"avena":80}'::jsonb,v1);
 exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Another professional created a version of a private recipe'; end if;
 denied:=false;
 begin perform public.assign_professional_recipe(patient,date '2099-12-02',time '03:23',v1);
 exception when no_data_found then denied:=true; end;
 if not denied then raise exception 'Another professional assigned a private recipe'; end if;
 perform set_config('request.jwt.claim.sub',patient_actor::text,true);
 select count(*) into n from public.professional_recipe_versions where id=v1;
 if n<>0 then raise exception 'Private recipe visible to patient'; end if;
 denied:=false;
 begin perform public.save_professional_recipe('No permitida','', '{"avena":80}'::jsonb,null);
 exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Patient created a professional recipe'; end if;
 denied:=false;
 begin perform public.assign_professional_recipe(patient,date '2099-12-02',time '03:24',v1);
 exception when no_data_found then denied:=true; end;
 if not denied then raise exception 'Patient assigned a professional recipe'; end if;
end $test$;
rollback;
