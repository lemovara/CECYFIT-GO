create table public.food_ingredients (
  id text primary key,
  name text not null,
  photo_url text,
  kcal numeric not null,
  protein numeric not null,
  carbs numeric not null,
  fat numeric not null,
  fiber numeric not null
);
create table public.food_recipes (
  id text primary key,
  title text not null,
  description text not null,
  photo_url text
);
create table public.food_recipe_items (
  recipe_id text references public.food_recipes(id) not null,
  ingredient_id text references public.food_ingredients(id) not null,
  grams integer not null check (grams > 0),
  primary key (recipe_id, ingredient_id)
);

-- Valores aproximados por 100 g de parte comestible, en el estado indicado.
insert into public.food_ingredients (id,name,kcal,protein,carbs,fat,fiber) values
  ('pollo','Pechuga de pollo cruda',120,22.5,0,2.62,0),
  ('arroz','Arroz blanco seco',365,7.13,80,0.66,1.3),
  ('brocoli','Brócoli crudo',34,2.82,6.64,0.37,2.6),
  ('zanahoria','Zanahoria cruda',41,0.93,9.58,0.24,2.8),
  ('avena','Avena seca',379,13.15,67.7,6.52,10.1),
  ('platano','Plátano sin cáscara',89,1.09,22.84,0.33,2.6),
  ('jitomate','Jitomate crudo',18,0.88,3.89,0.2,1.2),
  ('frijol','Frijol negro seco',341,21.6,62.4,1.42,15.5);
insert into public.food_recipes (id,title,description,photo_url) values
  ('pollo-arroz','Pollo con arroz y zanahoria','Pechuga de pollo, arroz blanco y zanahoria. Gramajes antes de cocinar.',null),
  ('pollo-verduras','Pollo con brócoli y zanahoria','Pechuga de pollo con verduras. Gramajes antes de cocinar.',null),
  ('avena-platano','Avena con plátano','Avena medida en seco y plátano sin cáscara.',null),
  ('arroz-verduras','Arroz con brócoli y zanahoria','Arroz y verduras en gramajes previos a la cocción.',null),
  ('frijol-jitomate','Frijoles negros con jitomate','Frijoles medidos en seco y jitomate fresco.',null);
insert into public.food_recipe_items values
  ('pollo-arroz','pollo',140),('pollo-arroz','arroz',65),('pollo-arroz','zanahoria',80),
  ('pollo-verduras','pollo',140),('pollo-verduras','brocoli',100),('pollo-verduras','zanahoria',80),
  ('avena-platano','avena',50),('avena-platano','platano',100),
  ('arroz-verduras','arroz',65),('arroz-verduras','brocoli',100),('arroz-verduras','zanahoria',80),
  ('frijol-jitomate','frijol',75),('frijol-jitomate','jitomate',100);

update public.food_ingredients as catalog set photo_url = image.url from (values
  ('pollo','https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Kycklingfil%C3%A9.jpg/500px-Kycklingfil%C3%A9.jpg'),
  ('arroz','https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/Rice_grains_(IRRI).jpg/500px-Rice_grains_(IRRI).jpg'),
  ('brocoli','https://upload.wikimedia.org/wikipedia/commons/thumb/5/50/Cut_Broccoli.jpg/500px-Cut_Broccoli.jpg'),
  ('zanahoria','https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/Carrots.jpg/500px-Carrots.jpg'),
  ('avena','https://upload.wikimedia.org/wikipedia/commons/thumb/d/df/Rolled_Oats.jpg/500px-Rolled_Oats.jpg'),
  ('platano','https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Banana_(partially_peeled).jpg/500px-Banana_(partially_peeled).jpg'),
  ('jitomate','https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Tomato_(1).jpg/500px-Tomato_(1).jpg'),
  ('frijol','https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Black_beans_(1126927794).jpg/500px-Black_beans_(1126927794).jpg')
) as image(id,url) where image.id = catalog.id;

alter table public.food_ingredients enable row level security;
update public.food_recipes as catalog set photo_url = image.url from (values
  ('pollo-arroz','https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Chicken_and_rice.jpg/500px-Chicken_and_rice.jpg'),
  ('pollo-verduras','https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/Chicken_breast_on_Vegetables.jpg/500px-Chicken_breast_on_Vegetables.jpg'),
  ('avena-platano','https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Banana_oatmeal.jpg/500px-Banana_oatmeal.jpg'),
  ('arroz-verduras','https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Simple_Vegetable_Rice.jpg/500px-Simple_Vegetable_Rice.jpg'),
  ('frijol-jitomate','https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Black_beans_(1126927794).jpg/500px-Black_beans_(1126927794).jpg')
) as image(id,url) where image.id = catalog.id;

