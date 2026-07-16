// services/auth/profile.js
// Gestión de perfiles de usuario

const ProfileSystem = {};

// ==========================================
// CREAR / ACTUALIZAR PERFIL
// ==========================================

ProfileSystem.ensureProfile = async function(user) {
    if (!user || !window.db) return null;

    try {
        const docRef = window.db.collection('users').doc(user.uid);
        const doc = await docRef.get();

        if (doc.exists) {
            await docRef.update({
                'profile.lastLogin': new Date().toISOString()
            });
            return doc.data();
        }

        const isAdmin = typeof isAdminUser === 'function' && isAdminUser(user);
        const profile = {
            profile: {
                name: user.displayName || user.email || '',
                email: user.email || '',
                role: isAdmin ? 'admin' : 'user',
                createdAt: new Date().toISOString(),
                lastLogin: new Date().toISOString(),
                photoURL: user.photoURL || ''
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
        console.log('✅ Perfil creado para:', user.email);

        await ProfileSystem.migrateLocalData(user.uid);
        return profile;
    } catch (err) {
        console.error('❌ Error en ensureProfile:', err);
        return null;
    }
};

// ==========================================
// MIGRAR DATOS DE LOCALSTORAGE
// ==========================================

ProfileSystem.migrateLocalData = async function(uid) {
    const migrated = [];

    // 1. Progreso del calendario
    try {
        const savedProgress = localStorage.getItem('personalHub.giftProgress');
        if (savedProgress) {
            const progressData = JSON.parse(savedProgress);
            const calendarRef = window.db.collection('users').doc(uid).collection('progress').doc('calendar');
            await calendarRef.set({
                gifts: progressData,
                migratedAt: new Date().toISOString()
            });
            migrated.push('calendarProgress');
        }
    } catch (err) {
        console.warn('⚠️ Error migrando calendario:', err);
    }

    // 2. Preferencias del sidebar
    try {
        const sidebarDoc = await window.db.collection('config').doc('sidebar').get();
        if (sidebarDoc.exists && sidebarDoc.data().hiddenSections) {
            const hidden = sidebarDoc.data().hiddenSections;
            const prefsRef = window.db.collection('users').doc(uid).collection('preferences').doc('sidebar');
            await prefsRef.set({
                hiddenSections: hidden,
                migratedAt: new Date().toISOString()
            });
            migrated.push('sidebarPreferences');
        }
    } catch (err) {
        console.warn('⚠️ Error migrando sidebar:', err);
    }

    // 3. Progreso de series
    try {
        const seriesProgress = localStorage.getItem('seriesProgress');
        if (seriesProgress) {
            const seriesData = JSON.parse(seriesProgress);
            const seriesRef = window.db.collection('users').doc(uid).collection('progress').doc('series');
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
    }

    return migrated;
};

// ==========================================
// CARGAR DATOS DEL USUARIO
// ==========================================

ProfileSystem.loadProgress = async function(uid, type) {
    if (!uid || !window.db) return null;

    try {
        const ref = window.db.collection('users').doc(uid).collection('progress').doc(type);
        const doc = await ref.get();
        if (doc.exists) return doc.data();
    } catch (err) {
        console.warn('⚠️ Error cargando progreso:', type, err);
    }
    return null;
};

ProfileSystem.saveProgress = async function(uid, type, data) {
    if (!uid || !window.db) return;

    try {
        const ref = window.db.collection('users').doc(uid).collection('progress').doc(type);
        await ref.set(data, { merge: true });
    } catch (err) {
        console.warn('⚠️ Error guardando progreso:', type, err);
    }
};

// ==========================================
// CARGAR PREFERENCIAS
// ==========================================

ProfileSystem.loadPreferences = async function(uid) {
    if (!uid || !window.db) return null;

    try {
        const ref = window.db.collection('users').doc(uid).collection('preferences').doc('sidebar');
        const doc = await ref.get();
        if (doc.exists) return doc.data();
    } catch (err) {
        console.warn('⚠️ Error cargando preferencias:', err);
    }
    return null;
};

ProfileSystem.savePreferences = async function(uid, prefs) {
    if (!uid || !window.db) return;

    try {
        const ref = window.db.collection('users').doc(uid).collection('preferences').doc('sidebar');
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