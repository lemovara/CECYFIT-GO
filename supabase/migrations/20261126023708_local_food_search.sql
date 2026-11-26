-- Spanish accent-insensitive search over the existing RLS-protected catalog.
create function public.normalize_food_search(p_text text) returns text
language sql immutable parallel safe set search_path='' as $$
  select pg_catalog.translate(pg_catalog.lower(coalesce(p_text,'')), 'áéíóúüñ', 'aeiouun');
$$;
revoke all on function public.normalize_food_search(text) from public,anon,authenticated;
grant execute on function public.normalize_food_search(text) to authenticated;

create function public.search_catalog_ingredients(p_terms text[]) returns setof public.food_ingredients
language plpgsql stable security invoker set search_path='' as $$
begin
  if p_terms is null or cardinality(p_terms) not between 1 and 6 or exists (
    select 1 from unnest(p_terms) t where t is null or char_length(btrim(t)) not between 2 and 100
  ) then raise exception using errcode='22023',message='Términos de búsqueda inválidos'; end if;
  return query select i.* from public.food_ingredients i where exists (
    select 1 from unnest(p_terms) t where position(public.normalize_food_search(btrim(t)) in public.normalize_food_search(i.name)) > 0
      or position(public.normalize_food_search(btrim(t)) in public.normalize_food_search(i.original_name)) > 0
  ) order by i.name,i.id limit 30;
end;
$$;
revoke all on function public.search_catalog_ingredients(text[]) from public,anon,authenticated;
grant execute on function public.search_catalog_ingredients(text[]) to authenticated;

create function public.search_catalog_recipes(p_terms text[]) returns setof public.recipe_catalog
language plpgsql stable security invoker set search_path='' as $$
begin
  if p_terms is null or cardinality(p_terms) not between 1 and 6 or exists (
    select 1 from unnest(p_terms) t where t is null or char_length(btrim(t)) not between 2 and 100
  ) then raise exception using errcode='22023',message='Términos de búsqueda inválidos'; end if;
  return query select r.* from public.recipe_catalog r where exists (
    select 1 from unnest(p_terms) t where position(public.normalize_food_search(btrim(t)) in public.normalize_food_search(r.title)) > 0
  ) order by r.title,r.id limit 30;
end;
$$;
revoke all on function public.search_catalog_recipes(text[]) from public,anon,authenticated;
grant execute on function public.search_catalog_recipes(text[]) to authenticated;
