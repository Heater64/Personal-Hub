// Verifica el aislamiento de datos entre dos cuentas reales.
//
// No guarda ninguna credencial en el repo: las lee de variables de
// entorno. Uso:
//
//   VERIFICAR_A=admin@personalhub.com VERIFICAR_PASS_A=... \
//   VERIFICAR_B=dada@personalhub.com   VERIFICAR_PASS_B=... \
//   node scripts/verificar-aislamiento.mjs
//
// Las claves de Supabase se leen de .env (VITE_SUPABASE_URL y
// VITE_SUPABASE_ANON_KEY), igual que la app. Cada cuenta entra con su
// contraseña y consulta con SU token, que es la unica forma de saber
// lo que de verdad ve cada una.
//
// Hace dos cosas:
//   1. LEE con cada token y cuenta cuántas filas del otro ve.
//   2. ESCRIBE una fila de prueba en nombre del otro, que debe ser
//      rechazada. Es imprescindible: leer no detecta una politica
//      `USING (true)` si la tabla está vacía, que es como se coló lo de
//      playlists. Si la escritura se acepta, la fila se borra al
//      instante con service_role y se reporta como fuga.
//
// No modifica datos reales: lo único que llega a escribirse es la fila
// de sonda, y se elimina tanto si el aislamiento funciona como si no.

import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  fs
    .readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    }),
);

const A = { nombre: 'A', email: process.env.VERIFICAR_A, pass: process.env.VERIFICAR_PASS_A };
const B = { nombre: 'B', email: process.env.VERIFICAR_B, pass: process.env.VERIFICAR_PASS_B };

if (!A.email || !A.pass || !B.email || !B.pass) {
  console.error(
    'Faltan credenciales. Define VERIFICAR_A, VERIFICAR_PASS_A, VERIFICAR_B y VERIFICAR_PASS_B.',
  );
  process.exit(2);
}

const CUENTAS = [A, B];

// Tabla -> columnas que dicen de quien es cada fila.
const TABLAS = [
  ['profiles', ['id']],
  ['moods', ['user_id']],
  ['user_progress', ['user_id']],
  ['playlists', ['created_by']],
  ['activity_log', ['user_id']],
  ['analytics_visits', ['user_id', 'visitor_id']],
  ['push_subscriptions', ['user_id']],
  // Salas de juego: una sala es legitima si el usuario participa de ella
  // (anfitrion o invitado). Que el otro sea el anfitrion NO es una fuga:
  // es una partida compartida entre los dos.
  ['game_rooms', ['host_id', 'guest_id']],
  ['game_invitations', ['inviter_id', 'invitee_id']],
  ['game_room_players', ['user_id']],
  // El contenido es comun a proposito (cartas, memes, musica): cada
  // usuario ve el mismo catalogo, asi que no se cuenta como fuga.
  ['content', []],
];

async function sesion(cuenta) {
  const cliente = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { data, error } = await cliente.auth.signInWithPassword({
    email: cuenta.email,
    password: cuenta.pass,
  });
  if (error) throw new Error(`No se pudo entrar como ${cuenta.email}: ${error.message}`);
  return {
    id: data.user.id,
    email: cuenta.email,
    // Cliente nuevo con el JWT de ESA cuenta. La sesion no se persiste,
    // asi que solo manda la cabecera que le ponemos aqui.
    client: createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
    }),
  };
}

const s = {};
for (const c of CUENTAS) s[c.nombre] = await sesion(c);

console.log('=== SESIONES ===');
for (const c of CUENTAS) {
  const admin = await s[c.nombre].client.rpc('is_admin');
  const enabled = await s[c.nombre].client.rpc('is_enabled');
  console.log(
    `  ${c.nombre}  ${s[c.nombre].email}  is_admin=${admin.data}  is_enabled=${enabled.data}`,
  );
}

console.log('\n=== AISLAMIENTO: filas ajenas visibles para cada cuenta ===');
console.log('    (el admin ve todo por diseño: is_admin() lo permite)');

