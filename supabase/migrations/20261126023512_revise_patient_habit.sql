-- Preserve existing logs by replacing an active habit atomically with a new one.
create function public.revise_patient_habit(p_patient_id uuid,p_habit_id uuid,p_title text,p_description text,p_goal text,p_weekdays smallint[])
returns uuid language plpgsql security invoker set search_path='' as $$
declare old_id uuid; new_id uuid;
begin
  if p_patient_id is null or p_habit_id is null or char_length(btrim(coalesce(p_title,''))) not between 1 and 120
    or char_length(coalesce(p_description,''))>500 or char_length(coalesce(p_goal,''))>120
    or p_weekdays is null or cardinality(p_weekdays) not between 1 and 7
    or not (p_weekdays <@ array[1,2,3,4,5,6,7]::smallint[]) or array_position(p_weekdays,null) is not null then
    raise exception using errcode='22023',message='Datos del hábito inválidos';
  end if;
  update public.patient_habits set active=false where id=p_habit_id and patient_id=p_patient_id and active returning id into old_id;
  if old_id is null then raise exception using errcode='42501',message='Hábito activo no disponible'; end if;
  insert into public.patient_habits(patient_id,title,description,goal,weekdays)
    values(p_patient_id,btrim(p_title),btrim(coalesce(p_description,'')),btrim(coalesce(p_goal,'')),p_weekdays)
    returning id into new_id;
  return new_id;
end;
$$;
revoke all on function public.revise_patient_habit(uuid,uuid,text,text,text,smallint[]) from public,anon,authenticated;
grant execute on function public.revise_patient_habit(uuid,uuid,text,text,text,smallint[]) to authenticated;
