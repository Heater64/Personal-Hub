export const DEFAULT_RAZONES = [
  'Por lo lista, lo hermosa y lo increíble que eres.',
  'Por todo lo que me has enseñado y lo que me sigues enseñando cada día.',
  'Por toda la paciencia que tienes conmigo.',
  'Por lo mucho que me cuidas y te preocupas por mí.',
  'Por lo cariñosa que eres en cada momento.',
  'Por lo divertida y graciosa que eres.',
  'Por cómo me miras, como si fuera lo más especial del mundo.',
  'Porque contigo cualquier plan es el mejor plan.',
  'Por cómo haces que los días grises se vuelvan coloridos.',
  'Por tu forma de ser, única e irrepetible.',
  'No son las únicas razones pero así te obligaré a entrar de vez en cuando para ver las nuevas jsjsj',
];

export function normalizeReasons(items) {
  return (Array.isArray(items) ? items : []).flatMap((item, index) => {
    const text = typeof item === 'string' ? item : item?.text || item?.reason;
    if (typeof text !== 'string' || !text.trim()) return [];
    return [{ id: item?.id || `r${index}`, text: text.trim(), date: item?.date || '' }];
  });
}
