-- A client-generated id makes retries safe if the response is lost.
grant insert(id) on public.patient_messages to authenticated;
create function public.send_patient_message(p_id uuid,p_patient_id uuid,p_body text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare result uuid; content text := btrim(coalesce(p_body,''));
begin
  if p_id is null or p_patient_id is null or char_length(content) not between 1 and 2000 then
    raise exception using errcode='22023', message='Mensaje inválido';
  end if;
  insert into public.patient_messages(id,patient_id,body) values(p_id,p_patient_id,content)
    on conflict(id) do nothing returning id into result;
  if result is null then
    select id into result from public.patient_messages where id=p_id and patient_id=p_patient_id
      and sender_id=(select auth.uid()) and body=content;
    if not found then raise exception using errcode='23505', message='No se pudo registrar el mensaje'; end if;
  end if;
  return result;
end;
$$;
revoke all on function public.send_patient_message(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.send_patient_message(uuid,uuid,text) to authenticated;
