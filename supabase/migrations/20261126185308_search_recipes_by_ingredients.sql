-- Every word in any supplied alternative must match the same food or recipe.
-- Keep SECURITY INVOKER so the existing catalog policies apply.
create or replace function public.search_catalog_ingredients(p_terms text[]) returns setof public.food_ingredients
language plpgsql stable security invoker set search_path='' as $$
begin
  if p_terms is null or cardinality(p_terms) not between 1 and 6 or exists (
    select 1 from unnest(p_terms) t where t is null or char_length(btrim(t)) not between 2 and 100
  ) then raise exception using errcode='22023',message='Términos de búsqueda inválidos'; end if;
  return query select i.* from public.food_ingredients i where exists (
    select 1 from unnest(p_terms) t where not exists (
      select 1 from pg_catalog.regexp_split_to_table(public.normalize_food_search(btrim(t)), '\s+') word
      where position(word in public.normalize_food_search(coalesce(i.name,'') || ' ' || coalesce(i.original_name,''))) = 0
    )
  ) order by i.name,i.id limit 30;
end;
$$;

create or replace function public.search_catalog_recipes(p_terms text[]) returns setof public.recipe_catalog
language plpgsql stable security invoker set search_path='' as $$
begin
  if p_terms is null or cardinality(p_terms) not between 1 and 6 or exists (
    select 1 from unnest(p_terms) t where t is null or char_length(btrim(t)) not between 2 and 100
  ) then raise exception using errcode='22023',message='Términos de búsqueda inválidos'; end if;
  return query select r.* from public.recipe_catalog r where exists (
    select 1 from unnest(p_terms) t where not exists (
      select 1 from pg_catalog.regexp_split_to_table(public.normalize_food_search(btrim(t)), '\s+') word
      where position(word in public.normalize_food_search(coalesce(r.title,'') || ' ' || coalesce(r.description,'') || ' ' || coalesce((
        select string_agg(item->>'name',' ') from pg_catalog.jsonb_array_elements(r.ingredients) item
      ),''))) = 0
    )
  ) order by r.title,r.id limit 30;
end;
$$;
