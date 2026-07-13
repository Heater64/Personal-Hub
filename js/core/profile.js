// js/core/profile.js
// Gestión de perfiles de usuario y migración de datos al primer inicio

var ProfileSystem = {};

// ==========================================
// CREAR / ACTUALIZAR PERFIL
// ==========================================

ProfileSystem.ensureProfile = async function (user) {
    if (!user || !window.db) return null;

    try {
        var docRef = window.db.collection('users').doc(user.uid);
        var doc = await docRef.get();

        if (doc.exists) {
            // Actualizar lastLogin
            await docRef.update({
                'profile.lastLogin': new Date().toISOString()
            });
            return doc.data();
        }

        // Crear perfil nuevo
        var isAdmin = typeof isAdminUser === 'function' && isAdminUser(user);
        var profile = {
            profile: {
                name: user.displayName || user.email || '',
                email: user.email || '',
                role: isAdmin ? 'admin' : 'user',
                createdAt: new Date().toISOString(),
                lastLogin: new Date().toISOString(),
                photoURL: user.photoURL || ''
            },
            preferences: {
                sidebar: {
                    hiddenSections: []
                }
            },
            progress: {
                calendar: {},
                games: {}
            }
        };

        await docRef.set(profile);
        console.log('✅ Perfil creado para:', user.email);

        // Migrar datos de localStorage al nuevo perfil
        await ProfileSystem.migrateLocalData(user.uid);

        return profile;
    } catch (err) {
        console.error('❌ Error en ensureProfile:', err);
        return null;
    }
};

// ==========================================
// MIGRAR DATOS DE LOCALSTORAGE A FIRESTORE
// ==========================================

ProfileSystem.migrateLocalData = async function (uid) {
    var migrated = [];

    // 1. Migrar progreso del calendario (giftProgress)
    try {
        var savedProgress = localStorage.getItem('personalHub.giftProgress');
        if (savedProgress) {
            var progressData = JSON.parse(savedProgress);
            var calendarRef = window.db.collection('users').doc(uid).collection('progress').doc('calendar');
            await calendarRef.set({
                gifts: progressData,
                migratedAt: new Date().toISOString()
            });
            migrated.push('calendarProgress');
            console.log('📦 Calendario migrado:', Object.keys(progressData).length, 'regalos');
        }
    } catch (err) {
        console.warn('⚠️ Error migrando calendario:', err);
    }

    // 2. Migrar preferencias del sidebar (hiddenSections)
    try {
        var sidebarDoc = await window.db.collection('config').doc('sidebar').get();
        if (sidebarDoc.exists && sidebarDoc.data().hiddenSections) {
            var hidden = sidebarDoc.data().hiddenSections;
            var prefsRef = window.db.collection('users').doc(uid).collection('preferences').doc('sidebar');
            await prefsRef.set({
                hiddenSections: hidden,
                migratedAt: new Date().toISOString()
            });
            migrated.push('sidebarPreferences');
        }
    } catch (err) {
        console.warn('⚠️ Error migrando sidebar:', err);
    }

    // 3. Migrar progreso de series
    try {
        var seriesProgress = localStorage.getItem('seriesProgress');
        if (seriesProgress) {
            var seriesData = JSON.parse(seriesProgress);
            var seriesRef = window.db.collection('users').doc(uid).collection('progress').doc('series');
            await seriesRef.set({
                data: seriesData,
                migratedAt: new Date().toISOString()
            });
            migrated.push('seriesProgress');
        }
    } catch (err) {
        console.warn('⚠️ Error migrando series:', err);
    }

    if (migrated.length > 0) {
        console.log('✅ Datos migrados:', migrated.join(', '));
    } else {
        console.log('📭 No hay datos locales para migrar');
    }

    return migrated;
};

// ==========================================
// CARGAR DATOS DEL USUARIO DESDE FIRESTORE
// ==========================================

ProfileSystem.loadProgress = async function (uid, type) {
    if (!uid || !window.db) return null;

    try {
        var ref = window.db.collection('users').doc(uid).collection('progress').doc(type);
        var doc = await ref.get();
        if (doc.exists) {
            return doc.data();
        }
    } catch (err) {
        console.warn('⚠️ Error cargando progreso:', type, err);
    }
    return null;
};

ProfileSystem.saveProgress = async function (uid, type, data) {
    if (!uid || !window.db) return;

    try {
        var ref = window.db.collection('users').doc(uid).collection('progress').doc(type);
        await ref.set(data, { merge: true });
    } catch (err) {
        console.warn('⚠️ Error guardando progreso:', type, err);
    }
};

// ==========================================
// CARGAR PREFERENCIAS DEL USUARIO
// ==========================================

ProfileSystem.loadPreferences = async function (uid) {
    if (!uid || !window.db) return null;

    try {
        var ref = window.db.collection('users').doc(uid).collection('preferences').doc('sidebar');
        var doc = await ref.get();
        if (doc.exists) {
            return doc.data();
        }
    } catch (err) {
        console.warn('⚠️ Error cargando preferencias:', err);
    }
    return null;
};

ProfileSystem.savePreferences = async function (uid, prefs) {
    if (!uid || !window.db) return;

    try {
        var ref = window.db.collection('users').doc(uid).collection('preferences').doc('sidebar');
        await ref.set(prefs, { merge: true });
    } catch (err) {
        console.warn('⚠️ Error guardando preferencias:', err);
    }
};

// Exportar global
if (typeof window !== 'undefined') {
    window.ProfileSystem = ProfileSystem;
}

console.log('📁 profile.js cargado');
