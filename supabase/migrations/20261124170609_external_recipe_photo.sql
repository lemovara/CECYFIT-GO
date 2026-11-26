-- Preserve historical image links and allow only the selected recipe provider's images.
alter table public.patient_meals drop constraint patient_meals_photo_url_check;
alter table public.patient_meals add constraint patient_meals_photo_url_check check (
  photo_url is null or (char_length(photo_url) <= 2048 and (
    photo_url like 'https://www.themealdb.com/images/%' or
    photo_url ~ '^https://recipe-images[.]myplate[.]food/recipe-images/[A-Za-z0-9_-]+[.](jpg|jpeg|png|webp)$'
  ))
);

-- The invoker's existing patient and recipe RLS policies apply to each statement.
create function public.create_and_assign_external_recipe(
  p_patient_id uuid, p_day date, p_time time, p_title text, p_description text,
  p_quantities jsonb, p_photo_url text
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare version_id uuid; rec public.professional_recipe_versions%rowtype; new_id uuid; ingredients_text text;
begin
  if p_patient_id is null or p_day is null or not isfinite(p_day)
    or p_day < (now() at time zone 'America/Mexico_City')::date
    or p_time is null or p_time >= time '24:00' or extract(second from p_time) <> 0 then
    raise exception using errcode='22023', message='Fecha u horario inválido';
  end if;
  if p_photo_url is not null and p_photo_url !~ '^https://recipe-images[.]myplate[.]food/recipe-images/[A-Za-z0-9_-]+[.](jpg|jpeg|png|webp)$' then
    raise exception using errcode='22023', message='Imagen no válida';
  end if;
  version_id := public.save_professional_recipe(p_title,p_description,p_quantities,null);
  select * into strict rec from public.professional_recipe_versions where id=version_id;
  select string_agg((i->>'name') || ' · ' || (i->>'grams') || ' g', chr(10) order by i->>'name')
    into ingredients_text from jsonb_array_elements(rec.nutrition_snapshot->'ingredients') i;
  insert into public.patient_meals(patient_id,meal_date,scheduled_time,name,ingredients,notes,kcal,nutrition_snapshot,photo_url)
    values(p_patient_id,p_day,p_time,rec.title,ingredients_text,rec.description,
      round((rec.nutrition_snapshot->>'kcal')::numeric)::integer,rec.nutrition_snapshot,p_photo_url)
    returning id into new_id;
  return new_id;
end;
$$;
revoke all on function public.create_and_assign_external_recipe(uuid,date,time,text,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.create_and_assign_external_recipe(uuid,date,time,text,text,jsonb,text) to authenticated;

create function public.assign_external_manual_meal(
  p_patient_id uuid, p_day date, p_time time, p_title text, p_ingredients text,
  p_notes text, p_kcal integer, p_photo_url text
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare new_id uuid; meal_name text := btrim(coalesce(p_title,''));
begin
  if p_patient_id is null or p_day is null or not isfinite(p_day)
    or p_time is null or p_time >= time '24:00' or extract(second from p_time) <> 0
    or char_length(meal_name) not between 1 and 120
    or char_length(coalesce(p_ingredients,'')) > 3000 or char_length(coalesce(p_notes,'')) > 3000
    or p_kcal not between 0 and 10000
    or (p_photo_url is not null and p_photo_url !~ '^https://recipe-images[.]myplate[.]food/recipe-images/[A-Za-z0-9_-]+[.](jpg|jpeg|png|webp)$') then
    raise exception using errcode='22023', message='Datos de comida inválidos';
  end if;
  insert into public.patient_meals(patient_id,meal_date,scheduled_time,name,ingredients,notes,kcal,photo_url)
    values(p_patient_id,p_day,p_time,meal_name,btrim(coalesce(p_ingredients,'')),btrim(coalesce(p_notes,'')),p_kcal,p_photo_url)
    returning id into new_id;
  return new_id;
end;
$$;
revoke all on function public.assign_external_manual_meal(uuid,date,time,text,text,text,integer,text) from public,anon,authenticated;
grant execute on function public.assign_external_manual_meal(uuid,date,time,text,text,text,integer,text) to authenticated;
