/* ==========================================
   Rincón — estado compartido
   Un solo objeto para las cinco vistas: la landing, la galería, los memes,
   las curiosidades y los audios se pasan el mismo contexto (carpeta abierta,
   favoritas, token de render...) en vez de duplicarlo por módulo.
   ========================================== */

import { GALLERY_FOLDERS } from '../../services/rincon-data.js';

export const state = {
  view: 'landing',
  galeriaFolder: Object.keys(GALLERY_FOLDERS || {})[0] || 'Atardeceres',
  galeriaFilter: 'todas',      // todas | favoritas | <carpeta>
  galeriaSort: 'recientes',    // recientes | antiguas
  galeriaUploads: [],          // fotos subidas por el usuario
  galeriaFavs: new Set(),      // URLs favoritas
  galleryToken: 0,             // token de render para batch
  calSynced: false,            // vídeos del calendario ya sincronizados en la galería
  memeView: 'albums',       // albums | album
  memeAlbumId: null,        // álbum abierto
  memeFilter: 'todos',      // todos | fotos | videos
  memeSort: 'recientes',    // recientes | antiguos | nombre
  memeQuery: '',            // búsqueda
  memeFavs: new Set(),      // URLs favoritas de memes
  renderToken: 0,
  curiosidadTab: 'landing',
  discoCat: 'todas',           // chip de categoría activo
  curioFavs: new Set(),        // curiosidades favoritas (user-scoped)
  curioDetail: null,           // id de la curiosidad abierta en su pestaña detalle
  editMode: false,             // edición de portadas de tarjetas (solo admin)
  covers: {},                  // portadas personalizadas por tarjeta
  audios: [],                  // lista de audios del Rincón (día 3)
  audiosLoaded: false,         // carga inicial hecha
  audiosView: 'months',        // months | detail
  audiosMonth: null,           // { year, month } abierto en detalle
  audiosEditId: null,          // id del audio en edición (nombre/fecha)
};
