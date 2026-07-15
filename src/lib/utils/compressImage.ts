/** Comprime fotos de evidencia antes de subir (menos MB → registro más rápido). */

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.82;
/** Si ya pesa menos, no comprimir. */
const SKIP_BELOW_BYTES = 280_000;

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo leer la imagen'));
    };
    img.src = url;
  });
}

/**
 * Redimensiona y convierte a JPEG para acelerar la subida a Storage.
 * PNG se convierte a JPG; archivos pequeños se dejan igual.
 */
export async function compressImageForUpload(file: File): Promise<File> {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const mime =
    file.type === 'image/jpg' || (ext === 'jpg' && !file.type)
      ? 'image/jpeg'
      : file.type;

  if (!mime.match(/^image\/(jpeg|png)$/)) {
    return file;
  }

  if (file.size <= SKIP_BELOW_BYTES) {
    return file;
  }

  try {
    const img = await loadImageFromFile(file);
    const scale = Math.min(MAX_EDGE / img.width, MAX_EDGE / img.height, 1);
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    ctx.drawImage(img, 0, 0, w, h);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
    );

    if (!blob || blob.size >= file.size) {
      return file;
    }

    const baseName = file.name.replace(/\.[^.]+$/i, '') || 'evidencia';
    return new File([blob], `${baseName}.jpg`, {
      type: 'image/jpeg',
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  }
}
