begin;
do $test$
declare patient uuid; professional uuid; patient_actor uuid; other uuid := gen_random_uuid(); source uuid; meal uuid; n_before integer; n_after integer;
  future_day date := (now() at time zone 'America/Mexico_City')::date + 3620;
begin
  select p.id,p.professional_id,p.patient_user_id into patient,professional,patient_actor from public.patients p
    join public.profiles pr on pr.id=p.professional_id and pr.role='PROFESIONAL'
    where p.status='ACTIVE' and p.patient_user_id is not null limit 1;
  if patient is null then raise exception 'A linked patient is needed'; end if;
  insert into auth.users(id) values(other);
  update public.profiles set role='PROFESIONAL' where id=other;
  perform set_config('request.jwt.claim.sub',professional::text,true); execute 'set local role authenticated';
  source := public.save_professional_recipe('Receta temporal','Preparación', '{"avena":80,"platano":100}',null);
  meal := public.assign_customized_professional_recipe(patient,future_day,'03:20',source,'{"avena":100,"pollo":50}');
  if not exists (select 1 from public.patient_meals where id=meal and nutrition_snapshot->'ingredients' @> '[{"id":"avena","grams":100},{"id":"pollo","grams":50}]'::jsonb
    and not (nutrition_snapshot->'ingredients' @> '[{"id":"platano"}]'::jsonb)) then
    raise exception 'Customized assignment missing';
  end if;
  if not exists (select 1 from public.professional_recipe_versions where id=source and nutrition_snapshot->'ingredients' @> '[{"id":"avena","grams":80}]'::jsonb) then
    raise exception 'Original version changed';
  end if;
  select count(*) into n_before from public.professional_recipe_versions;
  begin
    perform public.assign_customized_professional_recipe(patient,future_day,'03:20',source,'{"avena":120}');
    raise exception 'Conflicting time accepted';
  exception when unique_violation then null; end;
  select count(*) into n_after from public.professional_recipe_versions;
  if n_before <> n_after then raise exception 'A failed assignment left an orphan version'; end if;
  perform set_config('request.jwt.claim.sub',other::text,true);
  begin
    perform public.assign_customized_professional_recipe(patient,future_day,'03:21',source,'{"avena":100}');
    raise exception 'Another professional could use a private recipe';
  exception when no_data_found then null; end;
  perform set_config('request.jwt.claim.sub',patient_actor::text,true);
  begin
    perform public.assign_customized_professional_recipe(patient,future_day,'03:21',source,'{"avena":100}');
    raise exception 'Patient could use a private recipe';
  exception when no_data_found then null; end;
end $test$;
rollback;
