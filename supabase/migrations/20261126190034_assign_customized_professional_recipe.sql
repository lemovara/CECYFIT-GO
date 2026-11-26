-- Saving the derived version and publishing it to a patient is atomic.
create function public.assign_customized_professional_recipe(
  p_patient_id uuid, p_day date, p_time time, p_version_id uuid, p_quantities jsonb
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare source public.professional_recipe_versions%rowtype; photo text; version_id uuid;
begin
  select * into source from public.professional_recipe_versions where id = p_version_id;
  if not found then raise exception using errcode='P0002', message='Receta no disponible'; end if;
  select photo_url into photo from public.professional_recipe_photos where professional_recipe_photos.version_id = source.id;
  version_id := public.save_professional_recipe_with_photo(source.title,source.description,p_quantities,source.id,photo);
  return public.assign_scaled_professional_recipe(p_patient_id,p_day,p_time,version_id,1);
end;
$$;
revoke all on function public.assign_customized_professional_recipe(uuid,date,time,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.assign_customized_professional_recipe(uuid,date,time,uuid,jsonb) to authenticated;
