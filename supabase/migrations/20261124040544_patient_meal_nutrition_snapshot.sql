-- Immutable snapshot for new personalized assignments; existing rows remain intact.
alter table public.patient_meals add column nutrition_snapshot jsonb
  check (nutrition_snapshot is null or jsonb_typeof(nutrition_snapshot) = 'object');
grant insert (nutrition_snapshot) on public.patient_meals to authenticated;

create function public.assign_personalized_recipe(
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
      'ingredients',jsonb_agg(jsonb_build_object('id',i.id,'name',i.name,'grams',(p_quantities->>i.id)::numeric,'photo_url',i.photo_url) order by i.name)
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
revoke all on function public.assign_personalized_recipe(uuid,date,time,text,jsonb) from public,anon,authenticated;
grant execute on function public.assign_personalized_recipe(uuid,date,time,text,jsonb) to authenticated;

-- Content edits are manual, so do not retain the old recipe snapshot.
create or replace function private.prepare_patient_meal_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.name := btrim(coalesce(new.name, ''), E' \t\r\n');
  new.ingredients := btrim(coalesce(new.ingredients, ''), E' \t\r\n');
  new.notes := btrim(coalesce(new.notes, ''), E' \t\r\n');
  if new.scheduled_time is null or new.scheduled_time >= time '24:00' or extract(second from new.scheduled_time) <> 0 then
    raise exception using errcode='22023', message='Horario de comida inválido';
  end if;
  if (new.name,new.ingredients,new.notes,new.kcal) is distinct from (old.name,old.ingredients,old.notes,old.kcal) then
    new.recipe_id := null;
    new.nutrition_snapshot := null;
  end if;
  new.revision := old.revision + 1;
  return new;
end;
$$;

create or replace function public.copy_patient_meals(p_patient_id uuid,p_source_date date,p_target_date date)
returns integer language plpgsql security invoker set search_path = '' as $$
declare copied integer;
begin
  if p_patient_id is null or p_source_date is null or p_target_date is null or not isfinite(p_source_date)
    or not isfinite(p_target_date) or p_source_date=p_target_date
    or p_target_date <= (now() at time zone 'America/Mexico_City')::date then
    raise exception using errcode='22023', message='Selecciona un día de origen distinto y un destino futuro';
  end if;
  if not exists (select 1 from public.patients p join public.profiles pr on pr.id=p.professional_id and pr.role='PROFESIONAL'
    where p.id=p_patient_id and p.professional_id=auth.uid() and p.status='ACTIVE') then
    raise exception using errcode='42501', message='La ficha no está disponible';
  end if;
  insert into public.patient_meals(patient_id,meal_date,scheduled_time,name,ingredients,notes,kcal,recipe_id,nutrition_snapshot,photo_url)
    select patient_id,p_target_date,scheduled_time,name,ingredients,notes,kcal,recipe_id,nutrition_snapshot,photo_url
    from public.patient_meals where patient_id=p_patient_id and meal_date=p_source_date order by scheduled_time;
  get diagnostics copied = row_count;
  return copied;
end;
$$;
