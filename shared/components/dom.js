// shared/components/dom.js
// Utilidades DOM para crear elementos

/**
 * Crea un elemento DOM con clase y contenido
 * @param {string} tag - Etiqueta HTML
 * @param {string|string[]} className - Clase(s) CSS
 * @param {string|HTMLElement|Array} content - Contenido del elemento
 * @param {Object} attrs - Atributos adicionales
 * @returns {HTMLElement}
 */
export function el(tag, className, content, attrs = {}) {
    const element = document.createElement(tag);
    
    if (className) {
        if (Array.isArray(className)) {
            element.classList.add(...className);
        } else {
            element.className = className;
        }
    }
    
    if (content) {
        if (typeof content === 'string') {
            element.textContent = content;
        } else if (content instanceof HTMLElement) {
            element.appendChild(content);
        } else if (Array.isArray(content)) {
            content.forEach(item => {
                if (item instanceof HTMLElement) {
                    element.appendChild(item);
                } else if (typeof item === 'string') {
                    element.appendChild(document.createTextNode(item));
                }
            });
        }
    }
    
    Object.keys(attrs).forEach(key => {
        if (key === 'style' && typeof attrs[key] === 'object') {
            Object.assign(element.style, attrs[key]);
        } else if (key === 'dataset' && typeof attrs[key] === 'object') {
            Object.assign(element.dataset, attrs[key]);
        } else if (key.startsWith('on') && typeof attrs[key] === 'function') {
            const event = key.slice(2).toLowerCase();
            element.addEventListener(event, attrs[key]);
        } else {
            element.setAttribute(key, attrs[key]);
        }
    });
    
    return element;
}

/**
 * Escapa HTML para prevenir XSS
 * @param {string} str - Texto a escapar
 * @returns {string}
 */
export function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Escapa HTML en un objeto recursivamente
 * @param {any} obj - Objeto a procesar
 * @returns {any}
 */
export function escapeDeep(obj) {
    if (typeof obj === 'string') return escapeHtml(obj);
    if (Array.isArray(obj)) return obj.map(escapeDeep);
    if (obj && typeof obj === 'object') {
        const result = {};
        Object.keys(obj).forEach(key => {
            result[key] = escapeDeep(obj[key]);
        });
        return result;
    }
    return obj;
}

/**
 * Crea un fragmento con varios elementos
 * @param {Array} elements - Elementos a incluir
 * @returns {DocumentFragment}
 */
export function fragment(elements) {
    const frag = document.createDocumentFragment();
    elements.forEach(el => {
        if (el instanceof HTMLElement) {
            frag.appendChild(el);
        } else if (typeof el === 'string') {
            frag.appendChild(document.createTextNode(el));
        }
    });
    return frag;
}

/**
 * Encuentra el primer elemento con selector dentro de un contenedor
 * @param {HTMLElement} container - Contenedor
 * @param {string} selector - Selector CSS
 * @returns {HTMLElement|null}
 */
export function find(container, selector) {
    if (container instanceof HTMLElement) {
        return container.querySelector(selector);
    }
    return document.querySelector(selector);
}

/**
 * Encuentra todos los elementos con selector dentro de un contenedor
 * @param {HTMLElement} container - Contenedor
 * @param {string} selector - Selector CSS
 * @returns {NodeList}
 */
export function findAll(container, selector) {
    if (container instanceof HTMLElement) {
        return container.querySelectorAll(selector);
    }
    return document.querySelectorAll(selector);
}

/**
 * Añade estilos CSS a un elemento
 * @param {HTMLElement} element - Elemento
 * @param {Object} styles - Objeto con estilos
 * @returns {HTMLElement}
 */
export function style(element, styles) {
    Object.assign(element.style, styles);
    return element;
}

/**
 * Añade clases a un elemento
 * @param {HTMLElement} element - Elemento
 * @param {string|Array} classes - Clases a añadir
 * @returns {HTMLElement}
 */
export function addClass(element, classes) {
    if (Array.isArray(classes)) {
        element.classList.add(...classes);
    } else {
        element.classList.add(classes);
    }
    return element;
}

/**
 * Elimina clases de un elemento
 * @param {HTMLElement} element - Elemento
 * @param {string|Array} classes - Clases a eliminar
 * @returns {HTMLElement}
 */
export function removeClass(element, classes) {
    if (Array.isArray(classes)) {
        element.classList.remove(...classes);
    } else {
        element.classList.remove(classes);
    }
    return element;
}

/**
 * Alterna una clase en un elemento
 * @param {HTMLElement} element - Elemento
 * @param {string} className - Clase a alternar
 * @param {boolean} force - Forzar estado
 * @returns {boolean} - Nuevo estado
 */
export function toggleClass(element, className, force) {
    return element.classList.toggle(className, force);
}

/**
 * Establece el contenido HTML de un elemento de forma segura
 * @param {HTMLElement} element - Elemento
 * @param {string} html - HTML a insertar
 */
export function setHtml(element, html) {
    element.innerHTML = html;
}

/**
 * Limpia el contenido de un elemento
 * @param {HTMLElement} element - Elemento
 */
export function empty(element) {
    element.innerHTML = '';
}

/**
 * Elimina un elemento del DOM
 * @param {HTMLElement} element - Elemento a eliminar
 */
export function remove(element) {
    if (element && element.parentNode) {
        element.parentNode.removeChild(element);
    }
}

/**
 * Inserta un elemento después de otro
 * @param {HTMLElement} newEl - Elemento a insertar
 * @param {HTMLElement} refEl - Elemento de referencia
 */
export function insertAfter(newEl, refEl) {
    if (refEl.parentNode) {
        refEl.parentNode.insertBefore(newEl, refEl.nextSibling);
    }
}

/**
 * Inserta un elemento antes de otro
 * @param {HTMLElement} newEl - Elemento a insertar
 * @param {HTMLElement} refEl - Elemento de referencia
 */
export function insertBefore(newEl, refEl) {
    if (refEl.parentNode) {
        refEl.parentNode.insertBefore(newEl, refEl);
    }
}

/**
 * Crea un elemento con evento click
 * @param {string} tag - Etiqueta
 * @param {string} className - Clase
 * @param {string} text - Texto
 * @param {Function} onClick - Función click
 * @param {Object} attrs - Atributos
 * @returns {HTMLElement}
 */
export function button(tag, className, text, onClick, attrs = {}) {
    const btn = el(tag, className, text, { ...attrs, onclick: onClick });
    return btn;
}

/**
 * Crea un enlace
 * @param {string} href - URL
 * @param {string} text - Texto
 * @param {string} className - Clase
 * @param {Object} attrs - Atributos
 * @returns {HTMLElement}
 */
export function link(href, text, className = '', attrs = {}) {
    return el('a', className, text, { href, ...attrs });
}

/**
 * Obtiene datos de un elemento (dataset)
 * @param {HTMLElement} element - Elemento
 * @param {string} key - Clave
 * @returns {string|undefined}
 */
export function getData(element, key) {
    return element.dataset[key];
}

/**
 * Establece datos en un elemento (dataset)
 * @param {HTMLElement} element - Elemento
 * @param {string} key - Clave
 * @param {string} value - Valor
 */
export function setData(element, key, value) {
    element.dataset[key] = value;
}