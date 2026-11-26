create table public.professional_recipe_photos (
  version_id uuid primary key references public.professional_recipe_versions(id) on delete cascade,
  professional_id uuid not null references public.profiles(id) on delete cascade,
  photo_url text not null check (photo_url ~ '^https://recipe-images[.]myplate[.]food/recipe-images/[A-Za-z0-9_-]+[.](jpg|jpeg|png|webp)$')
);
alter table public.professional_recipe_photos enable row level security;
revoke all on public.professional_recipe_photos from public,anon,authenticated;
grant select,insert on public.professional_recipe_photos to authenticated;
create policy own_recipe_photo_read on public.professional_recipe_photos for select to authenticated
  using (professional_id=(select auth.uid()));
create policy own_recipe_photo_insert on public.professional_recipe_photos for insert to authenticated
  with check (professional_id=(select auth.uid()) and exists (
    select 1 from public.professional_recipe_versions r where r.id=version_id and r.professional_id=(select auth.uid())
  ));

create function public.save_professional_recipe_with_photo(p_title text,p_description text,p_quantities jsonb,p_parent_version uuid,p_photo_url text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare version_id uuid;
begin
  if p_photo_url is not null and p_photo_url !~ '^https://recipe-images[.]myplate[.]food/recipe-images/[A-Za-z0-9_-]+[.](jpg|jpeg|png|webp)$' then
    raise exception using errcode='22023', message='Imagen no válida';
  end if;
  version_id := public.save_professional_recipe(p_title,p_description,p_quantities,p_parent_version);
  if p_photo_url is not null then
    insert into public.professional_recipe_photos(version_id,professional_id,photo_url) values(version_id,auth.uid(),p_photo_url);
  end if;
  return version_id;
end;
$$;
revoke all on function public.save_professional_recipe_with_photo(text,text,jsonb,uuid,text) from public,anon,authenticated;
grant execute on function public.save_professional_recipe_with_photo(text,text,jsonb,uuid,text) to authenticated;

create or replace function public.assign_professional_recipe(p_patient_id uuid,p_day date,p_time time,p_version_id uuid)
returns uuid language plpgsql security invoker set search_path='' as $$
declare rec public.professional_recipe_versions%rowtype; new_id uuid; ingredients_text text; photo text;
begin
  if p_patient_id is null or p_day is null or not isfinite(p_day)
    or p_day < (now() at time zone 'America/Mexico_City')::date
    or p_time is null or p_time >= time '24:00' or extract(second from p_time) <> 0 then
    raise exception using errcode='22023', message='Fecha u horario inválido';
  end if;
  select * into rec from public.professional_recipe_versions where id=p_version_id;
  if not found then raise exception using errcode='P0002', message='Receta no disponible'; end if;
  select photo_url into photo from public.professional_recipe_photos where version_id=rec.id;
  select string_agg((i->>'name') || ' · ' || (i->>'grams') || ' g',chr(10) order by i->>'name')
    into ingredients_text from jsonb_array_elements(rec.nutrition_snapshot->'ingredients') i;
  insert into public.patient_meals(patient_id,meal_date,scheduled_time,name,ingredients,notes,kcal,nutrition_snapshot,photo_url)
    values(p_patient_id,p_day,p_time,rec.title,ingredients_text,rec.description,
      round((rec.nutrition_snapshot->>'kcal')::numeric)::integer,rec.nutrition_snapshot,photo) returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.create_and_assign_external_recipe(
  p_patient_id uuid,p_day date,p_time time,p_title text,p_description text,p_quantities jsonb,p_photo_url text
) returns uuid language plpgsql security invoker set search_path='' as $$
declare version_id uuid;
begin
  version_id := public.save_professional_recipe_with_photo(p_title,p_description,p_quantities,null,p_photo_url);
  return public.assign_professional_recipe(p_patient_id,p_day,p_time,version_id);
end;
$$;
