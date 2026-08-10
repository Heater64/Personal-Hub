/* ==========================================
   Admin API: subida firmada a Cloudinary
   Requiere sesión de admin (misma fuente de
   verdad que api/users.js). Usa CLOUDINARY_URL
   (cloudinary://api_key:api_secret@cloud_name)
   desde las variables de entorno del servidor.

   Recibe JSON { file, folder?, publicId? } donde
   file es un data URI (data:<mime>;base64,...).

   NOTA: Vercel limita el body a ~4.5 MB, así que
   esta vía sirve para fotos/audios/PDFs de hasta
   ~3 MB. Para vídeos grandes usa un unsigned
   preset (subida directa navegador → Cloudinary).
   ========================================== */

import { v2 as cloudinary } from 'cloudinary';
import { requireAdminCaller } from './_admin.js';

// Configuración desde CLOUDINARY_URL (cloudinary://key:secret@cloud_name).
// El SDK la lee automáticamente si está definida; solo forzamos explícito
// lo que venga por separado (sin pisar la URL con valores undefined).
cloudinary.config({
  ...(process.env.CLOUDINARY_CLOUD_NAME ? { cloud_name: process.env.CLOUDINARY_CLOUD_NAME } : {}),
  ...(process.env.CLOUDINARY_API_KEY ? { api_key: process.env.CLOUDINARY_API_KEY } : {}),
  ...(process.env.CLOUDINARY_API_SECRET ? { api_secret: process.env.CLOUDINARY_API_SECRET } : {}),
  secure: true
});

const MAX_BASE64_BYTES = 3 * 1024 * 1024; // ~3 MB de datos (≈4 MB en base64, margen bajo el límite de Vercel)

function parseDataUri(dataUri) {
  if (typeof dataUri !== 'string') return null;
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUri);
  if (!m) return null;
  const mime = m[1] || '';
  const isBase64 = m[2] === ';base64';
  const payload = isBase64 ? m[3] : encodeURIComponent(m[3]);
  return { mime, isBase64, payload };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Autorización común (admin)
  const authCtx = await requireAdminCaller(req, res);
  if (!authCtx) return; // ya respondió con el error

  const cloudConfigured = !!process.env.CLOUDINARY_URL
    || (!!process.env.CLOUDINARY_CLOUD_NAME && !!process.env.CLOUDINARY_API_KEY && !!process.env.CLOUDINARY_API_SECRET);
  if (!cloudConfigured) {
    return res.status(500).json({ error: 'CLOUDINARY_URL no está configurada en el servidor' });
  }

  const { file, folder, publicId } = req.body || {};
  const parsed = parseDataUri(file);
  if (!parsed) {
    return res.status(400).json({ error: 'El campo file debe ser un data URI válido' });
  }

  const rawBytes = parsed.isBase64
    ? Buffer.from(parsed.payload, 'base64').length
    : Buffer.byteLength(decodeURIComponent(parsed.payload), 'utf8');

  if (rawBytes > MAX_BASE64_BYTES) {
    return res.status(413).json({
      error: `El archivo pesa ${Math.round(rawBytes / 1024)} KB. Por esta vía el límite es ~3 MB; para archivos grandes configura un unsigned preset en Cloudinary (Settings → Upload).`
    });
  }

  try {
    const uploadOptions = {
      resource_type: 'auto',
      folder: folder && typeof folder === 'string' ? folder : 'personal-hub'
    };
    if (publicId && typeof publicId === 'string') uploadOptions.public_id = publicId;

    const result = await cloudinary.uploader.upload(file, uploadOptions);

    return res.status(200).json({
      secure_url: result.secure_url,
      public_id: result.public_id,
      format: result.format,
      resource_type: result.resource_type,
      bytes: result.bytes
    });
  } catch (err) {
    console.error('[api/upload-cloudinary] upload error:', err.message || err);
    const msg = err?.http_code === 401
      ? 'Credenciales de Cloudinary inválidas (revisa CLOUDINARY_URL en el servidor)'
      : (err?.message || 'Error al subir a Cloudinary');
    return res.status(err?.http_code || 500).json({ error: msg });
  }
}
