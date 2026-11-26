-- Both operations run in one transaction: a rejected assignment leaves no orphan recipe version.
create function public.create_and_assign_professional_recipe(
  p_patient_id uuid, p_day date, p_time time, p_title text, p_description text, p_quantities jsonb
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare version_id uuid;
begin
  version_id := public.save_professional_recipe(p_title,p_description,p_quantities,null);
  return public.assign_professional_recipe(p_patient_id,p_day,p_time,version_id);
end;
$$;
revoke all on function public.create_and_assign_professional_recipe(uuid,date,time,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.create_and_assign_professional_recipe(uuid,date,time,text,text,jsonb) to authenticated;
