-- Freeze ingredient provenance and per-100 g values on new recipe snapshots.
create or replace function public.assign_personalized_recipe(
  p_patient_id uuid, p_day date, p_time time, p_recipe_id text, p_quantities jsonb
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  rec public.food_recipes%rowtype;
  expected integer;
  snapshot jsonb;
  ingredients_text text;
  total_kcal numeric;
  new_id uuid;
begin
  if p_patient_id is null or p_day is null or not isfinite(p_day)
    or p_day < (now() at time zone 'America/Mexico_City')::date
    or p_time is null or p_time >= time '24:00' or extract(second from p_time) <> 0
    or p_quantities is null or jsonb_typeof(p_quantities) <> 'object' then
    raise exception using errcode='22023', message='Datos de receta inválidos';
  end if;
  select * into rec from public.food_recipes where id = p_recipe_id;
  if not found then raise exception using errcode='P0002', message='Receta no disponible'; end if;
  select count(*) into expected from public.food_recipe_items where recipe_id=p_recipe_id;
  if expected = 0 or (select count(*) from jsonb_object_keys(p_quantities)) <> expected
    or exists (select 1 from jsonb_each(p_quantities) q
      where not exists (select 1 from public.food_recipe_items ri where ri.recipe_id=p_recipe_id and ri.ingredient_id=q.key)
        or jsonb_typeof(q.value) <> 'number') then
    raise exception using errcode='22023', message='Ingredientes inválidos';
  end if;
  if exists (select 1 from jsonb_each_text(p_quantities) q where q.value::numeric < 0 or q.value::numeric > 5000)
    or not exists (select 1 from jsonb_each_text(p_quantities) q where q.value::numeric > 0) then
    raise exception using errcode='22023', message='Gramajes inválidos';
  end if;
  select jsonb_build_object(
      'id',rec.id,'title',rec.title,'description',rec.description,'photo_url',rec.photo_url,
      'kcal',round(sum(i.kcal * (p_quantities->>i.id)::numeric / 100),1),
      'protein',round(sum(i.protein * (p_quantities->>i.id)::numeric / 100),1),
      'carbs',round(sum(i.carbs * (p_quantities->>i.id)::numeric / 100),1),
      'fat',round(sum(i.fat * (p_quantities->>i.id)::numeric / 100),1),
      'fiber',round(sum(i.fiber * (p_quantities->>i.id)::numeric / 100),1),
      'ingredients',jsonb_agg(jsonb_build_object('id',i.id,'name',i.name,'grams',(p_quantities->>i.id)::numeric,'photo_url',i.photo_url,'source_name',i.source_name,'source_id',i.source_id,'source_url',i.source_url,'source_license',i.source_license,'original_name',i.original_name,'energy_nutrient_id',i.energy_nutrient_id,'nutrients_per_100g',jsonb_build_object('kcal',i.kcal,'protein',i.protein,'carbs',i.carbs,'fat',i.fat,'fiber',i.fiber)) order by i.name)
    ),
    string_agg(i.name || ' · ' || (p_quantities->>i.id) || ' g', chr(10) order by i.name),
    sum(i.kcal * (p_quantities->>i.id)::numeric / 100)
    into snapshot, ingredients_text, total_kcal
  from public.food_recipe_items ri join public.food_ingredients i on i.id=ri.ingredient_id
  where ri.recipe_id=p_recipe_id and (p_quantities->>i.id)::numeric > 0;
  if total_kcal > 10000 then raise exception using errcode='22023', message='Energía fuera de rango'; end if;
  insert into public.patient_meals(patient_id,meal_date,scheduled_time,name,ingredients,notes,kcal,recipe_id,nutrition_snapshot)
    values(p_patient_id,p_day,p_time,rec.title,ingredients_text,rec.description,round(total_kcal)::integer,rec.id,snapshot)
    returning id into new_id;
  return new_id;
end;
$$;

create or replace function nutrition_internal.save_professional_recipe(p_title text, p_description text, p_quantities jsonb, p_parent_version uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  family uuid;
  next_version integer;
  result uuid := gen_random_uuid();
  snapshot jsonb;
  n integer;
begin
  if actor is null or not exists(select 1 from public.profiles where id=actor and role='PROFESIONAL') then
    raise exception using errcode='42501', message='Se requiere una cuenta de profesional';
  end if;
  if p_title is null or char_length(btrim(p_title)) not between 1 and 120
    or char_length(coalesce(p_description,'')) > 3000
    or p_quantities is null or jsonb_typeof(p_quantities) <> 'object' then
    raise exception using errcode='22023', message='Datos de receta inválidos';
  end if;
  select count(*) into n from jsonb_object_keys(p_quantities);
  if n not between 1 and 30 or exists (select 1 from jsonb_each(p_quantities) q
    where jsonb_typeof(q.value) <> 'number' or not exists (select 1 from public.food_ingredients i where i.id=q.key)) then
    raise exception using errcode='22023', message='Ingredientes inválidos';
  end if;
  if exists (select 1 from jsonb_each_text(p_quantities) q where q.value::numeric <= 0 or q.value::numeric > 5000) then
    raise exception using errcode='22023', message='Gramajes inválidos';
  end if;
  if p_parent_version is not null then
    select family_id into family from public.professional_recipe_versions where id=p_parent_version and professional_id=actor;
    if not found then raise exception using errcode='42501', message='Receta no disponible'; end if;
  else
    family := gen_random_uuid();
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(family::text,0));
  select coalesce(max(version),0)+1 into next_version from public.professional_recipe_versions where professional_id=actor and family_id=family;
  select jsonb_build_object(
    'id', result, 'title',btrim(p_title), 'description',coalesce(p_description,''), 'photo_url',null,
    'kcal',round(sum(i.kcal*(p_quantities->>i.id)::numeric/100),1),
    'protein',round(sum(i.protein*(p_quantities->>i.id)::numeric/100),1),
    'carbs',round(sum(i.carbs*(p_quantities->>i.id)::numeric/100),1),
    'fat',round(sum(i.fat*(p_quantities->>i.id)::numeric/100),1),
    'fiber',round(sum(i.fiber*(p_quantities->>i.id)::numeric/100),1),
    'ingredients',jsonb_agg(jsonb_build_object('id',i.id,'name',i.name,'grams',(p_quantities->>i.id)::numeric,'photo_url',i.photo_url,'source_name',i.source_name,'source_id',i.source_id,'source_url',i.source_url,'source_license',i.source_license,'original_name',i.original_name,'energy_nutrient_id',i.energy_nutrient_id,'nutrients_per_100g',jsonb_build_object('kcal',i.kcal,'protein',i.protein,'carbs',i.carbs,'fat',i.fat,'fiber',i.fiber)) order by i.name)
  ) into snapshot from public.food_ingredients i where p_quantities ? i.id;
  if (snapshot->>'kcal')::numeric > 10000 then
    raise exception using errcode='22023', message='Energía fuera de rango';
  end if;
  insert into public.professional_recipe_versions(id,professional_id,family_id,version,title,description,nutrition_snapshot)
    values(result,actor,family,next_version,btrim(p_title),coalesce(p_description,''),snapshot);
  return result;
end;
$$;
