begin;
do $test$
declare patient uuid; professional uuid; actor uuid; ingredient text; meal uuid; manual_meal uuid; saved_version uuid; revised uuid; reassigned uuid; versions_before bigint; denied boolean;
  photo constant text := 'https://recipe-images.myplate.food/recipe-images/2-step-chicken.jpg';
begin
  select p.id,p.professional_id,p.patient_user_id into patient,professional,actor from public.patients p
    join public.profiles pr on pr.id=p.professional_id and pr.role='PROFESIONAL'
    where p.status='ACTIVE' and p.patient_user_id is not null limit 1;
  select id into ingredient from public.food_ingredients where kcal is not null and kcal < 1000 limit 1;
  if patient is null or ingredient is null then raise exception 'Se requiere un paciente vinculado y un ingrediente'; end if;
  perform set_config('request.jwt.claim.sub',professional::text,true);
  execute 'set local role authenticated';
  meal := public.create_and_assign_external_recipe(patient,date '2199-01-01',time '00:13','Prueba temporal','Indicaciones',jsonb_build_object(ingredient,100),photo);
  if not exists(select 1 from public.patient_meals where id=meal and photo_url=photo and nutrition_snapshot is not null) then
    raise exception 'La asignación con imagen no se conservó';
  end if;
  select (nutrition_snapshot->>'id')::uuid into saved_version from public.patient_meals where id=meal;
  if not exists(select 1 from public.professional_recipe_photos where professional_recipe_photos.version_id=saved_version and photo_url=photo) then raise exception 'La versión no conservó la imagen'; end if;
  revised := public.save_professional_recipe_with_photo('Versión nueva','',jsonb_build_object(ingredient,100),saved_version,photo);
  reassigned := public.assign_professional_recipe(patient,date '2199-01-01',time '00:17',revised);
  if not exists(select 1 from public.patient_meals where id=reassigned and photo_url=photo) then raise exception 'La reasignación perdió la imagen'; end if;
  manual_meal := public.assign_external_manual_meal(patient,date '2199-01-01',time '00:14','Prueba manual','Ingrediente','Indicaciones',null,photo);
  if not exists(select 1 from public.patient_meals where id=manual_meal and photo_url=photo and kcal is null) then
    raise exception 'La comida manual no se conservó';
  end if;
  select count(*) into versions_before from public.professional_recipe_versions;
  denied := false;
  begin
    perform public.create_and_assign_external_recipe(patient,date '2199-01-01',time '00:15','Inválida','',jsonb_build_object(ingredient,100),'https://example.com/foto.jpg');
  exception when invalid_parameter_value then denied:=true; end;
  if not denied or (select count(*) from public.professional_recipe_versions) <> versions_before then raise exception 'La URL ajena debe rechazarse sin crear versiones'; end if;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  if exists(select 1 from public.professional_recipe_photos where professional_recipe_photos.version_id=saved_version) then raise exception 'El paciente no debe consultar el catálogo privado'; end if;
  denied := false;
  begin
    perform public.assign_external_manual_meal(patient,date '2199-01-01',time '00:16','Acceso inválido','','',null,photo);
  exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'El paciente no debe poder asignarse comidas como profesional'; end if;
end $test$;
rollback;
