// js/pages/admin.js
// Panel de administración - CRUD completo

var AdminApp = (function () {
    var state = {
        currentSection: 'dashboard',
        editingId: null,
        editingType: null
    };

    // ==========================================
    // UTILIDADES
    // ==========================================

    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/[&<>"]/g, function (m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            if (m === '"') return '&quot;';
            return m;
        });
    }

    function showToast(msg, isError) {
        if (typeof window.showToast === 'function') {
            window.showToast(msg, isError);
        }
    }

    // ==========================================
    // NAVEGACIÓN POR TABS
    // ==========================================

    function initTabs() {
        var tabs = document.querySelectorAll('.admin-tab');
        tabs.forEach(function (tab) {
            tab.addEventListener('click', function () {
                var section = tab.dataset.section;
                switchSection(section);
            });
        });
    }

    function switchSection(section) {
        state.currentSection = section;

        // Actualizar tabs
        document.querySelectorAll('.admin-tab').forEach(function (t) {
            t.classList.toggle('active', t.dataset.section === section);
        });

        // Actualizar secciones
        document.querySelectorAll('.admin-section').forEach(function (s) {
            s.classList.toggle('active', s.id === 'sec-' + section);
        });

        // Cargar datos de la sección
        loadSection(section);
    }

    // ==========================================
    // MODAL
    // ==========================================

    function openModal(title, bodyHtml, onSave) {
        var modal = document.getElementById('adminModal');
        var titleEl = document.getElementById('adminModalTitle');
        var bodyEl = document.getElementById('adminModalBody');
        var saveBtn = document.getElementById('adminModalSave');
        var cancelBtn = document.getElementById('adminModalCancel');
        var closeBtn = document.getElementById('adminModalClose');

        titleEl.textContent = title;
        bodyEl.innerHTML = bodyHtml;
        modal.style.display = 'flex';

        // Remover event listeners previos clonando
        var newSave = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newSave, saveBtn);
        saveBtn = newSave;

        var newCancel = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
        cancelBtn = newCancel;

        var newClose = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newClose, closeBtn);
        closeBtn = newClose;

        function closeModal() {
            modal.style.display = 'none';
            state.editingId = null;
            state.editingType = null;
        }

        closeBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);
        modal.addEventListener('click', function (e) {
            if (e.target === modal) closeModal();
        });

        saveBtn.addEventListener('click', async function () {
            if (typeof onSave === 'function') {
                saveBtn.disabled = true;
                saveBtn.textContent = 'Guardando...';
                try {
                    await onSave();
                    closeModal();
                    loadSection(state.currentSection);
                } catch (err) {
                    showToast('Error: ' + err.message, true);
                } finally {
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Guardar';
                }
            }
        });
    }

    // ==========================================
    // CARGA DE DATOS
    // ==========================================

    function loadSection(section) {
        switch (section) {
            case 'dashboard': loadDashboard(); break;
            case 'razones': loadRazones(); break;
            case 'canciones': loadCanciones(); break;
            case 'regalos': loadRegalos(); break;
            case 'noticias': loadNoticias(); break;
            case 'maldia': loadMalDia(); break;
            case 'series': loadSeries(); break;
            case 'analytics': loadAnalytics(); break;
        }
    }

    // ==========================================
    // DASHBOARD
    // ==========================================

    async function loadDashboard() {
        if (!window.db) return;

        try {
            // Contar usuarios
            var usersSnap = await window.db.collection('users').get();
            document.getElementById('statUsers').textContent = usersSnap.size || 0;

            // Contar razones
            var razonesSnap = await window.db.collection('config_razones').doc('data').get();
            var razonesData = razonesSnap.exists ? razonesSnap.data() : {};
            document.getElementById('statReasons').textContent = (razonesData.reasons || []).length;

            // Contar canciones (que recuerdan a ti)
            var songsSnap = await window.db.collection('config_canciones_recuerdan').doc('data').get();
            var songsData = songsSnap.exists ? songsSnap.data() : {};
            document.getElementById('statSongs').textContent = (songsData.songs || []).length;

            // Contar regalos
            var giftsSnap = await window.db.collection('config_gifts').doc('catalog').get();
            var giftsData = giftsSnap.exists ? giftsSnap.data() : {};
            document.getElementById('statGifts').textContent = (giftsData.gifts || []).length;
        } catch (err) {
            console.warn('Dashboard:', err);
        }
    }

    // ==========================================
    // ANALYTICS
    // ==========================================

    async function loadAnalytics() {
        if (!window.db) return;

        try {
            var today = new Date().toISOString().split('T')[0];

            // Visitas totales (stats_visits collection)
            var visitsSnap = await window.db.collection('stats_visits').get();
            document.getElementById('analyticsPageviews').textContent = visitsSnap.size || 0;

            // Usuarios activos (users count)
            var usersSnap = await window.db.collection('users').get();
            document.getElementById('analyticsUsers').textContent = usersSnap.size || 0;

            // Visitas hoy
            var todayCount = 0;
            visitsSnap.forEach(function (doc) {
                var data = doc.data();
                if (data.timestamp && data.timestamp.startsWith(today)) todayCount++;
            });
            document.getElementById('analyticsToday').textContent = todayCount;

            // Mensajes totales
            try {
                var chatSnap = await window.db.collection('chat').get();
                document.getElementById('analyticsMessages').textContent = chatSnap.size || 0;
            } catch (e) {
                document.getElementById('analyticsMessages').textContent = '—';
            }

            // Últimas visitas
            var visitsList = document.getElementById('analyticsVisitsList');
            var allVisits = [];
            visitsSnap.forEach(function (doc) {
                allVisits.push({ id: doc.id, ...doc.data() });
            });
            allVisits.sort(function (a, b) { return (b.timestamp || '').localeCompare(a.timestamp || ''); });
            var recent = allVisits.slice(0, 20);

            if (recent.length === 0) {
                visitsList.innerHTML = '<div class="admin-empty">No hay visitas registradas</div>';
            } else {
                visitsList.innerHTML = recent.map(function (v) {
                    var page = v.page || v.id || '—';
                    var time = v.timestamp ? new Date(v.timestamp).toLocaleString() : '—';
                    return '<div class="admin-list-item">' +
                        '<div class="item-content"><div class="item-title">' + escapeHtml(page) + '</div>' +
                        '<div class="item-sub">' + time + '</div></div></div>';
                }).join('');
            }

            // Páginas más visitadas
            var pageCount = {};
            visitsSnap.forEach(function (doc) {
                var data = doc.data();
                var page = data.page || 'desconocida';
                pageCount[page] = (pageCount[page] || 0) + 1;
            });
            var sortedPages = Object.keys(pageCount).sort(function (a, b) { return pageCount[b] - pageCount[a]; });
            var pagesList = document.getElementById('analyticsPagesList');
            if (sortedPages.length === 0) {
                pagesList.innerHTML = '<div class="admin-empty">No hay datos</div>';
            } else {
                pagesList.innerHTML = sortedPages.slice(0, 15).map(function (page) {
                    return '<div class="admin-list-item">' +
                        '<div class="item-content"><div class="item-title">' + escapeHtml(page) + '</div>' +
                        '<div class="item-sub">' + pageCount[page] + ' visitas</div></div></div>';
                }).join('');
            }
        } catch (err) {
            console.warn('Analytics:', err);
            ['analyticsPageviews', 'analyticsUsers', 'analyticsToday', 'analyticsMessages'].forEach(function (id) {
                var el = document.getElementById(id);
                if (el) el.textContent = 'Error';
            });
        }
    }

    // ==========================================
    // RAZONES
    // ==========================================

    async function loadRazones() {
        var list = document.getElementById('razonesList');
        list.innerHTML = '<div class="admin-empty">Cargando...</div>';

        try {
            var snap = await window.db.collection('config_razones').doc('data').get();
            var data = snap.exists ? snap.data() : {};
            var reasons = data.reasons || [];

            if (reasons.length === 0) {
                list.innerHTML = '<div class="admin-empty">No hay razones todavía</div>';
                return;
            }

            list.innerHTML = reasons.map(function (r, i) {
                return '<div class="admin-list-item">' +
                    '<div class="item-content">' +
                    '<div class="item-title">' + escapeHtml(r.text || r) + '</div>' +
                    '<div class="item-sub">#' + (i + 1) + (r.category ? ' · ' + escapeHtml(r.category) : '') + '</div>' +
                    '</div>' +
                    '<div class="item-actions">' +
                    '<button class="item-action-btn edit" data-index="' + i + '" onclick="AdminApp.editRazon(' + i + ')"><i data-lucide="pencil"></i></button>' +
                    '<button class="item-action-btn delete" data-index="' + i + '" onclick="AdminApp.deleteRazon(' + i + ')"><i data-lucide="trash-2"></i></button>' +
                    '</div>' +
                    '</div>';
            }).join('');
            if (typeof lucide !== 'undefined') lucide.createIcons({ root: list });
        } catch (err) {
            list.innerHTML = '<div class="admin-empty">Error cargando razones</div>';
            console.error(err);
        }
    }

    function showRazonForm(index) {
        state.editingType = 'razon';
        var isEdit = index !== undefined && index !== null;
        state.editingId = isEdit ? index : null;

        var title = isEdit ? 'Editar razón' : 'Añadir razón';

        getRazonesData().then(function (reasons) {
            var item = isEdit ? reasons[index] : { text: '', category: '' };
            var text = typeof item === 'string' ? item : item.text || '';
            var category = item.category || '';

            openModal(title,
                '<div class="admin-field">' +
                '<label>Texto de la razón</label>' +
                '<textarea id="fRazonText" placeholder="Escribe la razón...">' + escapeHtml(text) + '</textarea>' +
                '</div>' +
                '<div class="admin-field">' +
                '<label>Categoría (opcional)</label>' +
                '<input type="text" id="fRazonCategory" placeholder="ej: personalidad, físico..." value="' + escapeHtml(category) + '">' +
                '</div>',
                async function () {
                    var newText = document.getElementById('fRazonText').value.trim();
                    if (!newText) throw new Error('El texto no puede estar vacío');
                    var newCategory = document.getElementById('fRazonCategory').value.trim();
                    var updated = reasons.slice();
                    var newItem = newCategory ? { text: newText, category: newCategory } : newText;
                    if (isEdit) {
                        updated[index] = newItem;
                    } else {
                        updated.push(newItem);
                    }
                    await window.db.collection('config_razones').doc('data').set({ reasons: updated });
                    showToast(isEdit ? 'Razón actualizada' : 'Razón añadida');
                }
            );
        });
    }

    async function getRazonesData() {
        var snap = await window.db.collection('config_razones').doc('data').get();
        return snap.exists ? (snap.data().reasons || []) : [];
    }

    window.AdminApp = window.AdminApp || {};
    window.AdminApp.editRazon = function (i) { showRazonForm(i); };
    window.AdminApp.deleteRazon = async function (i) {
        if (!confirm('¿Eliminar esta razón?')) return;
        var reasons = await getRazonesData();
        reasons.splice(i, 1);
        await window.db.collection('config_razones').doc('data').set({ reasons: reasons });
        showToast('Razón eliminada');
        loadRazones();
    };

    // ==========================================
    // CANCIONES
    // ==========================================

    async function loadCanciones() {
        var list = document.getElementById('cancionesList');
        list.innerHTML = '<div class="admin-empty">Cargando...</div>';

        try {
            var snap = await window.db.collection('config_canciones_recuerdan').doc('data').get();
            var data = snap.exists ? snap.data() : {};
            var songs = data.songs || [];

            if (songs.length === 0) {
                list.innerHTML = '<div class="admin-empty">No hay canciones todavía</div>';
                return;
            }

            list.innerHTML = songs.map(function (s, i) {
                return '<div class="admin-list-item">' +
                    '<div class="item-content">' +
                    '<div class="item-title">' + escapeHtml(s.title) + '</div>' +
                    '<div class="item-sub">' + escapeHtml(s.artist || '') + (s.album ? ' · ' + escapeHtml(s.album) : '') + '</div>' +
                    '</div>' +
                    '<div class="item-actions">' +
                    '<button class="item-action-btn edit" onclick="AdminApp.editCancion(' + i + ')"><i data-lucide="pencil"></i></button>' +
                    '<button class="item-action-btn delete" onclick="AdminApp.deleteCancion(' + i + ')"><i data-lucide="trash-2"></i></button>' +
                    '</div>' +
                    '</div>';
            }).join('');
            if (typeof lucide !== 'undefined') lucide.createIcons({ root: list });
        } catch (err) {
            list.innerHTML = '<div class="admin-empty">Error cargando canciones</div>';
            console.error(err);
        }
    }

    function showCancionForm(index) {
        state.editingType = 'cancion';
        var isEdit = index !== undefined && index !== null;
        state.editingId = isEdit ? index : null;

        getCancionesData().then(function (songs) {
            var item = isEdit ? songs[index] : { title: '', artist: '', album: '', cover: '', audio: '', lyrics: '' };

            openModal(isEdit ? 'Editar canción' : 'Añadir canción',
                '<div class="admin-field"><label>Título *</label><input type="text" id="fSongTitle" value="' + escapeHtml(item.title) + '"></div>' +
                '<div class="admin-field"><label>Artista</label><input type="text" id="fSongArtist" value="' + escapeHtml(item.artist || '') + '"></div>' +
                '<div class="admin-field"><label>Álbum</label><input type="text" id="fSongAlbum" value="' + escapeHtml(item.album || '') + '"></div>' +
                '<div class="admin-field"><label>URL Portada</label><input type="url" id="fSongCover" value="' + escapeHtml(item.cover || '') + '" placeholder="https://..."></div>' +
                '<div class="admin-field"><label>URL Audio</label><input type="url" id="fSongAudio" value="' + escapeHtml(item.audio || '') + '" placeholder="https://..."></div>' +
                '<div class="admin-field"><label>Letra</label><textarea id="fSongLyrics" placeholder="Letra de la canción...">' + escapeHtml(item.lyrics || '') + '</textarea></div>' +
                '<div class="admin-field"><span class="field-hint">Los campos con * son obligatorios</span></div>',
                async function () {
                    var title = document.getElementById('fSongTitle').value.trim();
                    if (!title) throw new Error('El título es obligatorio');
                    var updated = songs.slice();
                    var newItem = {
                        title: title,
                        artist: document.getElementById('fSongArtist').value.trim(),
                        album: document.getElementById('fSongAlbum').value.trim(),
                        cover: document.getElementById('fSongCover').value.trim(),
                        audio: document.getElementById('fSongAudio').value.trim(),
                        lyrics: document.getElementById('fSongLyrics').value.trim()
                    };
                    if (isEdit) {
                        updated[index] = newItem;
                    } else {
                        updated.push(newItem);
                    }
                    await window.db.collection('config_canciones_recuerdan').doc('data').set({ songs: updated });
                    showToast(isEdit ? 'Canción actualizada' : 'Canción añadida');
                }
            );
        });
    }

    async function getCancionesData() {
        var snap = await window.db.collection('config_canciones_recuerdan').doc('data').get();
        return snap.exists ? (snap.data().songs || []) : [];
    }

    window.AdminApp.editCancion = function (i) { showCancionForm(i); };
    window.AdminApp.deleteCancion = async function (i) {
        if (!confirm('¿Eliminar esta canción?')) return;
        var songs = await getCancionesData();
        songs.splice(i, 1);
        await window.db.collection('config_canciones_recuerdan').doc('data').set({ songs: songs });
        showToast('Canción eliminada');
        loadCanciones();
    };

    // ==========================================
    // REGALOS
    // ==========================================

    async function loadRegalos() {
        var list = document.getElementById('regalosList');
        list.innerHTML = '<div class="admin-empty">Cargando...</div>';

        try {
            var snap = await window.db.collection('config_gifts').doc('catalog').get();
            var data = snap.exists ? snap.data() : {};
            var gifts = data.gifts || [];

            if (gifts.length === 0) {
                list.innerHTML = '<div class="admin-empty">No hay regalos todavía</div>';
                return;
            }

            list.innerHTML = gifts.map(function (g, i) {
                return '<div class="admin-list-item">' +
                    '<div class="item-content">' +
                    '<div class="item-title">' + escapeHtml(g.title || g.id) + '</div>' +
                    '<div class="item-sub">' + escapeHtml(g.type || 'sin tipo') + ' · ' + (g.unlock?.value || 'sin fecha') + '</div>' +
                    '</div>' +
                    '<div class="item-actions">' +
                    '<button class="item-action-btn edit" onclick="AdminApp.editRegalo(' + i + ')"><i data-lucide="pencil"></i></button>' +
                    '<button class="item-action-btn delete" onclick="AdminApp.deleteRegalo(' + i + ')"><i data-lucide="trash-2"></i></button>' +
                    '</div>' +
                    '</div>';
            }).join('');
            if (typeof lucide !== 'undefined') lucide.createIcons({ root: list });
        } catch (err) {
            list.innerHTML = '<div class="admin-empty">Error cargando regalos</div>';
            console.error(err);
        }
    }

    function showRegaloForm(index) {
        state.editingType = 'regalo';
        var isEdit = index !== undefined && index !== null;
        state.editingId = isEdit ? index : null;

        getRegalosData().then(function (data) {
            var gifts = data.gifts || [];
            var item = isEdit ? gifts[index] : { id: '', title: '', type: 'letter', unlock: { mode: 'date', value: '' }, data: { content: '' }, redirect: false };

            openModal(isEdit ? 'Editar regalo' : 'Añadir regalo',
                '<div class="admin-field"><label>ID *</label><input type="text" id="fGiftId" value="' + escapeHtml(item.id) + '"' + (isEdit ? ' disabled' : '') + '></div>' +
                '<div class="admin-field"><label>Título *</label><input type="text" id="fGiftTitle" value="' + escapeHtml(item.title) + '"></div>' +
                '<div class="admin-field"><label>Tipo</label><select id="fGiftType">' +
                '<option value="letter"' + (item.type === 'letter' ? ' selected' : '') + '>Carta</option>' +
                '<option value="cassette"' + (item.type === 'cassette' ? ' selected' : '') + '>Música</option>' +
                '<option value="giftBox"' + (item.type === 'giftBox' ? ' selected' : '') + '>Regalo</option>' +
                '<option value="polaroid"' + (item.type === 'polaroid' ? ' selected' : '') + '>Recuerdo</option>' +
                '<option value="video"' + (item.type === 'video' ? ' selected' : '') + '>Video</option>' +
                '<option value="surprise"' + (item.type === 'surprise' ? ' selected' : '') + '>Sorpresa</option>' +
                '<option value="quiz"' + (item.type === 'quiz' ? ' selected' : '') + '>Pregunta</option>' +
                '<option value="wishlist"' + (item.type === 'wishlist' ? ' selected' : '') + '>Deseos</option>' +
                '<option value="game"' + (item.type === 'game' ? ' selected' : '') + '>Juego</option>' +
                '</select></div>' +
                '<div class="admin-field"><label>Fecha desbloqueo (YYYY-MM-DD)</label><input type="date" id="fGiftDate" value="' + (item.unlock?.value || '') + '"></div>' +
                '<div class="admin-field"><label>Contenido / Mensaje</label><textarea id="fGiftContent" placeholder="Contenido del regalo...">' + escapeHtml(item.data?.content || item.data?.message || '') + '</textarea></div>' +
                '<div class="admin-field"><label>Redirigir a juego</label><input type="url" id="fGiftRedirect" placeholder="games/memoria.html" value="' + escapeHtml(item.redirectUrl || '') + '"><span class="field-hint">Si el tipo es Juego, pon aquí la URL</span></div>',
                async function () {
                    var id = document.getElementById('fGiftId').value.trim();
                    var title = document.getElementById('fGiftTitle').value.trim();
                    if (!id || !title) throw new Error('ID y título son obligatorios');
                    var type = document.getElementById('fGiftType').value;
                    var date = document.getElementById('fGiftDate').value;
                    var content = document.getElementById('fGiftContent').value.trim();
                    var redirectUrl = document.getElementById('fGiftRedirect').value.trim();

                    var updatedGifts = gifts.slice();
                    var newGift = {
                        id: id,
                        title: title,
                        type: type,
                        unlock: { mode: 'date', value: date },
                        redirect: !!redirectUrl,
                        data: { content: content, message: content }
                    };
                    if (redirectUrl) newGift.redirectUrl = redirectUrl;
                    if (type === 'cassette') {
                        newGift.data.audioUrl = '';
                        newGift.data.coverImage = '';
                    }

                    if (isEdit) {
                        updatedGifts[index] = newGift;
                    } else {
                        updatedGifts.push(newGift);
                    }
                    await window.db.collection('config_gifts').doc('catalog').set({ gifts: updatedGifts });
                    showToast(isEdit ? 'Regalo actualizado' : 'Regalo añadido');
                }
            );
        });
    }

    async function getRegalosData() {
        var snap = await window.db.collection('config_gifts').doc('catalog').get();
        return snap.exists ? snap.data() : { gifts: [] };
    }

    window.AdminApp.editRegalo = function (i) { showRegaloForm(i); };
    window.AdminApp.deleteRegalo = async function (i) {
        if (!confirm('¿Eliminar este regalo?')) return;
        var data = await getRegalosData();
        data.gifts.splice(i, 1);
        await window.db.collection('config_gifts').doc('catalog').set(data);
        showToast('Regalo eliminado');
        loadRegalos();
    };

    // ==========================================
    // NOTICIAS
    // ==========================================

    async function loadNoticias() {
        var list = document.getElementById('noticiasList');
        list.innerHTML = '<div class="admin-empty">Cargando...</div>';

        try {
            var snap = await window.db.collection('config_noticias').doc('data').get();
            var data = snap.exists ? snap.data() : {};
            var news = data.news || [];

            if (news.length === 0) {
                list.innerHTML = '<div class="admin-empty">No hay noticias todavía</div>';
                return;
            }

            list.innerHTML = news.map(function (n, i) {
                return '<div class="admin-list-item">' +
                    '<div class="item-content">' +
                    '<div class="item-title">' + escapeHtml(n.title) + '</div>' +
                    '<div class="item-sub">' + escapeHtml(n.date || '') + ' · ' + escapeHtml(n.description || '').substring(0, 60) + '</div>' +
                    '</div>' +
                    '<div class="item-actions">' +
                    '<button class="item-action-btn edit" onclick="AdminApp.editNoticia(' + i + ')"><i data-lucide="pencil"></i></button>' +
                    '<button class="item-action-btn delete" onclick="AdminApp.deleteNoticia(' + i + ')"><i data-lucide="trash-2"></i></button>' +
                    '</div>' +
                    '</div>';
            }).join('');
            if (typeof lucide !== 'undefined') lucide.createIcons({ root: list });
        } catch (err) {
            list.innerHTML = '<div class="admin-empty">Error cargando noticias</div>';
            console.error(err);
        }
    }

    function showNoticiaForm(index) {
        state.editingType = 'noticia';
        var isEdit = index !== undefined && index !== null;

        getNoticiasData().then(function (news) {
            var item = isEdit ? news[index] : { id: Date.now(), date: '', title: '', description: '' };

            openModal(isEdit ? 'Editar noticia' : 'Añadir noticia',
                '<div class="admin-field"><label>Título *</label><input type="text" id="fNewsTitle" value="' + escapeHtml(item.title) + '"></div>' +
                '<div class="admin-field"><label>Fecha</label><input type="text" id="fNewsDate" value="' + escapeHtml(item.date || '') + '" placeholder="ej: 13 de julio de 2026"></div>' +
                '<div class="admin-field"><label>Descripción</label><textarea id="fNewsDesc">' + escapeHtml(item.description || '') + '</textarea></div>',
                async function () {
                    var title = document.getElementById('fNewsTitle').value.trim();
                    if (!title) throw new Error('El título es obligatorio');
                    var updated = news.slice();
                    var newItem = {
                        id: isEdit ? item.id : Date.now(),
                        date: document.getElementById('fNewsDate').value.trim(),
                        title: title,
                        description: document.getElementById('fNewsDesc').value.trim()
                    };
                    if (isEdit) {
                        updated[index] = newItem;
                    } else {
                        updated.push(newItem);
                    }
                    await window.db.collection('config_noticias').doc('data').set({ news: updated });
                    showToast(isEdit ? 'Noticia actualizada' : 'Noticia añadida');
                }
            );
        });
    }

    async function getNoticiasData() {
        var snap = await window.db.collection('config_noticias').doc('data').get();
        return snap.exists ? (snap.data().news || []) : [];
    }

    window.AdminApp.editNoticia = function (i) { showNoticiaForm(i); };
    window.AdminApp.deleteNoticia = async function (i) {
        if (!confirm('¿Eliminar esta noticia?')) return;
        var news = await getNoticiasData();
        news.splice(i, 1);
        await window.db.collection('config_noticias').doc('data').set({ news: news });
        showToast('Noticia eliminada');
        loadNoticias();
    };

    // ==========================================
    // MAL DÍA
    // ==========================================

    async function loadMalDia() {
        loadMalDiaFrases();
        loadMalDiaMensajes();
    }

    async function loadMalDiaFrases() {
        var list = document.getElementById('maldiaFrasesList');
        list.innerHTML = '<div class="admin-empty">Cargando...</div>';

        try {
            var snap = await window.db.collection('config_maldia_frases').doc('data').get();
            var data = snap.exists ? snap.data() : {};
            var frases = data.frases || [];

            if (frases.length === 0) {
                list.innerHTML = '<div class="admin-empty">No hay frases</div>';
                return;
            }

            list.innerHTML = frases.map(function (f, i) {
                return '<div class="admin-list-item">' +
                    '<div class="item-content">' +
                    '<div class="item-title">' + escapeHtml(f).substring(0, 80) + (f.length > 80 ? '...' : '') + '</div>' +
                    '</div>' +
                    '<div class="item-actions">' +
                    '<button class="item-action-btn edit" onclick="AdminApp.editMalDiaFrase(' + i + ')"><i data-lucide="pencil"></i></button>' +
                    '<button class="item-action-btn delete" onclick="AdminApp.deleteMalDiaFrase(' + i + ')"><i data-lucide="trash-2"></i></button>' +
                    '</div>' +
                    '</div>';
            }).join('');
            if (typeof lucide !== 'undefined') lucide.createIcons({ root: list });
        } catch (err) {
            list.innerHTML = '<div class="admin-empty">Error</div>';
        }
    }

    async function getMalDiaFrasesData() {
        var snap = await window.db.collection('config_maldia_frases').doc('data').get();
        return snap.exists ? (snap.data().frases || []) : [];
    }

    function showMalDiaFraseForm(index) {
        var isEdit = index !== undefined && index !== null;
        getMalDiaFrasesData().then(function (frases) {
            var item = isEdit ? frases[index] : '';
            openModal(isEdit ? 'Editar frase' : 'Añadir frase',
                '<div class="admin-field"><label>Frase</label><textarea id="fFrase">' + escapeHtml(item) + '</textarea></div>',
                async function () {
                    var text = document.getElementById('fFrase').value.trim();
                    if (!text) throw new Error('La frase no puede estar vacía');
                    var updated = frases.slice();
                    if (isEdit) { updated[index] = text; } else { updated.push(text); }
                    await window.db.collection('config_maldia_frases').doc('data').set({ frases: updated });
                    showToast(isEdit ? 'Frase actualizada' : 'Frase añadida');
                }
            );
        });
    }

    window.AdminApp.editMalDiaFrase = function (i) { showMalDiaFraseForm(i); };
    window.AdminApp.deleteMalDiaFrase = async function (i) {
        if (!confirm('¿Eliminar esta frase?')) return;
        var frases = await getMalDiaFrasesData();
        frases.splice(i, 1);
        await window.db.collection('config_maldia_frases').doc('data').set({ frases: frases });
        showToast('Frase eliminada');
        loadMalDiaFrases();
    };

    async function loadMalDiaMensajes() {
        var list = document.getElementById('maldiaMensajesList');
        list.innerHTML = '<div class="admin-empty">Cargando...</div>';

        try {
            var snap = await window.db.collection('config_maldia_mensajes').doc('data').get();
            var data = snap.exists ? snap.data() : {};
            var mensajes = data.mensajes || [];

            if (mensajes.length === 0) {
                list.innerHTML = '<div class="admin-empty">No hay mensajes</div>';
                return;
            }

            list.innerHTML = mensajes.map(function (m, i) {
                return '<div class="admin-list-item">' +
                    '<div class="item-content">' +
                    '<div class="item-title">' + escapeHtml(m).substring(0, 80) + (m.length > 80 ? '...' : '') + '</div>' +
                    '</div>' +
                    '<div class="item-actions">' +
                    '<button class="item-action-btn edit" onclick="AdminApp.editMalDiaMensaje(' + i + ')"><i data-lucide="pencil"></i></button>' +
                    '<button class="item-action-btn delete" onclick="AdminApp.deleteMalDiaMensaje(' + i + ')"><i data-lucide="trash-2"></i></button>' +
                    '</div>' +
                    '</div>';
            }).join('');
            if (typeof lucide !== 'undefined') lucide.createIcons({ root: list });
        } catch (err) {
            list.innerHTML = '<div class="admin-empty">Error</div>';
        }
    }

    async function getMalDiaMensajesData() {
        var snap = await window.db.collection('config_maldia_mensajes').doc('data').get();
        return snap.exists ? (snap.data().mensajes || []) : [];
    }

    function showMalDiaMensajeForm(index) {
        var isEdit = index !== undefined && index !== null;
        getMalDiaMensajesData().then(function (mensajes) {
            var item = isEdit ? mensajes[index] : '';
            openModal(isEdit ? 'Editar mensaje' : 'Añadir mensaje',
                '<div class="admin-field"><label>Mensaje</label><textarea id="fMensaje">' + escapeHtml(item) + '</textarea></div>',
                async function () {
                    var text = document.getElementById('fMensaje').value.trim();
                    if (!text) throw new Error('El mensaje no puede estar vacío');
                    var updated = mensajes.slice();
                    if (isEdit) { updated[index] = text; } else { updated.push(text); }
                    await window.db.collection('config_maldia_mensajes').doc('data').set({ mensajes: updated });
                    showToast(isEdit ? 'Mensaje actualizado' : 'Mensaje añadido');
                }
            );
        });
    }

    window.AdminApp.editMalDiaMensaje = function (i) { showMalDiaMensajeForm(i); };
    window.AdminApp.deleteMalDiaMensaje = async function (i) {
        if (!confirm('¿Eliminar este mensaje?')) return;
        var mensajes = await getMalDiaMensajesData();
        mensajes.splice(i, 1);
        await window.db.collection('config_maldia_mensajes').doc('data').set({ mensajes: mensajes });
        showToast('Mensaje eliminado');
        loadMalDiaMensajes();
    };

    // ==========================================
    // SERIES
    // ==========================================

    async function loadSeries() {
        var list = document.getElementById('seriesList');
        list.innerHTML = '<div class="admin-empty">Cargando...</div>';

        try {
            var snap = await window.db.collection('seriesData').get();
            var series = [];
            snap.forEach(function (doc) { series.push({ id: doc.id, ...doc.data() }); });

            if (series.length === 0) {
                list.innerHTML = '<div class="admin-empty">No hay series/películas</div>';
                return;
            }

            list.innerHTML = series.map(function (s, i) {
                return '<div class="admin-list-item">' +
                    '<div class="item-content">' +
                    '<div class="item-title">' + escapeHtml(s.titulo || s.title || s.id) + '</div>' +
                    '<div class="item-sub">' + escapeHtml(s.tipo || '') + (s.totalEpisodios ? ' · ' + s.totalEpisodios + ' eps' : '') + '</div>' +
                    '</div>' +
                    '<div class="item-actions">' +
                    '<button class="item-action-btn edit" onclick="AdminApp.editSerie(\'' + s.id + '\')"><i data-lucide="pencil"></i></button>' +
                    '<button class="item-action-btn delete" onclick="AdminApp.deleteSerie(\'' + s.id + '\')"><i data-lucide="trash-2"></i></button>' +
                    '</div>' +
                    '</div>';
            }).join('');
            if (typeof lucide !== 'undefined') lucide.createIcons({ root: list });
        } catch (err) {
            list.innerHTML = '<div class="admin-empty">Error cargando series</div>';
            console.error(err);
        }
    }

    function showSerieForm(docId) {
        var isEdit = !!docId;
        state.editingId = docId || null;

        var loadPromise = isEdit
            ? window.db.collection('seriesData').doc(docId).get().then(function (d) { return d.exists ? d.data() : {}; })
            : Promise.resolve({ titulo: '', tipo: 'serie', portada: '', web: '', totalEpisodios: 0 });

        loadPromise.then(function (item) {
            openModal(isEdit ? 'Editar contenido' : 'Añadir contenido',
                '<div class="admin-field"><label>Título *</label><input type="text" id="fSerieTitulo" value="' + escapeHtml(item.titulo || item.title || '') + '"></div>' +
                '<div class="admin-field"><label>Tipo</label><select id="fSerieTipo">' +
                '<option value="serie"' + ((item.tipo || 'serie') === 'serie' ? ' selected' : '') + '>Serie</option>' +
                '<option value="pelicula"' + ((item.tipo || '') === 'pelicula' ? ' selected' : '') + '>Película</option>' +
                '</select></div>' +
                '<div class="admin-field"><label>URL Portada</label><input type="url" id="fSeriePortada" value="' + escapeHtml(item.portada || '') + '"></div>' +
                '<div class="admin-field"><label>URL Web</label><input type="url" id="fSerieWeb" value="' + escapeHtml(item.web || '') + '"></div>' +
                '<div class="admin-field"><label>Total episodios (solo series)</label><input type="number" id="fSerieEps" value="' + (item.totalEpisodios || 0) + '"></div>',
                async function () {
                    var titulo = document.getElementById('fSerieTitulo').value.trim();
                    if (!titulo) throw new Error('El título es obligatorio');
                    var data = {
                        titulo: titulo,
                        title: titulo,
                        tipo: document.getElementById('fSerieTipo').value,
                        portada: document.getElementById('fSeriePortada').value.trim(),
                        web: document.getElementById('fSerieWeb').value.trim(),
                        totalEpisodios: parseInt(document.getElementById('fSerieEps').value) || 0
                    };
                    if (isEdit) {
                        await window.db.collection('seriesData').doc(docId).update(data);
                    } else {
                        await window.db.collection('seriesData').add(data);
                    }
                    showToast(isEdit ? 'Contenido actualizado' : 'Contenido añadido');
                }
            );
        });
    }

    window.AdminApp.editSerie = function (id) { showSerieForm(id); };
    window.AdminApp.deleteSerie = async function (id) {
        if (!confirm('¿Eliminar este contenido?')) return;
        await window.db.collection('seriesData').doc(id).delete();
        showToast('Contenido eliminado');
        loadSeries();
    };

    // ==========================================
    // BOTONES DE AÑADIR
    // ==========================================

    function bindAddButtons() {
        document.getElementById('razonesAddBtn').addEventListener('click', function () { showRazonForm(); });
        document.getElementById('cancionesAddBtn').addEventListener('click', function () { showCancionForm(); });
        document.getElementById('regalosAddBtn').addEventListener('click', function () { showRegaloForm(); });
        document.getElementById('noticiasAddBtn').addEventListener('click', function () { showNoticiaForm(); });
        document.getElementById('seriesAddBtn').addEventListener('click', function () { showSerieForm(); });
        document.getElementById('maldiaFrasesAddBtn').addEventListener('click', function () { showMalDiaFraseForm(); });
        document.getElementById('maldiaMensajesAddBtn').addEventListener('click', function () { showMalDiaMensajeForm(); });
    }

    // ==========================================
    // VERIFICAR QUE ES ADMIN
    // ==========================================

    function checkAdminAccess() {
        var user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
        if (!user || !(typeof isAdminUser === 'function' && isAdminUser(user))) {
            document.querySelector('.admin-content').innerHTML =
                '<div style="text-align:center;padding:60px 20px;color:var(--umbra-ash);">' +
                '<div style="font-size:3rem;margin-bottom:16px;">🔒</div>' +
                '<h2 style="font-family:Playfair Display,serif;color:var(--umbra-light);">Acceso restringido</h2>' +
                '<p>Solo el administrador puede acceder a esta página.</p></div>';
            document.getElementById('adminTabs').style.display = 'none';
            document.getElementById('adminStatus').querySelector('span:last-child').textContent = 'Sin acceso';
            document.querySelector('.status-dot').classList.add('offline');
            return false;
        }
        document.getElementById('adminStatus').querySelector('span:last-child').textContent = 'Conectado como ' + user.email;
        return true;
    }

    // ==========================================
    // INICIALIZACIÓN
    // ==========================================

    function init() {
        function waitForFirestore() {
            if (typeof window.db === 'undefined' || !window.db) {
                setTimeout(waitForFirestore, 300);
                return;
            }
            waitForUser();
        }

        function waitForUser() {
            if (typeof window.auth === 'undefined' || !window.auth) {
                setTimeout(waitForUser, 300);
                return;
            }
            window.auth.onAuthStateChanged(function (user) {
                if (!checkAdminAccess()) return;
                initTabs();
                bindAddButtons();
                switchSection('dashboard');
            });
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', waitForFirestore);
        } else {
            waitForFirestore();
        }
    }

    init();

    return {
        loadSection: loadSection
    };
})();
