// ==========================================
// planner.js · notas y regalos
// ==========================================
let currentEditNoteIndex = null;

function loadNotes() {
    const container = document.getElementById('notesList');
    if (!container) return;
    const notes = JSON.parse(localStorage.getItem('notes') || '[]');
    if (notes.length === 0) {
        container.innerHTML = '<div class="empty-state"><i data-lucide="inbox"></i><p>No hay notas aun. Escribe una.</p></div>';
    } else {
        container.innerHTML = notes.map((note, index) => `
            <div class="note-item" data-index="${index}">
                <div class="note-item-preview">${escapeHtml(note.text.substring(0, 100))}${note.text.length > 100 ? '...' : ''}</div>
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

function attachNoteEvents() {
    document.querySelectorAll('.edit-note-btn').forEach(btn => {
        btn.addEventListener('click', function (event) {
            event.stopPropagation();
            editNote(Number(btn.dataset.index));
        });
    });
    document.querySelectorAll('.delete-note-btn').forEach(btn => {
        btn.addEventListener('click', function (event) {
            event.stopPropagation();
            deleteNote(Number(btn.dataset.index));
        });
    });
    document.querySelectorAll('.expand-note-btn').forEach(btn => {
        btn.addEventListener('click', function (event) {
            event.stopPropagation();
            expandNote(Number(btn.dataset.index));
        });
    });
    document.querySelectorAll('.note-item').forEach(item => {
        item.addEventListener('click', function (event) {
            if (!event.target.closest('button')) {
                expandNote(Number(item.dataset.index));
            }
        });
    });
}

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
    showMessage('Nota guardada');
}

function deleteNote(index) {
    const notes = JSON.parse(localStorage.getItem('notes') || '[]');
    notes.splice(index, 1);
    localStorage.setItem('notes', JSON.stringify(notes));
    loadNotes();
    closeNoteLightbox();
    showMessage('Nota eliminada');
}

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

function saveNoteEdit() {
    if (currentEditNoteIndex === null) return;
    const textarea = document.getElementById('expandedNoteText');
    if (!textarea) return;
    const newText = textarea.value.trim();
    if (!newText) {
        showMessage('La nota no puede estar vacia', true);
        return;
    }

    const notes = JSON.parse(localStorage.getItem('notes') || '[]');
    if (notes[currentEditNoteIndex]) {
        notes[currentEditNoteIndex].text = newText;
        notes[currentEditNoteIndex].date = new Date().toISOString();
        localStorage.setItem('notes', JSON.stringify(notes));
        showMessage('Nota actualizada');
    }
    closeNoteLightbox();
    loadNotes();
}

function deleteCurrentNoteFromLightbox() {
    if (currentEditNoteIndex !== null) {
        deleteNote(currentEditNoteIndex);
    }
    closeNoteLightbox();
}

function closeNoteLightbox() {
    const lightbox = document.getElementById('noteLightbox');
    if (lightbox) lightbox.classList.remove('open');
    currentEditNoteIndex = null;
    const textarea = document.getElementById('expandedNoteText');
    if (textarea) textarea.value = '';
}

function initPlanner() {
    if (!document.getElementById('notesList')) return;
    loadNotes();

    const addBtn = document.getElementById('addNoteBtn');
    const noteInput = document.getElementById('noteInput');
    const saveEditBtn = document.getElementById('saveNoteEditBtn');
    const deleteBtn = document.getElementById('deleteNoteFromLightboxBtn');
    const lightbox = document.getElementById('noteLightbox');

    if (addBtn) addBtn.addEventListener('click', addNote);
    if (noteInput) {
        noteInput.addEventListener('keydown', function (event) {
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') addNote();
        });
    }
    if (saveEditBtn) saveEditBtn.addEventListener('click', saveNoteEdit);
    if (deleteBtn) deleteBtn.addEventListener('click', deleteCurrentNoteFromLightbox);
    if (lightbox) {
        lightbox.addEventListener('click', function (event) {
            if (event.target === lightbox) {
                closeNoteLightbox();
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', initPlanner);

window.closeNoteLightbox = closeNoteLightbox;
