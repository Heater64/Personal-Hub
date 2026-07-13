// js/data/giftLoader.js
// Carga gifts desde JSON local o Firebase

const DEFAULT_JSON_PATH = '../data/gifts.json';

let cachedCatalog = null;

export async function loadGiftsCatalog(options = {}) {
    if (cachedCatalog && !options.force) return cachedCatalog;

    if (window.db && options.preferFirebase) {
        try {
            var doc = await window.db.collection('config_gifts').doc('catalog').get();
            if (doc.exists && doc.data().gifts && doc.data().gifts.length) {
                cachedCatalog = normalizeCatalog(doc.data());
                return cachedCatalog;
            }
        } catch (err) {
            console.warn('Firebase gifts fallback a JSON:', err);
        }
    }

    const path = options.jsonPath || DEFAULT_JSON_PATH;
    console.log('📂 Cargando gifts desde:', path);
    
    const res = await fetch(path, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`No se pudo cargar gifts: ${res.status}`);
    const data = await res.json();
    console.log('📦 Datos cargados:', data);
    
    cachedCatalog = normalizeCatalog(data);
    console.log('✅ Catálogo normalizado:', cachedCatalog);
    return cachedCatalog;
}

export function normalizeCatalog(raw) {
    const gifts = raw.gifts || [];
    const giftsById = {};
    gifts.forEach((g) => {
        if (g?.id) giftsById[g.id] = g;
    });

    // Determinar si es formato nuevo (con months) o antiguo (calendarMapping directo)
    const hasMonths = raw.months && typeof raw.months === 'object' && Object.keys(raw.months).length > 0;
    
    let months = {};
    let calendarMapping = {};
    
    if (hasMonths) {
        // Formato nuevo: usar months
        months = raw.months;
        // Extraer el primer mes para compatibilidad
        const firstMonthKey = Object.keys(months)[0];
        if (firstMonthKey) {
            calendarMapping = months[firstMonthKey].calendarMapping || {};
        }
        console.log('📅 Formato multi-mes detectado:', Object.keys(months));
    } else {
        // Formato antiguo: calendarMapping directo
        calendarMapping = raw.calendarMapping || {};
        // Crear un mes por defecto
        const today = new Date();
        const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        months = {
            [defaultMonth]: {
                label: `${monthNames[today.getMonth()]} ${today.getFullYear()}`,
                calendarMapping: calendarMapping
            }
        };
        console.log('📅 Formato antiguo convertido a multi-mes:', defaultMonth);
    }

    return {
        version: raw.version || 1,
        months: months,
        calendarMapping: calendarMapping,
        gifts: gifts,
        giftsById: giftsById
    };
}

export function clearGiftsCache() {
    cachedCatalog = null;
}