let fugas = 0;
for (const c of CUENTAS) {
  const otro = CUENTAS.find((x) => x.nombre !== c.nombre);
  console.log(`\n  -- ${c.nombre} (${c.email}) --`);
  for (const [tabla, cols] of TABLAS) {
    const { data, error } = await s[c.nombre].client.from(tabla).select('*').limit(2000);
    if (error) {
      console.log(`     ${tabla.padEnd(21)} sin acceso: ${error.message.slice(0, 55)}`);
      continue;
    }
    // Sin columnas de dueno: tabla comun, no cuenta.
    if (cols.length === 0) {
      console.log(`     ${tabla.padEnd(21)} ${String(data.length).padEnd(5)} (comun a los dos)`);
      continue;
    }
    const esMia = (r) => cols.some((col) => r[col] === s[c.nombre].id);
    const esSuya = (r) => cols.some((col) => r[col] === s[otro.nombre].id);
    const propias = data.filter(esMia).length;
    // Una fila compartida (partida de juego, invitacion) es legitima: los dos
    // son parte de ella. Solo es fuga la fila del otro en la que yo no estoy.
    const compartidas = data.filter((r) => esMia(r) && esSuya(r)).length;
    const ajenasPuras = data.filter((r) => esSuya(r) && !esMia(r)).length;
    const esAdmin = (await s[c.nombre].client.rpc('is_admin')).data === true;
    const fuga = ajenasPuras > 0 && !esAdmin;
    if (fuga) fugas++;
    const nota = fuga
      ? '   <-- FUGA'
      : esAdmin && ajenasPuras > 0
        ? '   (admin, permitido)'
        : '';
    console.log(
      `     ${tabla.padEnd(21)} ve ${String(data.length).padEnd(5)}` +
        ` | propias ${propias} | compartidas ${compartidas} | solo del otro ${ajenasPuras}${nota}`,
    );
  }
}

console.log(`\n=== ${fugas === 0 ? 'SIN FUGAS' : fugas + ' FUGA(S) REALES'} ===`);

// ============================================================
// SONDA DE ESCRITURA
// ============================================================
// Leer no basta para detectar una politica `USING (true)`: si la tabla
// esta vacia, B no ve ninguna fila de A y el fallo pasa desapercibido.
// Fue justo lo que paso con playlists, que se leia 0 filas de 0 y aun
// asi cualquier cuenta podia borrar las de los demas.
//
// Asi que se intenta escribir EN NOMBRE DEL OTRO. Lo correcto es que la
// base de datos lo rechace. Si lo acepta, la fila es real, se borra al
// instante con service_role y se reporta como fuga.

console.log('\n=== ESCRITURA EN NOMBRE DEL OTRO (debe rechazarse) ===');
const svc = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

let fugasEscritura = 0;
for (const c of CUENTAS) {
  const otro = CUENTAS.find((x) => x.nombre !== c.nombre);
  // Al admin SI le esta permitido escribir en nombre de otro (is_admin()),
  // asi que sondearle solo daria un falso positivo. Se prueba el lado que
  // no deberia poder: la cuenta normal.
  const esAdmin = (await s[c.nombre].client.rpc('is_admin')).data === true;
  if (esAdmin) {
    console.log(`  ${c.nombre}: omitido (es admin, puede escribir en nombre de otro por diseño)`);
    continue;
  }
  const marca = `sonda_${Date.now()}_${c.nombre}`;
  // `id` es TEXT PRIMARY KEY sin default y `songs` es NOT NULL: sin esto
  // la base rechaza la fila por columnas y la sonda daría un falso "bien".
  const fila = { id: marca, name: marca, icon: '❤️', songs: [], created_by: s[otro.nombre].id };
  const { data, error } = await s[c.nombre].client.from('playlists').insert(fila).select();

  if (error) {
    // Solo cuenta como correcto si el rechazo es de verdad por RLS.
    const porRLS = /row-level security|violates/i.test(error.message);
    if (porRLS) {
      console.log(`  ${c.nombre}: RECHAZADO por RLS (correcto)`);
    } else {
      fugasEscritura++;
      console.log(`  ${c.nombre}: RECHAZADO pero NO por RLS -> ${error.message.slice(0, 70)}`);
      console.log('     la sonda no es concluyente: revisa la definicion de playlists');
    }
  } else if (!data?.length) {
    console.log(`  ${c.nombre}: RECHAZADO (correcto), sin filas devueltas`);
  } else {
    fugasEscritura++;
    console.log(`  ${c.nombre}: ACEPTADO  <-- FUGA: pudo crear una playlist de ${otro.nombre}`);
    await svc.from('playlists').delete().eq('id', marca);
    console.log(`     fila de prueba "${marca}" eliminada con service_role`);
  }
}

const totalFugas = fugas + fugasEscritura;
console.log(
  `\n=== TOTAL: ${totalFugas === 0 ? 'AISLAMIENTO CORRECTO' : totalFugas + ' FUGA(S) REALES'} ===`,
);
process.exit(totalFugas === 0 ? 0 : 1);
