import { supabase } from './supabase.js';
const DAY = 86400000;
export function dateAt(month, number) {
  return new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7))-1,number)).toISOString().slice(0,10);
}
export function occurs(row, day) {
  if (day < row.day || (row.until_day && day > row.until_day)) return false;
  if (day === row.day || row.frequency === 'daily') return true;
  if (row.frequency === 'weekly') return (Date.parse(day)-Date.parse(row.day)) % (7*DAY) === 0;
  if (row.frequency === 'monthly') return day.slice(-2) === row.day.slice(-2);
  if (row.frequency === 'yearly') return day.slice(5) === row.day.slice(5);
  return false;
}
/**
 * ¿Está aplicada la 035 (presupuesto, enlace y foto de las sorpresas)?
 *
 * Se pregunta una sola vez por sesión. Un `select` de una columna que no
 * existe responde 42703 en vez de devolver filas vacías, así que la sonda
 * distingue "no hay sorpresas" de "no hay columnas". Un fallo de red no se
 * memoriza: la próxima carga lo vuelve a intentar.
 */
let giftFields = null;
export async function supportsGiftFields() {
  if (giftFields) return true;
  const { error } = await supabase.from('tamp_entries').select('price, link, photo').limit(1);
  if (!error) {
    giftFields = true;
    return true;
  }
  return false;
}

/**
 * ¿Está aplicada la 037 (favorita y estados de compra)?
 *
 * Igual que con los campos de regalo de 035: se pregunta una vez por sesión
 * y un fallo de red no se memoriza. Sin la migración, `starred` no existe y
 * la ficha esconde la favorita.
 */
let giftExtras = null;
export async function supportsGiftExtras() {
  if (giftExtras) return true;
  const { error } = await supabase.from('tamp_entries').select('starred').limit(1);
  if (!error) {
    giftExtras = true;
    return true;
  }
  return false;
}

/**
 * ¿El CHECK de `state` admite «comprar» y «comprado»?
 *
 * La responde la función `tamp_gift_states_supported` de la 039, que lee
 * pg_constraint sin escribir nada. Si la migración no está aplicada la RPC
 * no existe: se devuelve false y la pantalla esconde esos dos estados.
 * Como en las demás sondas, el negativo no se memoriza por si la migración
 * se aplica con la pestaña abierta.
 */
let giftStates = null;
export async function supportsGiftStates() {
  if (giftStates) return true;
  const { data, error } = await supabase.rpc('tamp_gift_states_supported');
  if (!error && data === true) {
    giftStates = true;
    return true;
  }
  return false;
}

/**
 * ¿Están aplicados los campos del organizador de la 046?
 *
 * Ocasión, tienda, precio real, prioridad, enlaces extra, notas y
 * archivado. Igual que las demás sondas: se pregunta una vez por sesión y
 * un fallo de red no se memoriza. Sin ellos la pantalla funciona con los
 * campos de 035/037.
 */
let organizerFields = null;
export async function supportsGiftOrganizer() {
  if (organizerFields) return true;
  const { error } = await supabase
    .from('tamp_entries')
    .select('occasion, store, actual_price, priority, extra_links, notes, archived_at')
    .limit(1);
  if (!error) {
    organizerFields = true;
    return true;
  }
  return false;
}

export async function entries(kind) {
  const rows = [];
  for (let offset=0; ; offset+=500) {
    const {data,error} = await supabase.from('tamp_entries').select('*').eq('kind',kind)
      .order('day',{ascending:false}).order('id').range(offset,offset+499);
    if (error) throw error;
    rows.push(...data);
    if (data.length<500) return rows;
  }
}
export async function writeEntry(kind, values, original) {
  const query = original ? supabase.from('tamp_entries').update(values)
    .eq('kind',kind).eq('id',original.id).eq('updated_at',original.updated_at)
    : supabase.from('tamp_entries').insert({...values,kind});
  const {data,error} = await query.select('id').maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('El registro ha cambiado en otro dispositivo. Actualiza antes de editar.');
}
/** Borrado definitivo de una sorpresa (política `tamp_entries_purge`). */
export async function deleteEntryForever(kind, id) {
  const { data, error } = await supabase
    .from('tamp_entries')
    .delete()
    .eq('kind', kind)
    .eq('id', id)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('No se pudo eliminar el registro');
}

export function nextEvent(rows,today) {
  let best=null;
  for (const row of rows.filter(r=>!r.removed_at && r.kind==='event')) {
    const start=row.day>today?row.day:today;
    const limit=row.frequency==='yearly'?1462:row.frequency==='monthly'?62:row.frequency==='weekly'?7:1;
    for(let i=0;i<limit;i++){
      const day=new Date(Date.parse(start)+i*DAY).toISOString().slice(0,10);
      if ((row.until_day && day>row.until_day)||(best && day>=best.date)) break;
      if (occurs(row,day)) { best={title:row.title,date:day,days:(Date.parse(day)-Date.parse(today))/DAY}; break; }
    }
  }
  return best;
}

