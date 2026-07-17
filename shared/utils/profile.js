// shared/utils/profile.js
// Gestion de perfiles de usuario y migracion de datos

var ProfileSystem = {};

ProfileSystem.ensureProfile = async function (user) {
    if (!user || !window.db) return null;

    try {
        var uid = user.uid || user.id;
        var docRef = window.db.collection('users').doc(uid);
        var doc = await docRef.get();

        if (doc.exists) {
            await docRef.update({
                'profile.lastLogin': new Date().toISOString()
            });
            return doc.data();
        }

        var profile = {
            profile: {
                name: user.name || user.displayName || user.username || '',
                role: user.role || 'user',
                createdAt: new Date().toISOString(),
                lastLogin: new Date().toISOString(),
                photo: user.photo || user.photoURL || ''
            },
            preferences: {
                sidebar: { hiddenSections: [] }
            },
            progress: {
                calendar: {},
                games: {}
            }
        };

        await docRef.set(profile);
        console.log('Perfil creado para:', user.username || user.email);
        await ProfileSystem.migrateLocalData(uid);
        return profile;
    } catch (err) {
        console.error('Error en ensureProfile:', err);
        return null;
    }
};

ProfileSystem.migrateLocalData = async function (uid) {
    var migrated = [];

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
        }
    } catch (err) {
        console.warn('Error migrando calendario:', err);
    }

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
        console.warn('Error migrando sidebar:', err);
    }

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
        console.warn('Error migrando series:', err);
    }

    return migrated;
};

ProfileSystem.loadProgress = async function (uid, type) {
    if (!uid || !window.db) return null;
    try {
        var ref = window.db.collection('users').doc(uid).collection('progress').doc(type);
        var doc = await ref.get();
        if (doc.exists) return doc.data();
    } catch (err) {
        console.warn('Error cargando progreso:', type, err);
    }
    return null;
};

ProfileSystem.saveProgress = async function (uid, type, data) {
    if (!uid || !window.db) return;
    try {
        var ref = window.db.collection('users').doc(uid).collection('progress').doc(type);
        await ref.set(data, { merge: true });
    } catch (err) {
        console.warn('Error guardando progreso:', type, err);
    }
};

ProfileSystem.loadPreferences = async function (uid) {
    if (!uid || !window.db) return null;
    try {
        var ref = window.db.collection('users').doc(uid).collection('preferences').doc('sidebar');
        var doc = await ref.get();
        if (doc.exists) return doc.data();
    } catch (err) {
        console.warn('Error cargando preferencias:', err);
    }
    return null;
};

ProfileSystem.savePreferences = async function (uid, prefs) {
    if (!uid || !window.db) return;
    try {
        var ref = window.db.collection('users').doc(uid).collection('preferences').doc('sidebar');
        await ref.set(prefs, { merge: true });
    } catch (err) {
        console.warn('Error guardando preferencias:', err);
    }
};

// ==========================================
// ACTUALIZAR FOTO / NOMBRE DEL PERFIL
// ==========================================

ProfileSystem.actualizarFoto = async function (uid, base64) {
    if (!uid || !window.db) return false;
    try {
        await window.db.collection('users').doc(uid).update({ 'profile.photoURL': base64 });
        if (typeof window.Haptica !== 'undefined') window.Haptica.exito();
        return true;
    } catch (err) {
        console.warn('Error actualizando foto:', err);
        return false;
    }
};

ProfileSystem.actualizarNombre = async function (uid, nombre) {
    if (!uid || !window.db) return false;
    try {
        await window.db.collection('users').doc(uid).update({ 'profile.name': nombre });
        if (typeof window.Haptica !== 'undefined') window.Haptica.exito();
        return true;
    } catch (err) {
        console.warn('Error actualizando nombre:', err);
        return false;
    }
};

if (typeof window !== 'undefined') {
    window.ProfileSystem = ProfileSystem;
}

console.log('profile.js cargado');
