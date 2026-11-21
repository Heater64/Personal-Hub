/* ==========================================
   Campos de fecha en formato español
   ==========================================
   Los <input type="date"> los rotula el navegador en el idioma del sistema:
   con el equipo en inglés se leen mes/día/año. Aquí el campo visible pasa a
   ser un texto «dd/mm/aaaa» (o «dd/mm/aaaa hh:mm») y el input original, ya
   oculto, sigue guardando el ISO de siempre. Así el resto de la aplicación
   lee y escribe `.value` igual que antes.
   ========================================== */

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const pad2 = value => String(value).padStart(2, '0');

/** «2026-11-18» → «18/11/2026». */
export function isoToDisplay(iso) {
  const match = ISO_RE.exec(String(iso || '').trim());
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
}

/** «2026-11-18T20:30» → «18/11/2026 20:30». */
export function isoDateTimeToDisplay(value) {
  const [date, time = ''] = String(value || '')
    .trim()
    .split('T');
  const display = isoToDisplay(date);
  return display && time ? `${display} ${time.slice(0, 5)}` : display;
}

/**
 * Texto escrito por la persona → ISO.
 * Acepta «18/11/2026», «18-11-26», «18.11.2026» o el propio ISO.
 * Devuelve '' si está vacío y null si no es una fecha real.
 */
export function displayToISO(text) {
  const raw = String(text || '').trim();
  if (!raw) return '';
  const parts = raw.split(/[^\d]+/).filter(Boolean);
  if (parts.length !== 3) return null;
  let [a, b, c] = parts;
  let day;
  let month;
  let year;
  if (a.length === 4) [year, month, day] = [a, b, c];
  else [day, month, year] = [a, b, c];
  if (year.length === 2) year = `20${year}`;
  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  if (!Number.isInteger(d) || !Number.isInteger(m) || !Number.isInteger(y)) return null;
  if (y < 1900 || y > 2999 || m < 1 || m > 12 || d < 1) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    return null;
  }
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

/**
 * Mientras se escribe, las barras salen solas: en el móvil el teclado
 * numérico no tiene «/». «18112026» → «18/11/2026».
 */
export function maskDateInput(raw, { withTime = false } = {}) {
  const source = String(raw || '');
  const digits = source.replace(/\D/g, '').slice(0, withTime ? 12 : 8);
  let text = digits;
  if (digits.length > 2) text = `${digits.slice(0, 2)}/${digits.slice(2, 4)}`;
  if (digits.length > 4) text = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
  if (withTime && digits.length > 8) {
    text += ` ${digits.slice(8, 10)}`;
    if (digits.length > 10) text += `:${digits.slice(10, 12)}`;
  }
  // Si acaba de teclear el separador, se respeta: ayuda a seguir.
  const trailing = /[^\d]$/.test(source);
  if (trailing && (digits.length === 2 || digits.length === 4) && !text.endsWith('/')) {
    text += '/';
  }
  return text;
}

/**
 * Texto con hora opcional → valor de `datetime-local`.
 * «18/11/2026 20:30» → «2026-11-18T20:30»; sin hora, a medianoche.
 */
export function displayToDateTime(text, { withTime = true } = {}) {
  const raw = String(text || '').trim();
  if (!raw) return '';
  const [, datePart, hours, minutes] = raw.match(/^(.+?)(?:\s+(\d{1,2}):(\d{2}))?$/) || [];
  const iso = displayToISO(datePart ?? raw);
  if (!iso) return iso;
  if (!withTime) return iso;
  const h = Number(hours);
  const min = Number(minutes);
  if (hours == null || !Number.isInteger(h) || h > 23 || min > 59) return `${iso}T00:00`;
  return `${iso}T${pad2(h)}:${pad2(min)}`;
}

/** Convierte cada campo de fecha de `root` en un texto español. */
export function upgradeDateFields(root = document) {
  if (!root || typeof root.querySelectorAll !== 'function') return 0;
  if (typeof document === 'undefined' || typeof HTMLInputElement === 'undefined') return 0;

  const native = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  if (!native) return 0;

  let count = 0;
  root.querySelectorAll('input[type="date"], input[type="datetime-local"]').forEach(input => {
    if (input.dataset.datefieldReady === '1') return;
    input.dataset.datefieldReady = '1';
    count += 1;

    const withTime = input.type === 'datetime-local';
    const readValue = () => native.get.call(input);
    const writeRaw = value => native.set.call(input, value == null ? '' : String(value));
    const toDisplay = value => (withTime ? isoDateTimeToDisplay(value) : isoToDisplay(value));
    const toValue = text => (withTime ? displayToDateTime(text) : displayToISO(text));

    const text = document.createElement('input');
    text.type = 'text';
    text.className = `${input.className} datefield-input`.trim();
    text.inputMode = 'numeric';
    text.autocomplete = 'off';
    text.maxLength = withTime ? 16 : 10;
    text.placeholder = withTime ? 'dd/mm/aaaa hh:mm' : 'dd/mm/aaaa';
    text.value = toDisplay(readValue());
    const label = input.getAttribute('aria-label');
    if (label) text.setAttribute('aria-label', label);
    if (input.hasAttribute('title')) text.title = input.title;
    // El campo visible es el que se valida; el original, oculto, no debe bloquear.
    if (input.hasAttribute('required')) {
      text.required = true;
      input.removeAttribute('required');
    }

    text.addEventListener('input', () => {
      const masked = maskDateInput(text.value, { withTime });
      if (masked !== text.value) text.value = masked;
      const value = toValue(masked);
      writeRaw(value || '');
      text.setAttribute('aria-invalid', value === null ? 'true' : 'false');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    text.addEventListener('change', () => {
      const value = toValue(text.value);
      if (value) text.value = toDisplay(value);
      text.setAttribute('aria-invalid', value === null ? 'true' : 'false');
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    input.hidden = true;
    input.tabIndex = -1;
    input.setAttribute('aria-hidden', 'true');
    input.parentNode?.insertBefore(text, input);

    // Quien escriba el valor desde el código (al cargar los datos) mueve el texto.
    Object.defineProperty(input, 'value', {
      configurable: true,
      get() {
        return native.get.call(input);
      },
      set(next) {
        native.set.call(input, next == null ? '' : String(next));
        text.value = toDisplay(native.get.call(input));
      },
    });
  });

  return count;
}

/** Repasa lo que ya está en pantalla y lo que se pinte después. */
export function watchDateFields() {
  if (typeof document === 'undefined' || !document.body) return;
  upgradeDateFields(document);
  new MutationObserver(() => upgradeDateFields(document)).observe(document.body, {
    childList: true,
    subtree: true,
  });
}
