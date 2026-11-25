/* ==========================================
   Personas de Mis sorpresas

   La lista de personas a las que regalas: nombre, cumpleaños, foto,
   gustos, intereses, fechas propias y notas.

   Privacidad (migración 046): cada persona pertenece a quien la crea.
   La RLS de `tamp_people` solo devuelve las del usuario autenticado y
   aquí se filtra además por `author_id`: la pantalla nunca depende solo
   de que el servidor se porte bien.

   Sin la migración aplicada la tabla no existe: `supportsPeople()`
   devuelve false y la pantalla esconde todo lo de personas en vez de
   romperse.
   ========================================== */

import { supabase } from './supabase.js';
import { userStore } from '../stores/user.store.js';

let peopleTable = null;
let organizerColumns = null;

const currentUserId = () => userStore.getUser()?.id || null;

/**
 * ¿Está aplicada la 038? Se pregunta en cada carga hasta que la tabla
 * responde: si se aplica la migración con la pestaña abierta, la siguiente
 * carga ya muestra Personas sin recargar la app entera.
 */
export async function supportsPeople() {
  if (peopleTable) return true;
  const { error } = await supabase.from('tamp_people').select('id').limit(1);
  if (!error) {
    peopleTable = true;
    return true;
  }
  return false;
}

/**
 * ¿Está aplicada la 046 (gustos, intereses y fechas propias)? Los campos
 * nuevos son opcionales: si faltan, la ficha los esconde.
 */
export async function supportsPeopleOrganizer() {
  if (organizerColumns) return true;
  const { error } = await supabase
    .from('tamp_people')
    .select('likes, interests, important_dates')
    .limit(1);
  if (!error) {
    organizerColumns = true;
    return true;
  }
  return false;
}

export async function listPeople() {
  const userId = currentUserId();
  let query = supabase.from('tamp_people').select('*').is('removed_at', null);
  if (userId) query = query.eq('author_id', userId);
  const { data, error } = await query.order('name');
  if (error) throw error;
  return data || [];
}

/**
 * ¿Está aplicada la columna `person_id` en las sorpresas?
 *
 * Va en la misma migración que la tabla, pero se pregunta aparte para que
 * un despliegue a medias no rompa la carga de sorpresas.
 */
let personColumn = null;
export async function supportsPersonColumn() {
  if (personColumn) return true;
  const { error } = await supabase.from('tamp_entries').select('person_id').limit(1);
  if (!error) {
    personColumn = true;
    return true;
  }
  return false;
}

export async function savePerson(values, original) {
  const userId = currentUserId();
  if (!userId) throw new Error('Sesión cerrada');
  let query;
  if (original) {
    query = supabase
      .from('tamp_people')
      .update(values)
      .eq('id', original.id)
      .eq('author_id', userId)
      .eq('updated_at', original.updated_at);
  } else {
    // author_id no se envía: su DEFAULT es auth.uid() y la política de
    // INSERT exige que coincida. Así no hace falta conceder la columna.
    query = supabase.from('tamp_people').insert(values);
  }
  const { data, error } = await query.select('id').maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('La persona ha cambiado en otro dispositivo. Actualiza antes de editar.');
}

export async function removePerson(row) {
  const userId = currentUserId();
  if (!userId) throw new Error('Sesión cerrada');
  const { data, error } = await supabase
    .from('tamp_people')
    .update({ removed_at: new Date().toISOString() })
    .eq('id', row.id)
    .eq('author_id', userId)
    .eq('updated_at', row.updated_at)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('La persona ha cambiado en otro dispositivo. Actualiza antes de editar.');
}
