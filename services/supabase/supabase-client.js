// services/supabase/supabase-client.js
// Cliente Supabase para páginas legacy (sin ES modules)
// Usa la API REST de Supabase (PostgREST) directamente con fetch

var SupabaseClient = (function () {
  'use strict';

  var SUPABASE_URL = 'https://ydkyvfifadtwgmwgrslo.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_CymwHz4Lp2ieYb2_PPubNw_MmRIlYeI';
  var API_URL = SUPABASE_URL + '/rest/v1';

  function getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
      'Prefer': 'return=minimal'
    };
  }

  // ==========================================
  // GET - Obtener registros
  // ==========================================
  async function get(table, options) {
    options = options || {};
    var url = API_URL + '/' + table;
    var params = [];

    if (options.select) {
      params.push('select=' + encodeURIComponent(options.select));
    } else {
      params.push('select=*');
    }

    if (options.eq) {
      Object.keys(options.eq).forEach(function (key) {
        params.push(key + '=eq.' + encodeURIComponent(options.eq[key]));
      });
    }

    if (options.neq) {
      Object.keys(options.neq).forEach(function (key) {
        params.push(key + '=neq.' + encodeURIComponent(options.neq[key]));
      });
    }

    if (options.order) {
      params.push('order=' + encodeURIComponent(options.order));
    }

    if (options.limit) {
      params.push('limit=' + options.limit);
    }

    if (options.offset) {
      params.push('offset=' + options.offset);
    }

    if (params.length > 0) {
      url += '?' + params.join('&');
    }

    try {
      var res = await fetch(url, {
        method: 'GET',
        headers: getHeaders()
      });
      if (!res.ok) return [];
      var data = await res.json();
      // PostgREST returns body directly for GET
      return data;
    } catch (e) {
      return [];
    }
  }

  // ==========================================
  // GET ONE - Obtener el primer registro
  // ==========================================
  async function getOne(table, options) {
    options = options || {};
    options.limit = 1;
    var results = await get(table, options);
    return results && results.length > 0 ? results[0] : null;
  }

  // ==========================================
  // UPSERT - Insertar o actualizar
  // ==========================================
  async function upsert(table, data, onConflict) {
    var headers = getHeaders();
    headers['Prefer'] = 'resolution=merge-duplicates' + (onConflict ? ',return=representation' : '');

    var url = API_URL + '/' + table;
    if (onConflict) {
      url += '?on_conflict=' + onConflict;
    }

    try {
      var res = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(Array.isArray(data) ? data : [data])
      });
      return res.ok;
    } catch (e) {
      return false;
    }
  }

  // ==========================================
  // INSERT - Insertar registro
  // ==========================================
  async function insert(table, data) {
    var headers = getHeaders();
    headers['Prefer'] = 'return=representation';

    try {
      var res = await fetch(API_URL + '/' + table, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(Array.isArray(data) ? data : [data])
      });
      if (!res.ok) return null;
      var json = await res.json();
      return json;
    } catch (e) {
      return null;
    }
  }

  // ==========================================
  // UPDATE - Actualizar registros
  // ==========================================
  async function update(table, data, options) {
    options = options || {};
    var url = API_URL + '/' + table;
    var params = [];

    if (options.eq) {
      Object.keys(options.eq).forEach(function (key) {
        params.push(key + '=eq.' + encodeURIComponent(options.eq[key]));
      });
    }

    if (params.length > 0) {
      url += '?' + params.join('&');
    }

    try {
      var res = await fetch(url, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify(data)
      });
      return res.ok;
    } catch (e) {
      return false;
    }
  }

  // ==========================================
  // DELETE - Eliminar registros
  // ==========================================
  async function remove(table, options) {
    options = options || {};
    var url = API_URL + '/' + table;
    var params = [];

    if (options.eq) {
      Object.keys(options.eq).forEach(function (key) {
        params.push(key + '=eq.' + encodeURIComponent(options.eq[key]));
      });
    }

    if (params.length > 0) {
      url += '?' + params.join('&');
    }

    try {
      var res = await fetch(url, {
        method: 'DELETE',
        headers: getHeaders()
      });
      return res.ok;
    } catch (e) {
      return false;
    }
  }

  // ==========================================
  // API PÚBLICA
  // ==========================================
  return {
    get: get,
    getOne: getOne,
    upsert: upsert,
    insert: insert,
    update: update,
    delete: remove,
    // Helpers
    getSupabaseUrl: function () { return SUPABASE_URL; },
    getAnonKey: function () { return SUPABASE_ANON_KEY; }
  };
})();

if (typeof window !== 'undefined') {
  window.SupabaseClient = SupabaseClient;
}
