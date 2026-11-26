-- Assign a scaled snapshot; never mutate the professional's version or other patients' meals.
create function public.assign_scaled_professional_recipe(p_patient_id uuid,p_day date,p_time time,p_version_id uuid,p_multiplier numeric)
returns uuid language plpgsql security invoker set search_path='' as $$
declare rec public.professional_recipe_versions%rowtype; new_id uuid; photo text; ingredients jsonb; ingredients_text text;
  snapshot jsonb; scaled_kcal numeric;
begin
  if p_patient_id is null or p_version_id is null or p_day is null or not isfinite(p_day)
    or p_day < (now() at time zone 'America/Mexico_City')::date or p_time is null
    or p_time >= time '24:00' or extract(second from p_time) <> 0 or p_multiplier is null
    or p_multiplier::text in ('NaN','Infinity','-Infinity') or p_multiplier < 0.1 or p_multiplier > 10 then
    raise exception using errcode='22023',message='Datos de asignación inválidos';
  end if;
  select * into rec from public.professional_recipe_versions where id=p_version_id;
  if not found then raise exception using errcode='P0002',message='Receta no disponible'; end if;
  if jsonb_typeof(rec.nutrition_snapshot->'ingredients') is distinct from 'array'
    or jsonb_array_length(rec.nutrition_snapshot->'ingredients') not between 1 and 30
    or exists (select 1 from jsonb_array_elements(rec.nutrition_snapshot->'ingredients') i
      where jsonb_typeof(i->'grams') is distinct from 'number' or round((i->>'grams')::numeric*p_multiplier,3) <= 0
        or round((i->>'grams')::numeric*p_multiplier,3) > 5000) then
    raise exception using errcode='22023',message='Cantidad de ingrediente fuera de rango';
  end if;
  select jsonb_agg(jsonb_set(i,'{grams}',to_jsonb(round((i->>'grams')::numeric*p_multiplier,3))) order by ord),
    string_agg((i->>'name') || ' · ' || round((i->>'grams')::numeric*p_multiplier,3) || ' g',chr(10) order by ord)
    into ingredients,ingredients_text from jsonb_array_elements(rec.nutrition_snapshot->'ingredients') with ordinality as x(i,ord);
  scaled_kcal := round((rec.nutrition_snapshot->>'kcal')::numeric*p_multiplier,1);
  if scaled_kcal > 10000 then raise exception using errcode='22023',message='Energía fuera de rango'; end if;
  snapshot := rec.nutrition_snapshot || jsonb_build_object('ingredients',ingredients,'portion_multiplier',p_multiplier,
    'kcal',scaled_kcal,'protein',round((rec.nutrition_snapshot->>'protein')::numeric*p_multiplier,1),
    'carbs',round((rec.nutrition_snapshot->>'carbs')::numeric*p_multiplier,1),
    'fat',round((rec.nutrition_snapshot->>'fat')::numeric*p_multiplier,1),
    'fiber',round((rec.nutrition_snapshot->>'fiber')::numeric*p_multiplier,1));
  select photo_url into photo from public.professional_recipe_photos where version_id=rec.id;
  insert into public.patient_meals(patient_id,meal_date,scheduled_time,name,ingredients,notes,kcal,nutrition_snapshot,photo_url)
    values(p_patient_id,p_day,p_time,rec.title,ingredients_text,rec.description,round(scaled_kcal)::integer,snapshot,photo) returning id into new_id;
  return new_id;
end;
$$;
revoke all on function public.assign_scaled_professional_recipe(uuid,date,time,uuid,numeric) from public,anon,authenticated;
grant execute on function public.assign_scaled_professional_recipe(uuid,date,time,uuid,numeric) to authenticated;
