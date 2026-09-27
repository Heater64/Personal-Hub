// Comprueba que una cuenta normal no puede tocar role ni enabled, ni los de
// otra cuenta. Es la ultima pieza sin verificar del modelo de autorizacion.
//
// Todo debe ser RECHAZADO. Si algo se acepta, se revierte al instante con
// service_role y se reporta: el script no deja la base modificada.
//
//   node scripts/verificar-escalada.mjs
//
// Las credenciales se pasan por entorno, NUNCA escritas aqui: este archivo
// vive en un repositorio y unas contrasenas en el fuente son contrasenas
// publicadas.
//   VERIFICAR_A=admin@personalhub.com VERIFICAR_PASS_A=... \
//   VERIFICAR_B=dada@personalhub.com   VERIFICAR_PASS_B=... \
//   node scripts/verificar-escalada.mjs

import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }),
);
const URL = env.VITE_SUPABASE_URL, ANON = env.VITE_SUPABASE_ANON_KEY;
const svc = createClient(URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

if (!process.env.VERIFICAR_A || !process.env.VERIFICAR_PASS_A || !process.env.VERIFICAR_B || !process.env.VERIFICAR_PASS_B) {
  console.error('Faltan credenciales. Define VERIFICAR_A, VERIFICAR_PASS_A, VERIFICAR_B y VERIFICAR_PASS_B.');
  process.exit(1);
}

async function sesion(email, pass) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data } = await c.auth.signInWithPassword({ email, password: pass });
  // updateUser necesita una sesión en memoria, así que se hace sobre el
  // mismo cliente que acaba de entrar: con un cliente aparte daría
  // "Auth session missing!" y la prueba no valdría nada.
  return { id: data.user.id, email, sesion: c, client: createClient(URL, ANON, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
  }) };
}

const admin = await sesion(process.env.VERIFICAR_A, process.env.VERIFICAR_PASS_A);
const dada = await sesion(process.env.VERIFICAR_B, process.env.VERIFICAR_PASS_B);

// Estado de partida, por si hay que revertir.
const { data: perfilAdmin } = await svc.from('profiles').select('role, enabled').eq('id', admin.id).single();
const { data: perfilDada } = await svc.from('profiles').select('role, enabled').eq('id', dada.id).single();
console.log(`partida: admin role=${perfilAdmin.role} enabled=${perfilAdmin.enabled} | dada role=${perfilDada.role} enabled=${perfilDada.enabled}\n`);

const fallos = [];
async function comprobar(desc, fn, revertir) {
  const { ok, msg } = await fn();
  console.log(`  ${ok ? 'RECHAZADO (bien) ' : 'ACEPTADO  <-- FALLO'}  ${desc}${msg ? ' -> ' + msg : ''}`);
  if (!ok) {
    fallos.push(desc);
    if (revertir) { await revertir(); console.log(`     revertido con service_role`); }
  }
}

console.log('=== SU AUTO-PROMOCIÓN (trigger prevent_role_escalation) ===');
await comprobar('dada se pone role=admin a si misma',
  async () => { const r = await dada.client.from('profiles').update({ role: 'admin' }).eq('id', dada.id).select(); return r.error ? { ok: true, msg: r.error.message.slice(0, 45) } : { ok: false, msg: `${r.data?.length ?? 0} fila(s) modificada(s)` }; },
  async () => { await svc.from('profiles').update({ role: perfilDada.role }).eq('id', dada.id); });

await comprobar('dada se desactiva a si misma (enabled=false)',
  async () => { const r = await dada.client.from('profiles').update({ enabled: false }).eq('id', dada.id).select(); return r.error ? { ok: true, msg: r.error.message.slice(0, 45) } : { ok: false, msg: `${r.data?.length ?? 0} fila(s) modificada(s)` }; },
  async () => { await svc.from('profiles').update({ enabled: perfilDada.enabled }).eq('id', dada.id); });

console.log('\n=== TOCAR EL PERFIL DE OTRO (RLS) ===');
await comprobar('dada cambia el enabled de admin',
  async () => { const r = await dada.client.from('profiles').update({ enabled: false }).eq('id', admin.id).select(); return r.data?.length ? { ok: false, msg: `${r.data.length} fila(s)` } : { ok: true, msg: r.error ? r.error.message.slice(0, 40) : '0 filas afectadas' }; },
  async () => { await svc.from('profiles').update({ enabled: perfilAdmin.enabled }).eq('id', admin.id); });

await comprobar('dada cambia el role de admin',
  async () => { const r = await dada.client.from('profiles').update({ role: 'user' }).eq('id', admin.id).select(); return r.data?.length ? { ok: false, msg: `${r.data.length} fila(s)` } : { ok: true, msg: r.error ? r.error.message.slice(0, 40) : '0 filas afectadas' }; },
  async () => { await svc.from('profiles').update({ role: perfilAdmin.role }).eq('id', admin.id); });

console.log('\n=== CONTENIDO (content_update_admin) ===');
await comprobar('dada modifica una fila de content',
  async () => { const r = await dada.client.from('content').update({ updated_at: new Date().toISOString() }).eq('id', 'moods').select(); return r.data?.length ? { ok: false, msg: `${r.data.length} fila(s)` } : { ok: true, msg: r.error ? r.error.message.slice(0, 40) : '0 filas afectadas' }; },
  null);

console.log('\n=== METADATA DE AUTH (trigger protect_user_metadata) ===');
// Se guarda el metadata actual para poder restaurarlo tal cual.
const { data: userDada } = await svc.auth.admin.getUserById(dada.id);
const metaOriginal = userDada?.user?.user_metadata ?? {};
console.log(`  metadata actual de dada: ${JSON.stringify(metaOriginal)}`);
await comprobar('dada escribe role=admin en su user_metadata',
  async () => {
    const r = await dada.sesion.auth.updateUser({ data: { role: 'admin' } });
    if (r.error) return { ok: true, msg: r.error.message.slice(0, 50) };
    // updateUser puede no dar error y aun asi el trigger de
    // protect_user_metadata HAVENDO la clave role del metadata. Eso no es un
    // fallo: es la proteccion funcionando en silencio. Lo que seria un fallo
    // es que el role llegara a guardarse de verdad.
    const { data: despues } = await svc.auth.admin.getUserById(dada.id);
    const guardado = despues?.user?.user_metadata?.role;
    return guardado === 'admin'
      ? { ok: false, msg: 'FALLO: el role se guardó en auth.users' }
      : { ok: true, msg: `escrito sin error, pero la base lo descartó (role = ${guardado})` };
  },
  async () => { await svc.auth.admin.updateUserById(dada.id, { user_metadata: metaOriginal }); console.log(`     metadata restaurado: ${JSON.stringify(metaOriginal)}`); });

console.log(`\n=== ${fallos.length === 0 ? 'MODELO DE ROLES CORRECTO' : fallos.length + ' FALLO(S)'} ===`);
if (fallos.length) console.log(fallos.join('\n'));
process.exit(fallos.length ? 1 : 0);
