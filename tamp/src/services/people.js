/* ==========================================
   Personas de Mis sorpresas

   La lista de personas a las que regalas: nombre, cumpleaños, foto y
   notas. Vive en `tamp_people` (migración 038) y la comparten las dos
   cuentas de la pareja; cada fila la escribe quien la crea.

   Sin la migración aplicada la tabla no existe: `supportsPeople()`
   devuelve false y la pantalla esconde todo lo de personas en vez de
   romperse.
   ========================================== */

import { supabase } from './supabase.js';

let peopleTable = null;

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

export async function listPeople() {
  const { data, error } = await supabase
    .from('tamp_people')
    .select('*')
    .is('removed_at', null)
    .order('name');
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
  const query = original
    ? supabase
        .from('tamp_people')
        .update(values)
        .eq('id', original.id)
        .eq('updated_at', original.updated_at)
    : supabase.from('tamp_people').insert(values);
  const { data, error } = await query.select('id').maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('La persona ha cambiado en otro dispositivo. Actualiza antes de editar.');
}

export async function removePerson(row) {
  const { data, error } = await supabase
    .from('tamp_people')
    .update({ removed_at: new Date().toISOString() })
    .eq('id', row.id)
    .eq('updated_at', row.updated_at)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('La persona ha cambiado en otro dispositivo. Actualiza antes de editar.');
}
