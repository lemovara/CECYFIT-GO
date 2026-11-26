-- Keep the privileged implementation outside PostgREST's exposed schema.
create schema if not exists nutrition_internal;
revoke all on schema nutrition_internal from public, anon, authenticated;
grant usage on schema nutrition_internal to authenticated;
alter default privileges in schema nutrition_internal revoke execute on functions from public;
alter function public.save_professional_recipe(text,text,jsonb,uuid) set schema nutrition_internal;
revoke all on function nutrition_internal.save_professional_recipe(text,text,jsonb,uuid) from public, anon, authenticated;
grant execute on function nutrition_internal.save_professional_recipe(text,text,jsonb,uuid) to authenticated;

create function public.save_professional_recipe(p_title text,p_description text,p_quantities jsonb,p_parent_version uuid default null)
returns uuid language sql security invoker set search_path = '' as $$
  select nutrition_internal.save_professional_recipe(p_title,p_description,p_quantities,p_parent_version);
$$;
revoke all on function public.save_professional_recipe(text,text,jsonb,uuid) from public, anon, authenticated;
grant execute on function public.save_professional_recipe(text,text,jsonb,uuid) to authenticated;
