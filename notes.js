// ==========================================
// notes.js · Gestión de notas personales (localStorage)
// Se usa en planner.html y otras páginas con notas.
// ==========================================

// ========== VARIABLES GLOBALES ==========
let currentEditNoteIndex = null;

// ========== CARGAR Y MOSTRAR NOTAS ==========
function loadNotes() {
    const container = document.getElementById('notesList');
    if (!container) return;
    const notes = JSON.parse(localStorage.getItem('notes') || '[]');
    if (notes.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding: var(--space-lg); color: var(--umbra-ash);"><i data-lucide="inbox"></i><p>No hay notas aún. Escribe una.</p></div>';
    } else {
        container.innerHTML = notes.map((note, index) => `
            <div class="note-item" data-index="${index}">
                <div class="note-item-preview">${escapeHtml(note.text.substring(0, 100))}${note.text.length > 100 ? '…' : ''}</div>
                <div class="note-item-footer">
                    <span>${new Date(note.date).toLocaleDateString()}</span>
                    <div class="note-item-actions">
                        <button class="edit-note-btn" data-index="${index}" title="Editar"><i data-lucide="edit-2"></i></button>
                        <button class="delete-note-btn" data-index="${index}" title="Eliminar"><i data-lucide="trash-2"></i></button>
                        <button class="expand-note-btn" data-index="${index}" title="Expandir"><i data-lucide="maximize-2"></i></button>
                    </div>
                </div>
            </div>
        `).join('');
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
    attachNoteEvents();
}

// ========== ASIGNAR EVENTOS A LOS BOTONES DE NOTA ==========
function attachNoteEvents() {
    document.querySelectorAll('.edit-note-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            editNote(parseInt(btn.dataset.index));
        });
    });
    document.querySelectorAll('.delete-note-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteNote(parseInt(btn.dataset.index));
        });
    });
    document.querySelectorAll('.expand-note-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            expandNote(parseInt(btn.dataset.index));
        });
    });
    document.querySelectorAll('.note-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (!e.target.closest('button')) {
                expandNote(parseInt(item.dataset.index));
            }
        });
    });
}

// ========== AÑADIR NUEVA NOTA ==========
function addNote() {
    const textarea = document.getElementById('noteInput');
    if (!textarea || !textarea.value.trim()) return;
    const notes = JSON.parse(localStorage.getItem('notes') || '[]');
    notes.unshift({
        text: textarea.value.trim(),
        date: new Date().toISOString()
    });
    localStorage.setItem('notes', JSON.stringify(notes));
    textarea.value = '';
    loadNotes();
    showMessage('✅ Nota guardada');
}

// ========== ELIMINAR NOTA ==========
function deleteNote(index) {
    const notes = JSON.parse(localStorage.getItem('notes') || '[]');
    notes.splice(index, 1);
    localStorage.setItem('notes', JSON.stringify(notes));
    loadNotes();
    closeNoteLightbox();
    showMessage('🗑️ Nota eliminada');
}

// ========== EDITAR NOTA (abre lightbox) ==========
function editNote(index) {
    const notes = JSON.parse(localStorage.getItem('notes') || '[]');
    if (!notes[index]) return;
    currentEditNoteIndex = index;
    const textarea = document.getElementById('expandedNoteText');
    if (textarea) textarea.value = notes[index].text;
    const lightbox = document.getElementById('noteLightbox');
    if (lightbox) lightbox.classList.add('open');
}

function expandNote(index) {
    editNote(index);
}

// ========== GUARDAR EDICIÓN ==========
function saveNoteEdit() {
    if (currentEditNoteIndex === null) return;
    const textarea = document.getElementById('expandedNoteText');
    if (!textarea) return;
    const newText = textarea.value.trim();
    if (!newText) {
        showMessage('❌ La nota no puede estar vacía', true);
        return;
    }
    const notes = JSON.parse(localStorage.getItem('notes') || '[]');
    if (notes[currentEditNoteIndex]) {
        notes[currentEditNoteIndex].text = newText;
        notes[currentEditNoteIndex].date = new Date().toISOString();
        localStorage.setItem('notes', JSON.stringify(notes));
        showMessage('✏️ Nota actualizada');
    }
    closeNoteLightbox();
    loadNotes();
}

// ========== ELIMINAR DESDE LIGHTBOX ==========
function deleteCurrentNoteFromLightbox() {
    if (currentEditNoteIndex !== null) {
        deleteNote(currentEditNoteIndex);
    }
    closeNoteLightbox();
}

// ========== CERRAR LIGHTBOX DE NOTA ==========
function closeNoteLightbox() {
    const lightbox = document.getElementById('noteLightbox');
    if (lightbox) lightbox.classList.remove('open');
    currentEditNoteIndex = null;
    const textarea = document.getElementById('expandedNoteText');
    if (textarea) textarea.value = '';
}

// ========== INICIALIZACIÓN ==========
document.addEventListener('DOMContentLoaded', () => {
    const addBtn = document.getElementById('addNoteBtn');
    if (addBtn) addBtn.addEventListener('click', addNote);
    const saveEditBtn = document.getElementById('saveNoteEditBtn');
    if (saveEditBtn) saveEditBtn.addEventListener('click', saveNoteEdit);
    const deleteFromLightboxBtn = document.getElementById('deleteNoteFromLightboxBtn');
    if (deleteFromLightboxBtn) deleteFromLightboxBtn.addEventListener('click', deleteCurrentNoteFromLightbox);
    const lightbox = document.getElementById('noteLightbox');
    if (lightbox) {
        lightbox.addEventListener('click', (e) => {
            if (e.target === lightbox) closeNoteLightbox();
        });
    }
});