/* ==========================================
   sync.service.js — Sincronización cross-device
   (local-first sobre la tabla `content` de Supabase)

   Cada sección mantiene su copia de trabajo en localStorage
   (lectura instantánea y offline) y se sincroniza con una fila
   de la tabla `content` (id = clave de la sección), la misma
   que ya usan audios / series / fechas importantes. Así lo
   subido en el móvil aparece en el PC (y viceversa) sin tocar
   SQL: la tabla, la RLS (admin escribe, todos leen) y Realtime
   ya existen.

   POLÍTICA DE CONFLICTOS — last-write-wins:     · El cliente NUNCA pisa el remoto sin una mutación local
     (flag dirty): un dispositivo nuevo solo hace pull. Sin esto,
     el PC con el almacén vacío sobrescribiría lo subido en el móvil.
   · Si ambos cambiaron, gana el remoto (no se pierde la verdad
     compartida; la copia local pendiente se descarta).
   · Sin conexión: el flag dirty queda pendiente y el push se
     reintenta en el siguiente hydrate() (cola offline).

   API por sección: createSyncStore({ id, readLocal, writeLocal })
   → { hydrate(), push(), markDirty() }
   ========================================== */

import { supabase } from './supabase.js';
import { auth } from './auth.service.js';
import { db } from './db.service.js';

const lastKey = (id) => `ph.sync.${id}.last`;   // updated_at (server) de la última sync
const dirtyKey = (id) => `ph.sync.${id}.dirty`; // hay cambios locales sin subir

const timers = {};

/** ¿El dato contiene algo real (arrays con elementos, objetos no vacíos)? */
function hasData(data) {
  if (data == null) return false;
  if (Array.isArray(data)) return data.length > 0;
  if (typeof data === 'object') {
    return Object.values(data).some(v => Array.isArray(v) ? v.length > 0 : hasData(v));
  }
  return data !== '' && data != null;
}

export function createSyncStore({ id, readLocal, writeLocal, adminOnly = true, log = true }) {
  const ls = {
    get last() { try { return localStorage.getItem(lastKey(id)) || ''; } catch { return ''; } },
    set last(v) { try { localStorage.setItem(lastKey(id), v); } catch { /* cuota */ } },
    get dirty() { try { return localStorage.getItem(dirtyKey(id)) === '1'; } catch { return false; } },
    set dirty(v) { try { v ? localStorage.setItem(dirtyKey(id), '1') : localStorage.removeItem(dirtyKey(id)); } catch { /* cuota */ } }
  };

  /**
   * Sube la copia local a Supabase (fila content). El cliente escribe
   * updated_at (ISO) para que el upsert en conflicto lo refresque y los
   * demás dispositivos detecten el cambio. Devuelve true si se subió.
   */
  async function push(force = false) {
    if (!db.isSupabaseConfigured()) return false;
    const data = readLocal();
    if (!force && !ls.dirty && !hasData(data)) return false; // nada que enviar
    if (adminOnly) {
      if (!auth.isAdmin()) {
        await auth.refreshRole();
        if (!auth.isAdmin()) return false; // dada nunca sube contenido del admin
      }
    }
    try {
      // updated_at EXPLÍCITO: el DEFAULT NOW() solo aplica en INSERT y el
      // upsert en conflicto no lo refrescaría, rompiendo la detección de
      // cambios cross-device (mismo patrón que db.saveContent).
      const { data: row, error } = await supabase
        .from('content')
        .upsert({ id, data, updated_at: new Date().toISOString() }, { onConflict: 'id' })
        .select('updated_at')
        .single();
      if (error) throw error;
      ls.last = row?.updated_at ? String(row.updated_at) : new Date().toISOString();
      ls.dirty = false;
      return true;
    } catch (err) {
      if (log) console.warn(`[sync] push "${id}" falló (se reintentará):`, err.message);
      ls.dirty = true; // cola offline: reintento en el próximo hydrate
      return false;
    }
  }

  /**
   * Sincroniza con el servidor (pull o push según corresponda).
   * Devuelve { changed, data } — changed=true si la copia local cambió
   * (la página puede re-renderizar).
   */
  async function hydrate() {
    if (!db.isSupabaseConfigured()) return { changed: false, data: readLocal() };

    let remote = null;
    try {
      const { data, error } = await supabase
        .from('content')
        .select('id, data, updated_at')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      remote = data || null;
    } catch (err) {
      if (log) console.warn(`[sync] hydrate "${id}" sin red:`, err.message);
      return { changed: false, data: readLocal() };
    }

    const remoteTs = remote?.updated_at ? String(remote.updated_at) : '';

    // 1. No existe fila remota → migración local→remoto (una sola vez)
    if (!remote) {
      if (ls.dirty || hasData(readLocal())) {
        ls.dirty = true;
        await push(true);
      }
      return { changed: false, data: readLocal() };
    }

    // 2. Hay cambios locales pendientes
    if (ls.dirty) {
      // Conflicto: otro dispositivo cambió después de nuestra última sync → gana remoto
      if (ls.last && remoteTs > ls.last) {
        writeLocal(remote.data);
        ls.last = remoteTs;
        ls.dirty = false;
        return { changed: true, data: readLocal() };
      }
      // Solo cambiamos nosotros → subimos
      await push(true);
      return { changed: false, data: readLocal() };
    }

    // 3. Sin cambios pendientes: pull si el remoto es más nuevo
    if (!ls.last || remoteTs > ls.last) {
      // Regla de seguridad (migración): un remoto VACÍO nunca pisa datos
      // locales reales que existan desde antes de la sincronización.
      // Ej.: el PC lleva años con sus mundos en localStorage y el remoto
      // está vacío → subimos lo local en vez de borrarlo.
      if (!hasData(remote.data) && hasData(local) && !ls.last) {
        ls.dirty = true;
        await push(true);
        return { changed: false, data: readLocal() };
      }
      writeLocal(remote.data);
      ls.last = remoteTs;
      return { changed: true, data: readLocal() };
    }

    return { changed: false, data: readLocal() };
  }

  /** Marca que hubo una mutación local y programa el push (debounce). */
  function markDirty() {
    ls.dirty = true;
    if (timers[id]) clearTimeout(timers[id]);
    timers[id] = setTimeout(() => {
      timers[id] = null;
      push();
    }, 800);
  }

  return { hydrate, push, markDirty, get: readLocal };
}