alter table public.food_recipes enable row level security;
alter table public.food_recipe_items enable row level security;
revoke all on public.food_ingredients, public.food_recipes, public.food_recipe_items from public, anon, authenticated;
grant select on public.food_ingredients, public.food_recipes, public.food_recipe_items to authenticated;
create policy food_ingredients_read on public.food_ingredients for select to authenticated using (true);
create policy food_recipes_read on public.food_recipes for select to authenticated using (true);
create policy food_recipe_items_read on public.food_recipe_items for select to authenticated using (true);

create view public.recipe_catalog with (security_invoker = true) as
select r.id, r.title, r.description, r.photo_url,
  round(sum(i.kcal * ri.grams / 100), 1) kcal,
  round(sum(i.protein * ri.grams / 100), 1) protein,
  round(sum(i.carbs * ri.grams / 100), 1) carbs,
  round(sum(i.fat * ri.grams / 100), 1) fat,
  round(sum(i.fiber * ri.grams / 100), 1) fiber,
  jsonb_agg(jsonb_build_object('id',i.id,'name',i.name,'photo_url',i.photo_url,'grams',ri.grams) order by i.name) ingredients
from public.food_recipes r
join public.food_recipe_items ri on ri.recipe_id = r.id
join public.food_ingredients i on i.id = ri.ingredient_id
group by r.id,r.title,r.description,r.photo_url;
revoke all on public.recipe_catalog from public, anon, authenticated;
grant select on public.recipe_catalog to authenticated;

alter table public.patient_meals add column recipe_id text references public.food_recipes(id);
grant insert (recipe_id) on public.patient_meals to authenticated;

