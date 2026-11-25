/* ==========================================
   Presupuesto de Mis sorpresas

   Una fila por usuario en `tamp_gift_settings` (migración 046). La RLS
   solo devuelve la del usuario autenticado; además se filtra por
   `author_id` para no depender únicamente de la política.

   Sin la migración aplicada la tabla no existe: `supportsGiftSettings()`
   devuelve false y la pantalla esconde el presupuesto configurable.
   ========================================== */

import { supabase } from './supabase.js';
import { userStore } from '../stores/user.store.js';

let settingsTable = null;

const currentUserId = () => userStore.getUser()?.id || null;

export async function supportsGiftSettings() {
  if (settingsTable) return true;
  const { error } = await supabase.from('tamp_gift_settings').select('author_id').limit(1);
  if (!error) {
    settingsTable = true;
    return true;
  }
  return false;
}

export async function getGiftSettings() {
  const userId = currentUserId();
  if (!userId) return { monthly_budget: null };
  const { data, error } = await supabase
    .from('tamp_gift_settings')
    .select('monthly_budget')
    .eq('author_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data || { monthly_budget: null };
}

export async function saveMonthlyBudget(value) {
  const userId = currentUserId();
  if (!userId) throw new Error('Sesión cerrada');
  const budget = value === '' || value == null ? null : Number(value);
  if (budget != null && (!Number.isFinite(budget) || budget < 0)) {
    throw new Error('El presupuesto no puede ser negativo');
  }
  const { error } = await supabase
    .from('tamp_gift_settings')
    .upsert({ author_id: userId, monthly_budget: budget }, { onConflict: 'author_id' });
  if (error) throw error;
  return budget;
}
