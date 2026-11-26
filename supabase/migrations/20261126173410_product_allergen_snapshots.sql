-- Keep the original RPC for older clients. New assignments preserve declared product metadata.
create function public.assign_branded_product_with_metadata(
  p_patient_id uuid,p_day date,p_time time,p_name text,p_brand text,p_code text,
  p_amount numeric,p_unit text,p_energy numeric,p_protein numeric,p_carbs numeric,p_fat numeric,
  p_photo_url text,p_allergens text[],p_traces text[],p_labels text[]
) returns uuid language plpgsql security invoker set search_path='' as $$
declare snapshot jsonb; new_id uuid; scaled_energy numeric;
begin
  if p_patient_id is null or p_day is null or not isfinite(p_day) or p_time is null
    or p_time >= time '24:00' or extract(second from p_time) <> 0
    or char_length(btrim(coalesce(p_name,''))) not between 1 and 120
    or char_length(coalesce(p_brand,'')) > 120 or coalesce(p_code,'') !~ '^[0-9]{4,24}$'
    or p_unit is null or p_unit not in ('g','ml') or p_amount is null or p_amount <= 0 or p_amount > 5000
    or p_amount::text in ('NaN','Infinity','-Infinity')
    or exists (select 1 from unnest(array[p_energy,p_protein,p_carbs,p_fat]) v
      where v is not null and (v < 0 or v > 10000 or v::text in ('NaN','Infinity','-Infinity')))
    or (p_photo_url is not null and (char_length(p_photo_url) > 2048 or p_photo_url !~ '^https://images[.]openfoodfacts[.]org/images/products/[A-Za-z0-9_./-]+[.](jpg|jpeg|png|webp)$'))
    or p_allergens is null or p_traces is null or p_labels is null
    or cardinality(p_allergens)>20 or cardinality(p_traces)>20 or cardinality(p_labels)>20
    or exists (select 1 from unnest(p_allergens || p_traces || p_labels) v where v is null or char_length(btrim(v)) not between 1 and 120) then
    raise exception using errcode='22023', message='Datos de producto inválidos';
  end if;
  scaled_energy := round(p_energy * p_amount / 100,1);
  if scaled_energy > 10000 then raise exception using errcode='22023', message='Energía fuera de rango'; end if;
  snapshot := jsonb_build_object('id','off:'||p_code,'kind','product','title',btrim(p_name),
    'description','Producto comercial. Revisa la etiqueta.', 'photo_url',p_photo_url,
    'source_name','Open Food Facts','source_url','https://world.openfoodfacts.org',
    'brand',p_brand,'amount',p_amount,'unit',p_unit,'kcal',scaled_energy,
    'protein',round(p_protein*p_amount/100,1),'carbs',round(p_carbs*p_amount/100,1),
    'fat',round(p_fat*p_amount/100,1),'fiber',null,'ingredients','[]'::jsonb,
    'allergens',to_jsonb(p_allergens),'traces',to_jsonb(p_traces),'labels',to_jsonb(p_labels));
  insert into public.patient_meals(patient_id,meal_date,scheduled_time,name,ingredients,notes,kcal,nutrition_snapshot)
    values(p_patient_id,p_day,p_time,btrim(p_name),btrim(p_name)||' · '||p_amount||' '||p_unit,
      'Datos comunitarios de Open Food Facts; confirma la etiqueta. Base indicada por el profesional: 100 '||p_unit||'.',
      round(scaled_energy)::integer,snapshot) returning id into new_id;
  return new_id;
end;
$$;
revoke all on function public.assign_branded_product_with_metadata(uuid,date,time,text,text,text,numeric,text,numeric,numeric,numeric,numeric,text,text[],text[],text[]) from public,anon,authenticated;
grant execute on function public.assign_branded_product_with_metadata(uuid,date,time,text,text,text,numeric,text,numeric,numeric,numeric,numeric,text,text[],text[],text[]) to authenticated;