create function public.assign_catalog_meal(p_patient_id uuid,p_day date,p_time time,p_recipe_id text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare selected public.recipe_catalog%rowtype; new_id uuid;
begin
  if p_day is null or not isfinite(p_day) or p_time is null or p_time >= time '24:00'
    or extract(second from p_time) <> 0 then
    raise exception using errcode='22023', message='Fecha u horario inválido';
  end if;
  select * into selected from public.recipe_catalog where id = p_recipe_id;
  if not found then raise exception using errcode='P0002', message='Receta no disponible'; end if;
  insert into public.patient_meals (patient_id,meal_date,scheduled_time,name,ingredients,notes,kcal,recipe_id)
  values (p_patient_id,p_day,p_time,selected.title,
    (select string_agg(x->>'name' || ' · ' || (x->>'grams') || ' g', chr(10)) from jsonb_array_elements(selected.ingredients) x),
    selected.description,round(selected.kcal)::integer,selected.id)
  returning id into new_id;
  return new_id;
end;
$$;
revoke all on function public.assign_catalog_meal(uuid,date,time,text) from public, anon, authenticated;
grant execute on function public.assign_catalog_meal(uuid,date,time,text) to authenticated;

create or replace function public.copy_patient_meals(
  p_patient_id uuid,
  p_source_date date,
  p_target_date date
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  copied integer;
begin
  if p_patient_id is null or p_source_date is null or p_target_date is null
    or not isfinite(p_source_date) or not isfinite(p_target_date)
    or p_source_date = p_target_date
    or p_target_date <= (now() at time zone 'America/Mexico_City')::date then
    raise exception using errcode = '22023', message = 'Selecciona un día de origen distinto y un destino futuro';
  end if;

  if not exists (
    select 1 from public.patients p join public.profiles pr
      on pr.id = p.professional_id and pr.role = 'PROFESIONAL'
    where p.id = p_patient_id and p.professional_id = auth.uid() and p.status = 'ACTIVE'
  ) then
    raise exception using errcode = '42501', message = 'La ficha no está disponible';
  end if;

  insert into public.patient_meals (patient_id, meal_date, scheduled_time, name, ingredients, notes, kcal, recipe_id)
    select patient_id, p_target_date, scheduled_time, name, ingredients, notes, kcal, recipe_id
    from public.patient_meals
    where patient_id = p_patient_id and meal_date = p_source_date
    order by scheduled_time;
  get diagnostics copied = row_count;
  return copied;
end;
$$;

-- Mantiene el vínculo del catálogo al cambiar el horario. Una personalización
-- del contenido convierte la comida en una entrada manual.
create or replace function private.prepare_patient_meal_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.name := btrim(coalesce(new.name, ''), E' \t\r\n');
  new.ingredients := btrim(coalesce(new.ingredients, ''), E' \t\r\n');
  new.notes := btrim(coalesce(new.notes, ''), E' \t\r\n');
  if new.scheduled_time is null or new.scheduled_time >= time '24:00'
    or extract(second from new.scheduled_time) <> 0 then
    raise exception using errcode = '22023', message = 'Horario de comida inválido';
  end if;
  if (new.name,new.ingredients,new.notes,new.kcal) is distinct from (old.name,old.ingredients,old.notes,old.kcal) then
    new.recipe_id := null;
  end if;
  new.revision := old.revision + 1;
  return new;
end;
$$;

create table public.market_prices (
  account_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  store text not null check (store in ('Soriana','Walmart','Chedraui','Bodega Aurrera','Sam’s Club')),
  branch text not null check (char_length(btrim(branch)) between 1 and 120),
  ingredient_id text references public.food_ingredients(id) not null,
  pack_grams integer not null check (pack_grams between 1 and 100000),
  pack_price numeric(10,2) not null check (pack_price between 0.01 and 100000),
  sold_by_weight boolean not null default false,
  check (not sold_by_weight or pack_grams = 1000),
  observed_on date not null default ((now() at time zone 'America/Mexico_City')::date),
  primary key (account_id,store,branch,ingredient_id)
);
alter table public.market_prices enable row level security;
revoke all on public.market_prices from public, anon, authenticated;
grant select on public.market_prices to authenticated;
grant insert(store,branch,ingredient_id,pack_grams,pack_price,sold_by_weight), update(pack_grams,pack_price,sold_by_weight,observed_on)
  on public.market_prices to authenticated;
create policy market_prices_own on public.market_prices for all to authenticated
  using (account_id = (select auth.uid())) with check (account_id = (select auth.uid()));

create function public.save_market_price(p_store text,p_branch text,p_ingredient_id text,p_grams integer,p_price numeric,p_bulk boolean)
returns void language sql security invoker set search_path = '' as $$
  insert into public.market_prices (store,branch,ingredient_id,pack_grams,pack_price,sold_by_weight)
  values (p_store,lower(btrim(p_branch)),p_ingredient_id,p_grams,p_price,p_bulk)
  on conflict (account_id,store,branch,ingredient_id) do update
    set pack_grams=excluded.pack_grams,pack_price=excluded.pack_price,sold_by_weight=excluded.sold_by_weight,observed_on=excluded.observed_on;
$$;
revoke all on function public.save_market_price(text,text,text,integer,numeric,boolean) from public, anon, authenticated;
grant execute on function public.save_market_price(text,text,text,integer,numeric,boolean) to authenticated;

create table public.market_reference_prices (
  store text not null,
  branch text not null,
  ingredient_id text not null references public.food_ingredients(id),
  display_branch text not null,
  municipality text not null,
  pack_grams integer not null check (pack_grams > 0),
  pack_price numeric(10,2) not null check (pack_price > 0),
  sold_by_weight boolean not null,
  observed_on date not null,
  presentation text not null,
  brand text not null,
  primary key (store,branch,ingredient_id)
);
alter table public.market_reference_prices enable row level security;
revoke all on public.market_reference_prices from public, anon, authenticated;
grant select on public.market_reference_prices to authenticated;
create policy market_reference_read on public.market_reference_prices for select to authenticated using (true);

-- Profeco QQP, Tlaxcala. Archivo 2026/03-2026_Q1.csv del conjunto oficial:
-- https://datos.profeco.gob.mx/docs/qqp/QQP_2026.rar
-- Referencias históricas seleccionadas por supabase/scripts/import-profeco.py.
insert into public.market_reference_prices
  (store,branch,ingredient_id,display_branch,municipality,pack_grams,pack_price,sold_by_weight,observed_on,presentation,brand) values
  ('Bodega Aurrera','bodega aurrera sucursal 5713','arroz','Bodega Aurrera Sucursal 5713','Tlaxcala',900,15,false,'2026-03-12','Bolsa 900 Gr. Extra','Aurrera'),
  ('Bodega Aurrera','bodega aurrera sucursal 5713','avena','Bodega Aurrera Sucursal 5713','Tlaxcala',400,10,false,'2026-03-12','Bolsa 400 Gr.','Granvita'),
  ('Bodega Aurrera','bodega aurrera sucursal 5713','brocoli','Bodega Aurrera Sucursal 5713','Tlaxcala',1000,62,true,'2026-03-12','1 Kg. Granel','S/M'),
  ('Bodega Aurrera','bodega aurrera sucursal 5713','frijol','Bodega Aurrera Sucursal 5713','Tlaxcala',907,25,false,'2026-03-12','Bolsa 907 Gr. Negro. Querétaro','Schettino'),
  ('Bodega Aurrera','bodega aurrera sucursal 5713','jitomate','Bodega Aurrera Sucursal 5713','Tlaxcala',1000,38.9,true,'2026-03-12','1 Kg. Granel. Bola/sinaloa o Tomate Bola','S/M'),
  ('Chedraui','chedraui sucursal apizaco','arroz','Chedraui Sucursal Apizaco','Apizaco',900,16,false,'2026-03-10','Bolsa 900 Gr. Super Extra. Grano Largo','Chedraui'),
  ('Chedraui','chedraui sucursal apizaco','avena','Chedraui Sucursal Apizaco','Apizaco',475,65,false,'2026-03-10','Bote 475 Gr. Hojuela Integral','Quaker Oats'),
  ('Chedraui','chedraui sucursal apizaco','brocoli','Chedraui Sucursal Apizaco','Apizaco',1000,39.9,true,'2026-03-10','1 Kg. Granel','S/M'),
  ('Chedraui','chedraui sucursal apizaco','frijol','Chedraui Sucursal Apizaco','Apizaco',900,19,false,'2026-03-10','Bolsa 900 Gr. Negro','Chedraui'),
  ('Chedraui','chedraui sucursal apizaco','jitomate','Chedraui Sucursal Apizaco','Apizaco',1000,39,true,'2026-03-10','1 Kg. Granel. Saladette/huaje o Tomate Saladette/huaje','S/M'),
  ('Chedraui','chedraui sucursal apizaco','zanahoria','Chedraui Sucursal Apizaco','Apizaco',1000,9,true,'2026-03-10','1 Kg. Granel. Mediana','S/M'),
  ('Soriana','soriana hiper sucursal no. 74','arroz','Soriana Hiper Sucursal No. 74','Tlaxcala',900,15,false,'2026-03-11','Bolsa 900 Gr. Extra. Grano Largo','Precíssimo'),
  ('Soriana','soriana hiper sucursal no. 74','avena','Soriana Hiper Sucursal No. 74','Tlaxcala',400,16.9,false,'2026-03-11','Bolsa 400 Gr.','Granvita'),
  ('Soriana','soriana hiper sucursal no. 74','brocoli','Soriana Hiper Sucursal No. 74','Tlaxcala',1000,60,true,'2026-03-11','1 Kg. Granel','S/M'),
  ('Soriana','soriana hiper sucursal no. 74','frijol','Soriana Hiper Sucursal No. 74','Tlaxcala',908,21,false,'2026-03-11','Bolsa 908 Gr. Negro','Precíssimo'),
  ('Soriana','soriana hiper sucursal no. 74','jitomate','Soriana Hiper Sucursal No. 74','Tlaxcala',1000,27.9,true,'2026-03-11','1 Kg. Granel. Bola/sinaloa o Tomate Bola','S/M'),
  ('Soriana','soriana hiper sucursal no. 74','zanahoria','Soriana Hiper Sucursal No. 74','Tlaxcala',1000,13.8,true,'2026-03-11','1 Kg. Granel. Mediana','S/M'),
  ('Walmart','walmart sucursal el molinito','arroz','Walmart Sucursal el Molinito','Tlaxcala',900,18,false,'2026-03-13','Bolsa 900 Gr. Super Extra','Great Value'),
  ('Walmart','walmart sucursal el molinito','avena','Walmart Sucursal el Molinito','Tlaxcala',400,16,false,'2026-03-13','Bolsa 400 Gr.','Granvita'),
  ('Walmart','walmart sucursal el molinito','brocoli','Walmart Sucursal el Molinito','Tlaxcala',1000,64,true,'2026-03-13','1 Kg. Granel','S/M'),
  ('Walmart','walmart sucursal el molinito','frijol','Walmart Sucursal el Molinito','Tlaxcala',900,23,false,'2026-03-13','Bolsa 900 Gr. Negro','Great Value'),
  ('Walmart','walmart sucursal el molinito','jitomate','Walmart Sucursal el Molinito','Tlaxcala',1000,39.9,true,'2026-03-13','1 Kg. Granel. Bola/sinaloa o Tomate Bola','S/M'),
  ('Walmart','walmart sucursal el molinito','pollo','Walmart Sucursal el Molinito','Tlaxcala',1000,159,true,'2026-03-13','1 Kg. Granel. Pechuga Sin Hueso (Sin Piel)','S/M'),
  ('Walmart','walmart sucursal el molinito','zanahoria','Walmart Sucursal el Molinito','Tlaxcala',1000,10,true,'2026-03-13','1 Kg. Granel. Mediana','S/M'),
  ('Walmart','walmart sucursal parque vertice','arroz','Walmart Sucursal Parque Vertice','Tlaxcala',900,18,false,'2026-03-09','Bolsa 900 Gr. Super Extra','Great Value'),
  ('Walmart','walmart sucursal parque vertice','avena','Walmart Sucursal Parque Vertice','Tlaxcala',400,16,false,'2026-03-09','Bolsa 400 Gr.','Granvita'),
  ('Walmart','walmart sucursal parque vertice','brocoli','Walmart Sucursal Parque Vertice','Tlaxcala',1000,64,true,'2026-03-09','1 Kg. Granel','S/M'),
  ('Walmart','walmart sucursal parque vertice','frijol','Walmart Sucursal Parque Vertice','Tlaxcala',900,23,false,'2026-03-09','Bolsa 900 Gr. Negro','Great Value'),
  ('Walmart','walmart sucursal parque vertice','jitomate','Walmart Sucursal Parque Vertice','Tlaxcala',1000,45,true,'2026-03-09','1 Kg. Granel. Saladette/huaje o Tomate Saladette/huaje','S/M'),
  ('Walmart','walmart sucursal parque vertice','pollo','Walmart Sucursal Parque Vertice','Tlaxcala',1000,162,true,'2026-03-09','1 Kg. Granel. Pechuga Sin Hueso (Sin Piel)','S/M'),
  ('Walmart','walmart sucursal parque vertice','zanahoria','Walmart Sucursal Parque Vertice','Tlaxcala',1000,10,true,'2026-03-09','1 Kg. Granel. Mediana','S/M')
on conflict (store,branch,ingredient_id) do update set
  display_branch=excluded.display_branch, municipality=excluded.municipality, pack_grams=excluded.pack_grams,
  pack_price=excluded.pack_price, sold_by_weight=excluded.sold_by_weight, observed_on=excluded.observed_on,
  presentation=excluded.presentation, brand=excluded.brand
where excluded.observed_on >= market_reference_prices.observed_on;

create table public.patient_care_profiles (
  patient_id uuid primary key references public.patients(id) on delete cascade,
  goal text not null default '' check (char_length(goal) <= 1500),
  restrictions text not null default '' check (char_length(restrictions) <= 1500),
  height_cm numeric(5,1) check (height_cm between 40 and 260),
  weight_kg numeric(5,1) check (weight_kg between 1 and 500)
);
alter table public.patient_care_profiles enable row level security;
revoke all on public.patient_care_profiles from public, anon, authenticated;
grant select, insert on public.patient_care_profiles to authenticated;
grant update (patient_id,goal,restrictions,height_cm,weight_kg) on public.patient_care_profiles to authenticated;
create policy patient_care_read on public.patient_care_profiles for select to authenticated using (
  exists(select 1 from public.patients p where p.id = patient_id)
);
create policy patient_care_manage on public.patient_care_profiles for all to authenticated using (
  exists(select 1 from public.patients p join public.profiles pr on pr.id=p.professional_id
    where p.id=patient_id and p.professional_id=(select auth.uid()) and pr.role='PROFESIONAL' and p.status='ACTIVE')
) with check (
  exists(select 1 from public.patients p join public.profiles pr on pr.id=p.professional_id
    where p.id=patient_id and p.professional_id=(select auth.uid()) and pr.role='PROFESIONAL' and p.status='ACTIVE')
);
