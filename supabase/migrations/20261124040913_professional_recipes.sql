-- Versiones privadas e inmutables. Las comidas publicadas conservan su propia copia.
create table public.professional_recipe_versions (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.profiles(id),
  family_id uuid not null,
  version integer not null check (version > 0),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 3000),
  nutrition_snapshot jsonb not null check (jsonb_typeof(nutrition_snapshot) = 'object'),
  created_at timestamptz not null default now(),
  unique (professional_id, family_id, version)
);
create index professional_recipe_versions_owner_created_idx on public.professional_recipe_versions(professional_id, created_at desc);
alter table public.professional_recipe_versions enable row level security;
revoke all on public.professional_recipe_versions from public, anon, authenticated;
grant select on public.professional_recipe_versions to authenticated;
create policy own_recipe_versions_read on public.professional_recipe_versions for select to authenticated
  using (professional_id = (select auth.uid()) and exists (
    select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'PROFESIONAL'
  ));

-- SECURITY DEFINER is necessary to prohibit direct inserts of forged nutrition snapshots.
-- Authorization is checked explicitly and all data references are schema-qualified.
create function public.save_professional_recipe(p_title text, p_description text, p_quantities jsonb, p_parent_version uuid default null)
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
    'ingredients',jsonb_agg(jsonb_build_object('id',i.id,'name',i.name,'grams',(p_quantities->>i.id)::numeric,'photo_url',i.photo_url) order by i.name)
  ) into snapshot from public.food_ingredients i where p_quantities ? i.id;
  if (snapshot->>'kcal')::numeric > 10000 then
    raise exception using errcode='22023', message='Energía fuera de rango';
  end if;
  insert into public.professional_recipe_versions(id,professional_id,family_id,version,title,description,nutrition_snapshot)
    values(result,actor,family,next_version,btrim(p_title),coalesce(p_description,''),snapshot);
  return result;
end;
$$;
revoke all on function public.save_professional_recipe(text,text,jsonb,uuid) from public, anon, authenticated;
grant execute on function public.save_professional_recipe(text,text,jsonb,uuid) to authenticated;

create function public.assign_professional_recipe(p_patient_id uuid,p_day date,p_time time,p_version_id uuid)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare rec public.professional_recipe_versions%rowtype; new_id uuid; ingredients_text text;
begin
  if p_patient_id is null or p_day is null or not isfinite(p_day)
    or p_day < (now() at time zone 'America/Mexico_City')::date
    or p_time is null or p_time >= time '24:00' or extract(second from p_time) <> 0 then
    raise exception using errcode='22023', message='Fecha u horario inválido';
  end if;
  select * into rec from public.professional_recipe_versions where id=p_version_id;
  if not found then raise exception using errcode='P0002', message='Receta no disponible'; end if;
  select string_agg((i->>'name') || ' · ' || (i->>'grams') || ' g', chr(10) order by i->>'name')
    into ingredients_text from jsonb_array_elements(rec.nutrition_snapshot->'ingredients') i;
  insert into public.patient_meals(patient_id,meal_date,scheduled_time,name,ingredients,notes,kcal,nutrition_snapshot)
    values(p_patient_id,p_day,p_time,rec.title,ingredients_text,rec.description,
      round((rec.nutrition_snapshot->>'kcal')::numeric)::integer,rec.nutrition_snapshot)
    returning id into new_id;
  return new_id;
end;
$$;
revoke all on function public.assign_professional_recipe(uuid,date,time,uuid) from public, anon, authenticated;
grant execute on function public.assign_professional_recipe(uuid,date,time,uuid) to authenticated;
