"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Panel } from "@/components/cecyfit/ui";
import { supabase } from "@/lib/supabase/clients";
type Message = { id: string; sender_id: string; body: string; created_at: string };
export function PatientChat({ patientId }: { patientId: string }) {
 const [messages,setMessages]=useState<Message[]>([]); const [body,setBody]=useState(""); const [error,setError]=useState(""); const [busy,setBusy]=useState(false); const [userId,setUserId]=useState(""); const [attempt,setAttempt]=useState(0);
 const pendingSend=useRef<{patientId:string; text:string; id:string} | null>(null);
 useEffect(() => { let active=true; async function load() { const {data,error}=await supabase.from("patient_messages").select("id,sender_id,body,created_at").eq("patient_id",patientId).order("created_at",{ascending:false}).limit(100); if(active) { if(error) setError("No se pudieron cargar los mensajes."); else {setMessages((data as Message[]).reverse()); setError("");} } } void load(); const timer=setInterval(() => void load(),10000); void supabase.auth.getUser().then(({data}) => {if(active)setUserId(data.user?.id ?? "");}); return () => {active=false;clearInterval(timer);}; },[patientId,attempt]);
 async function send(e: FormEvent) {
  e.preventDefault(); if(busy || !body.trim()) return;
  const text=body.trim(); const entry=pendingSend.current?.patientId===patientId && pendingSend.current.text===text ? pendingSend.current : {patientId,text,id:crypto.randomUUID()};
  pendingSend.current=entry; setBusy(true); const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),8000);
  try { const {error}=await supabase.rpc('send_patient_message',{p_id:entry.id,p_patient_id:patientId,p_body:text}).abortSignal(controller.signal); if(error) throw error;
    pendingSend.current=null;setBody(current=>current.trim()===text?'':current);setError('');setAttempt(v=>v+1);
  } catch {setError('No se confirmó el envío. Puedes reintentar el mismo mensaje.');} finally {clearTimeout(timer);setBusy(false);}
 }
 return <Panel title="Chat con el paciente"><div className="max-h-80 space-y-2 overflow-y-auto">{messages.length===0 && <p>Sin mensajes.</p>}{messages.map(m=><div className="rounded-lg bg-fill p-3" key={m.id}><strong>{m.sender_id===userId ? "Tú" : "Paciente"}</strong><p className="whitespace-pre-wrap">{m.body}</p><small>{new Date(m.created_at).toLocaleString("es-MX")}</small></div>)}</div>{error && <p role="alert">{error}</p>}<form onSubmit={send} className="mt-3 flex gap-2"><input aria-label="Mensaje" value={body} onChange={e=>setBody(e.target.value)} maxLength={2000} className="w-full rounded-lg border p-2" placeholder="Escribe un mensaje"/><button disabled={busy || !body.trim()} className="rounded-lg bg-blue p-2 text-white disabled:opacity-50">Enviar</button></form></Panel>;
}
