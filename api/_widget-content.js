import { CATEGORIES } from '../personal-hub/src/data/openwhen-categories.data.js';
import { mergeOpenWhenLetters } from '../personal-hub/src/data/openwhen-seed.data.js';
import { DEFAULT_RAZONES, normalizeReasons } from '../personal-hub/src/data/reasons.data.js';
import { reasonOfDay } from '../personal-hub/src/utils/pro-insights.js';
import { OPENWHEN_READ_PREFIX, openWhenReadIds } from '../personal-hub/src/utils/stats-metrics.js';

async function loadContent(db, id) {
  const { data, error } = await db.from('content').select('data').eq('id', id).maybeSingle();
  if (error) throw error;
  return data?.data;
}

export async function getReasonWidget(db, _userId, _profile, today) {
  const content = await loadContent(db, 'razones');
  const reasons = normalizeReasons(content ? content.reasons : DEFAULT_RAZONES);
  const unlocked = reasons.filter(reason => !reason.date || reason.date <= today);
  const pick = reasonOfDay(unlocked, today);
  return pick ? { text: pick.item.text.slice(0, 400), date: pick.date } : null;
}

export async function getOpenWhenWidget(db, userId, profile) {
  const content = await loadContent(db, 'openwhen_letters');
  const letters = mergeOpenWhenLetters(Array.isArray(content?.letters) ? content.letters : []);
  const visible = profile.role === 'admin' ? letters : letters.filter(letter => letter.status !== 'pronto');
  const pending = new Map(visible.map(letter => [String(letter.id), letter]));

  const pageSize = 500;
  for (let offset = 0; pending.size; offset += pageSize) {
    const { data, error } = await db.from('analytics_visits').select('page')
      .eq('user_id', userId).like('page', `${OPENWHEN_READ_PREFIX}%`)
      .order('id').range(offset, offset + pageSize - 1);
    if (error) throw error;
    for (const id of openWhenReadIds(data)) pending.delete(id);
    if ((data?.length || 0) < pageSize) break;
  }

  const entry = pending.values().next().value;
  const category = CATEGORIES.find(item => item.id === entry?.category);
  return { pending: pending.size, category: category?.id || '', emoji: category?.emoji || '' };
}
