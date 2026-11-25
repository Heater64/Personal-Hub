import { createClient } from '@supabase/supabase-js';
import { v2 as cloudinary } from 'cloudinary';

const LIMITS = { image: 20e6, gif: 20e6, audio: 25e6, pdf: 25e6, video: 100e6 };
const TYPES = { image: 'image', gif: 'image', audio: 'video', video: 'video', pdf: 'raw' };

function json(res, status, body) { return res.status(status).json(body); }
export function configCloudinary(env = process.env) {
  // Cloudinary SDKs read CLOUDINARY_URL at process start. Vercel currently
  // stores credentials in that format, while local setups may use split vars.
  const sdkConfig = cloudinary.config();
  const cloudName = env.CLOUDINARY_CLOUD_NAME || sdkConfig.cloud_name;
  const apiKey = env.CLOUDINARY_API_KEY || sdkConfig.api_key;
  const apiSecret = env.CLOUDINARY_API_SECRET || sdkConfig.api_secret;
  if (!cloudName || !apiKey || !apiSecret) throw new Error('Cloudinary no está configurado en el servidor.');
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
  return { cloudName, apiKey };
}

async function caller(req, res) {
  const url = process.env.VITE_SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!url || !anon || !service || !token) { json(res, 401, { error: 'Sesión necesaria.' }); return null; }
  const auth = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await auth.auth.getUser(token);
  if (authError || !authData.user) { json(res, 401, { error: 'Sesión no válida.' }); return null; }
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: profile } = await admin.from('profiles').select('enabled').eq('id', authData.user.id).maybeSingle();
  if (profile?.enabled === false) { json(res, 403, { error: 'Cuenta deshabilitada.' }); return null; }
  const { data: member, error: memberError } = await admin.from('couple_members').select('couple_id').eq('user_id', authData.user.id).maybeSingle();
  if (memberError || !member?.couple_id) { json(res, 403, { error: 'La pareja todavía no está configurada.' }); return null; }
  return { admin, user: authData.user, coupleId: member.couple_id };
}

function validPrefix(publicId, coupleId) {
  return publicId.startsWith(`tamp/${coupleId}/`) && publicId.length < 220;
}

export default async function handler(req, res) {
  if (!['GET', 'POST', 'DELETE'].includes(req.method)) return json(res, 405, { error: 'Método no permitido.' });
  const ctx = await caller(req, res);
  if (!ctx) return;
  try {
    const cloud = configCloudinary();
    if (req.method === 'GET') {
      const { data, error } = await ctx.admin.from('tamp_media').select('id,author_id,visibility,kind,public_id,resource_type,format,bytes,width,height,title,created_at,removed_at').eq('couple_id', ctx.coupleId).is('removed_at', null).order('created_at', { ascending: false });
      if (error) throw error;
      const items = (data || []).filter(item => item.visibility === 'shared' || item.author_id === ctx.user.id).map(item => ({ ...item, download: cloudinary.utils.private_download_url(item.public_id, item.format || undefined, { resource_type: item.resource_type, type: 'authenticated', attachment: false, expires_at: Math.floor(Date.now() / 1000) + 300 }) }));
      return json(res, 200, { items });
    }
    if (req.method === 'DELETE') {
      const id = String(req.body?.id || '');
      if (!id) return json(res, 400, { error: 'Falta el archivo.' });
      const { error } = await ctx.admin.from('tamp_media').update({ removed_at: new Date().toISOString() }).eq('id', id).eq('couple_id', ctx.coupleId).eq('author_id', ctx.user.id).is('removed_at', null);
      if (error) throw error;
      return json(res, 200, { ok: true });
    }
    const action = req.body?.action || 'sign';
    if (action === 'sign') {
      const kind = String(req.body?.kind || '');
      const bytes = Number(req.body?.bytes || 0);
      const visibility = req.body?.visibility === 'private' ? 'private' : 'shared';
      if (!LIMITS[kind] || !TYPES[kind] || !Number.isSafeInteger(bytes) || bytes <= 0 || bytes > LIMITS[kind]) return json(res, 400, { error: 'Tipo o tamaño no permitido.' });
      const timestamp = Math.floor(Date.now() / 1000);
      const publicId = `tamp/${ctx.coupleId}/${crypto.randomUUID()}`;
      const folder = `tamp/${ctx.coupleId}`;
      const params = { timestamp, folder, public_id: publicId, type: 'authenticated', overwrite: false, context: `kind=${kind}|visibility=${visibility}` };
      const signature = cloudinary.utils.api_sign_request(params, cloudinary.config().api_secret);
      return json(res, 200, { ...params, signature, api_key: cloud.apiKey, cloud_name: cloud.cloudName, upload_url: `https://api.cloudinary.com/v1_1/${cloud.cloudName}/${TYPES[kind]}/upload` });
    }
    if (action === 'commit') {
      const kind = String(req.body?.kind || '');
      const publicId = String(req.body?.public_id || '');
      const visibility = req.body?.visibility === 'private' ? 'private' : 'shared';
      if (!LIMITS[kind] || !validPrefix(publicId, ctx.coupleId)) return json(res, 400, { error: 'Referencia no válida.' });
      const resource = await cloudinary.api.resource(publicId, { resource_type: TYPES[kind], type: 'authenticated' });
      if (!resource || Number(resource.bytes) > LIMITS[kind]) return json(res, 400, { error: 'El archivo supera el límite.' });
      const { data, error } = await ctx.admin.from('tamp_media').insert({ couple_id: ctx.coupleId, author_id: ctx.user.id, visibility, kind, public_id: publicId, resource_type: TYPES[kind], format: resource.format || '', bytes: resource.bytes, width: resource.width || null, height: resource.height || null, title: String(req.body?.title || '').trim().slice(0, 140) }).select('id').single();
      if (error) throw error;
      return json(res, 201, { id: data.id });
    }
    return json(res, 400, { error: 'Acción no válida.' });
  } catch (error) {
    console.error('[api/tamp-media]', error.message);
    return json(res, 500, { error: 'No se pudo completar la operación.' });
  }
}
