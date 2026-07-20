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
            case 'moods': loadMoods(); break;
            case 'razones': loadRazones(); break;
            case 'canciones': loadCanciones(); break;
            case 'regalos': loadRegalos(); break;
            case 'noticias': loadNoticias(); break;
            case 'maldia': loadMalDia(); break;
            case 'series': loadSeries(); break;
            case 'analytics': loadAnalytics(); break;
            case 'usuarios': loadUsuarios(); break;
            case 'actividad': loadActividad(); break;
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
    // ESTADO DE ÁNIMO (MOODS)
    // ==========================================

    var moodCurrentDate = new Date(); // track current viewed month

    var MOOD_EMOJIS = {
        great: '🤍🤍🤍',
        good: '😊',
        meh: '😕',
        bad: '😔',
        love: '❤️'
    };

    var MOOD_LABELS = {
        great: 'Muy bieeeen',
        good: 'Bien',
        meh: 'Un poquito mal',
        bad: 'Mal',
        love: 'Necesito cariño'
    };

    var MOOD_SCORES = {
        great: 4,
        good: 3,
        meh: 2,
        bad: 1,
        love: 0
    };

    async function loadMoods() {
        if (!window.db) return;
        loadMoodSummary();
        renderMoodMonth(moodCurrentDate);
        bindMoodNav();
    }

    async function loadMoodSummary() {
        var uid = getCurrentSessionUid();
        if (!uid) return;

        var today = new Date().toISOString().split('T')[0];
        var weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
        var monthStart = new Date().toISOString().slice(0, 7) + '-01';
        var yearStart = new Date().getFullYear() + '-01-01';

        try {
            var allMoods = await window.db.collection('users').doc(uid).collection('moods').get();
            var moods = [];
            allMoods.forEach(function (doc) {
                var d = doc.data();
                moods.push({ date: doc.id, mood: d.mood, label: d.label, emoji: d.emoji, timestamp: d.timestamp });
            });

            moods.sort(function (a, b) { return a.date.localeCompare(b.date); });

            // Today
            var todayMood = moods.filter(function (m) { return m.date === today; });
            document.getElementById('moodToday').textContent = todayMood.length > 0
                ? (todayMood[0].emoji || MOOD_EMOJIS[todayMood[0].mood] || '—')
                : '—';

            // This week
            var weekMoods = moods.filter(function (m) { return m.date >= weekAgo && m.date <= today; });
            document.getElementById('moodWeek').textContent = weekMoods.length > 0
                ? calcMoodAverage(weekMoods)
                : '—';

            // This month
            var monthMoods = moods.filter(function (m) { return m.date >= monthStart && m.date <= today; });
            document.getElementById('moodMonth').textContent = monthMoods.length > 0
                ? calcMoodAverage(monthMoods)
                : '—';

            // This year
            var yearMoods = moods.filter(function (m) { return m.date >= yearStart && m.date <= today; });
            document.getElementById('moodYear').textContent = yearMoods.length > 0
                ? calcMoodAverage(yearMoods)
                : '—';
        } catch (err) {
            console.warn('Error loading mood summary:', err);
        }
    }

    function calcMoodAverage(moods) {
        var total = 0;
        moods.forEach(function (m) {
            var score = MOOD_SCORES[m.mood] !== undefined ? MOOD_SCORES[m.mood] : 1;
            total += score;
        });
        var avg = total / moods.length;
        if (avg >= 3.5) return '🤍🤍🤍';
        if (avg >= 2.5) return '😊';
        if (avg >= 1.5) return '😕';
        if (avg >= 0.5) return '😔';
        return '❤️';
    }

    async function renderMoodMonth(date) {
        var container = document.getElementById('moodsCalendar');
        var statsEl = document.getElementById('moodsStats');
        var breakdownEl = document.getElementById('moodsBreakdown');
        var labelEl = document.getElementById('moodMonthLabel');
        if (!container || !statsEl || !breakdownEl) return;

        var uid = getCurrentSessionUid();
        if (!uid) {
            container.innerHTML = '<div class="admin-empty">Inicia sesión para ver estadísticas</div>';
            return;
        }

        var year = date.getFullYear();
        var month = String(date.getMonth() + 1).padStart(2, '0');
        labelEl.textContent = getMonthName(date.getMonth(), year);

        // Fetch all moods for this month
        var monthPrefix = year + '-' + month;
        try {
            var snap = await window.db.collection('users').doc(uid).collection('moods').get();
            var monthMoods = [];
            snap.forEach(function (doc) {
                if (doc.id.startsWith(monthPrefix)) {
                    monthMoods.push({ date: doc.id, ...doc.data() });
                }
            });

            // Calendar grid
            var daysInMonth = new Date(year, date.getMonth() + 1, 0).getDate();
            var firstDay = new Date(year, date.getMonth(), 1).getDay(); // 0=Sun
            var moodMap = {};
            monthMoods.forEach(function (m) { moodMap[m.date] = m; });

            var html = '<div class="moods-calendar-grid">';
            // Day headers
            ['D', 'L', 'M', 'X', 'J', 'V', 'S'].forEach(function (d) {
                html += '<div class="moods-cal-header">' + d + '</div>';
            });
            // Empty cells before first day
            for (var i = 0; i < firstDay; i++) {
                html += '<div class="moods-cal-day empty"></div>';
            }
            // Day cells
            var todayStr = new Date().toISOString().split('T')[0];
            for (var day = 1; day <= daysInMonth; day++) {
                var dateStr = year + '-' + month + '-' + String(day).padStart(2, '0');
                var mood = moodMap[dateStr];
                var isToday = dateStr === todayStr;
                var cls = 'moods-cal-day' + (isToday ? ' today' : '') + (mood ? ' has-mood' : '');
                var emoji = mood ? (mood.emoji || MOOD_EMOJIS[mood.mood] || '—') : '';
                html += '<div class="' + cls + '" title="' + dateStr + ': ' + (mood ? mood.label : 'Sin registro') + '">' +
                    '<span class="moods-cal-num">' + day + '</span>' +
                    (emoji ? '<span class="moods-cal-emoji">' + emoji + '</span>' : '') +
                    '</div>';
            }
            html += '</div>';
            container.innerHTML = html;

            // Stats
            if (monthMoods.length === 0) {
                statsEl.innerHTML = '<div class="admin-empty">No hay datos de ánimo para este mes</div>';
                breakdownEl.innerHTML = '';
                return;
            }

            // Count breakdown
            var counts = {};
            monthMoods.forEach(function (m) {
                var key = m.mood || 'unknown';
                counts[key] = (counts[key] || 0) + 1;
            });

            var bestMood = '';
            var bestCount = 0;
            Object.keys(counts).forEach(function (key) {
                if (counts[key] > bestCount) { bestCount = counts[key]; bestMood = key; }
            });

            statsEl.innerHTML = '<div class="moods-stats-row">' +
                '<div class="moods-stat"><span class="moods-stat-num">' + monthMoods.length + '</span> días registrados</div>' +
                '<div class="moods-stat"><span class="moods-stat-num">' + (MOOD_EMOJIS[bestMood] || '—') + '</span> más frecuente</div>' +
                '<div class="moods-stat"><span class="moods-stat-num">' + calcMoodAverage(monthMoods) + '</span> media del mes</div>' +
                '</div>';

            // Breakdown bars
            var breakdownHtml = '<div class="moods-breakdown-bars">';
            var moodOrder = ['great', 'good', 'meh', 'bad', 'love'];
            moodOrder.forEach(function (key) {
                var count = counts[key] || 0;
                var pct = monthMoods.length > 0 ? Math.round(count / monthMoods.length * 100) : 0;
                breakdownHtml += '<div class="moods-bar-row">' +
                    '<span class="moods-bar-label">' + (MOOD_EMOJIS[key] || key) + ' ' + (MOOD_LABELS[key] || key) + '</span>' +
                    '<div class="moods-bar-track">' +
                    '<div class="moods-bar-fill mood-bar-' + key + '" style="width:' + pct + '%"></div>' +
                    '</div>' +
                    '<span class="moods-bar-pct">' + pct + '%</span>' +
                    '</div>';
            });
            breakdownHtml += '</div>';
            breakdownEl.innerHTML = breakdownHtml;

        } catch (err) {
            container.innerHTML = '<div class="admin-empty">Error cargando datos</div>';
            console.warn('Error loading month moods:', err);
        }
    }

    function bindMoodNav() {
        var prevBtn = document.getElementById('moodPrevMonth');
        var nextBtn = document.getElementById('moodNextMonth');
        if (prevBtn) {
            prevBtn.onclick = function () {
                moodCurrentDate.setMonth(moodCurrentDate.getMonth() - 1);
                renderMoodMonth(moodCurrentDate);
            };
        }
        if (nextBtn) {
            nextBtn.onclick = function () {
                moodCurrentDate.setMonth(moodCurrentDate.getMonth() + 1);
                renderMoodMonth(moodCurrentDate);
            };
        }
    }

    function getMonthName(monthIndex, year) {
        var names = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        return names[monthIndex] + ' ' + year;
    }

    function getCurrentSessionUid() {
        if (window.SessionManager && window.SessionManager.isLoggedIn()) {
            return window.SessionManager.getUid();
        }
        if (window.auth && window.auth.currentUser) {
            return window.auth.currentUser.uid;
        }
        return null;
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
        document.getElementById('usuariosAddBtn').addEventListener('click', function () { showUserForm(); });
    }

    // ==========================================
    // VERIFICAR QUE ES ADMIN
    // ==========================================

    function checkAdminAccess() {
        var session = typeof SessionManager !== 'undefined' ? SessionManager.getSession() : null;
        if (!session || !PermissionService || !PermissionService.canAccessAdmin()) {
            document.querySelector('.admin-content').innerHTML =
                '<div style="text-align:center;padding:60px 20px;color:var(--umbra-ash);">' +
                '<div style="font-size:3rem;margin-bottom:16px;">🔒</div>' +
                '<h2 style="font-family:Playfair Display,serif;color:var(--umbra-light);">Acceso restringido</h2>' +
                '<p>Solo el administrador puede acceder a esta pagina.</p></div>';
            document.getElementById('adminTabs').style.display = 'none';
            document.getElementById('adminStatus').querySelector('span:last-child').textContent = 'Sin acceso';
            document.querySelector('.status-dot').classList.add('offline');
            return false;
        }
        document.getElementById('adminStatus').querySelector('span:last-child').textContent = 'Conectado como ' + (session.username || session.name);
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
            waitForSession();
        }

        function waitForSession() {
            if (typeof SessionManager === 'undefined' || !SessionManager) {
                setTimeout(waitForSession, 300);
                return;
            }
            SessionManager.onAuthStateChanged(function (user) {
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

    // ==========================================
    // USUARIOS
    // ==========================================

    var usuariosCache = [];

    async function loadUsuarios() {
        var list = document.getElementById('usuariosList');
        list.innerHTML = '<div class="admin-empty">Cargando...</div>';

        try {
            usuariosCache = await UserService.listUsers();
            renderUsuariosList(usuariosCache);
        } catch (err) {
            list.innerHTML = '<div class="admin-empty">Error: ' + escapeHtml(err.message) + '</div>';
        }
    }

    function renderUsuariosList(users) {
        var list = document.getElementById('usuariosList');
        if (users.length === 0) {
            list.innerHTML = '<div class="admin-empty">No hay usuarios</div>';
            return;
        }

        list.innerHTML = users.map(function (u) {
            var initials = (u.name || u.username || '?').charAt(0).toUpperCase();
            var photoHtml = u.photo
                ? '<img src="' + escapeHtml(u.photo) + '" class="user-avatar-img" alt="">'
                : '<div class="user-avatar-placeholder">' + initials + '</div>';
            var statusClass = u.enabled !== false ? 'status-active' : 'status-disabled';
            var statusText = u.enabled !== false ? 'Activo' : 'Inactivo';
            var lastLogin = u.lastLogin ? new Date(u.lastLogin).toLocaleDateString('es') : 'Nunca';

            return '<div class="admin-list-item" onclick="AdminApp.viewUser(\'' + u.id + '\')" style="cursor:pointer">' +
                '<div class="item-content" style="display:flex;align-items:center;gap:12px;">' +
                    '<div class="user-avatar-sm">' + photoHtml + '</div>' +
                    '<div>' +
                        '<div class="item-title">' + escapeHtml(u.name || u.username) + '</div>' +
                        '<div class="item-sub">@' + escapeHtml(u.username) + ' · ' + escapeHtml(u.role) + ' · ' + statusText + ' · Ultimo acceso: ' + lastLogin + '</div>' +
                    '</div>' +
                '</div>' +
                '<div class="item-actions">' +
                    '<button class="item-action-btn edit" onclick="event.stopPropagation(); AdminApp.viewUser(\'' + u.id + '\')"><i data-lucide="pencil"></i></button>' +
                '</div>' +
            '</div>';
        }).join('');
        if (typeof lucide !== 'undefined') lucide.createIcons({ root: list });
    }

    // Search
    document.addEventListener('DOMContentLoaded', function () {
        var searchInput = document.getElementById('usuariosSearch');
        if (searchInput) {
            searchInput.addEventListener('input', function () {
                var q = this.value.trim().toLowerCase();
                if (!q) { renderUsuariosList(usuariosCache); return; }
                var filtered = usuariosCache.filter(function (u) {
                    return (u.username || '').toLowerCase().indexOf(q) !== -1 ||
                           (u.name || '').toLowerCase().indexOf(q) !== -1 ||
                           (u.role || '').toLowerCase().indexOf(q) !== -1;
                });
                renderUsuariosList(filtered);
            });
        }
    });

    window.AdminApp.viewUser = async function (userId) {
        try {
            var user = await UserService.getUser(userId);
            if (!user) { showToast('Usuario no encontrado', true); return; }

            var currentPassword = user.password;
            if (Encryption.isEncrypted(currentPassword)) {
                currentPassword = Encryption.decrypt(currentPassword);
            }

            var bodyHtml =
                '<div class="user-detail-grid">' +
                    '<div class="admin-field"><label>Foto URL</label><input type="url" id="uPhoto" value="' + escapeHtml(user.photo || '') + '"></div>' +
                    '<div class="admin-field"><label>Nombre</label><input type="text" id="uName" value="' + escapeHtml(user.name || '') + '"></div>' +
                    '<div class="admin-field"><label>Usuario</label><input type="text" id="uUsername" value="' + escapeHtml(user.username || '') + '"></div>' +
                    '<div class="admin-field"><label>Contrasena</label>' +
                        '<div style="display:flex;gap:8px;align-items:center;">' +
                            '<input type="text" id="uPassword" value="' + escapeHtml(currentPassword) + '" style="flex:1;">' +
                            '<button type="button" class="admin-btn admin-btn-secondary" onclick="navigator.clipboard.writeText(document.getElementById(\'uPassword\').value)">Copiar</button>' +
                        '</div>' +
                    '</div>' +
                    '<div class="admin-field"><label>Rol</label>' +
                        '<select id="uRole">' +
                            '<option value="user"' + (user.role === 'user' ? ' selected' : '') + '>Usuario</option>' +
                            '<option value="admin"' + (user.role === 'admin' ? ' selected' : '') + '>Admin</option>' +
                        '</select>' +
                    '</div>' +
                    '<div class="admin-field"><label>Estado</label>' +
                        '<select id="uEnabled">' +
                            '<option value="true"' + (user.enabled !== false ? ' selected' : '') + '>Activo</option>' +
                            '<option value="false"' + (user.enabled === false ? ' selected' : '') + '>Inactivo</option>' +
                        '</select>' +
                    '</div>' +
                    '<div class="admin-field" style="opacity:0.6;"><label>Creado</label><p>' + escapeHtml(user.createdAt || '') + '</p></div>' +
                    '<div class="admin-field" style="opacity:0.6;"><label>Ultimo acceso</label><p>' + escapeHtml(user.lastLogin || 'Nunca') + '</p></div>' +
                    '<div class="admin-field" style="opacity:0.6;"><label>Ultimo cambio contrasena</label><p>' + escapeHtml(user.lastPasswordChange || '') + '</p></div>' +
                '</div>';

            openModal('Editar usuario: ' + escapeHtml(user.username), bodyHtml, async function () {
                var updates = {
                    name: document.getElementById('uName').value.trim(),
                    username: document.getElementById('uUsername').value.trim(),
                    role: document.getElementById('uRole').value,
                    enabled: document.getElementById('uEnabled').value === 'true',
                    photo: document.getElementById('uPhoto').value.trim()
                };

                var newPass = document.getElementById('uPassword').value.trim();
                if (newPass && newPass !== currentPassword) {
                    updates.password = newPass;
                }

                await UserService.updateUser(userId, updates);
                showToast('Usuario actualizado');
                loadUsuarios();
            });
        } catch (err) {
            showToast('Error: ' + err.message, true);
        }
    };

    function showUserForm() {
        openModal('Nuevo usuario',
            '<div class="admin-field"><label>Usuario *</label><input type="text" id="uNewUsername" placeholder="nombre"></div>' +
            '<div class="admin-field"><label>Contrasena *</label><input type="text" id="uNewPassword" placeholder="contrasena"></div>' +
            '<div class="admin-field"><label>Nombre visible</label><input type="text" id="uNewName" placeholder="Nombre completo"></div>' +
            '<div class="admin-field"><label>Foto URL</label><input type="url" id="uNewPhoto" placeholder="https://..."></div>' +
            '<div class="admin-field"><label>Rol</label>' +
                '<select id="uNewRole">' +
                    '<option value="user">Usuario</option>' +
                    '<option value="admin">Admin</option>' +
                '</select>' +
            '</div>',
            async function () {
                var username = document.getElementById('uNewUsername').value.trim();
                var password = document.getElementById('uNewPassword').value.trim();
                if (!username || !password) throw new Error('Usuario y contrasena son obligatorios');

                await UserService.createUser({
                    username: username,
                    password: password,
                    name: document.getElementById('uNewName').value.trim() || username,
                    photo: document.getElementById('uNewPhoto').value.trim(),
                    role: document.getElementById('uNewRole').value
                });
                showToast('Usuario creado');
                loadUsuarios();
            }
        );
    }

    window.AdminApp.deleteUser = async function (userId) {
        if (!confirm('¿Eliminar este usuario? Esta accion no se puede deshacer.')) return;
        try {
            await UserService.deleteUser(userId);
            showToast('Usuario eliminado');
            loadUsuarios();
        } catch (err) {
            showToast('Error: ' + err.message, true);
        }
    };

    // ==========================================
    // ACTIVIDAD
    // ==========================================

    async function loadActividad() {
        var list = document.getElementById('actividadList');
        list.innerHTML = '<div class="admin-empty">Cargando...</div>';

        try {
            var entries = await ActivityLog.getRecent(50);
            if (entries.length === 0) {
                list.innerHTML = '<div class="admin-empty">No hay actividad registrada</div>';
                return;
            }

            list.innerHTML = entries.map(function (e) {
                var time = e.timestamp ? new Date(e.timestamp).toLocaleString('es') : '';
                return '<div class="admin-list-item">' +
                    '<div class="item-content">' +
                        '<div class="item-title">' + escapeHtml(ActivityLog.formatAction(e.action)) + '</div>' +
                        '<div class="item-sub">' + escapeHtml(e.details || '') + ' · ' + time + '</div>' +
                    '</div>' +
                '</div>';
            }).join('');
        } catch (err) {
            list.innerHTML = '<div class="admin-empty">Error cargando actividad</div>';
        }
    }

    return {
        loadSection: loadSection
    };
})();
