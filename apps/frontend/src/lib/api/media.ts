import api from './client';

export interface UploadedMedia {
  id: string;
  url: string;
  mime: string;
  size: number;
}

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/**
 * Reduz a imagem no navegador antes de enviar (celular manda fotos de 4-8 MB).
 * PNG continua PNG (preserva transparência do logo); o resto vira JPEG.
 * GIF e arquivos que o navegador não decodifica seguem como estão.
 */
export async function prepareImage(file: File, maxDim = 1600): Promise<Blob> {
  if (file.type === 'image/gif') return file;
  let bitmap: ImageBitmap | HTMLImageElement;
  try {
    bitmap = await loadImage(file);
  } catch {
    return file;
  }
  const w = bitmap.width;
  const h = bitmap.height;
  const scale = Math.min(1, maxDim / Math.max(w, h));
  const isPng = file.type === 'image/png';
  if (scale === 1 && file.size <= 600 * 1024) return file;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const type = isPng ? 'image/png' : 'image/jpeg';
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.86));
  if (!blob) return file;
  // se a recompressão não ajudou e o tamanho original já estava dentro do limite, manda o original
  if (scale === 1 && blob.size >= file.size) return file;
  return blob;
}

function loadImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') return createImageBitmap(file);
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('decode'));
    };
    img.src = url;
  });
}

export const mediaApi = {
  /** Envia uma imagem já reduzida e devolve a URL pública */
  upload: async (file: File, maxDim = 1600): Promise<UploadedMedia> => {
    if (!file.type.startsWith('image/')) throw new Error('Selecione um arquivo de imagem');
    const blob = await prepareImage(file, maxDim);
    if (blob.size > MAX_UPLOAD_BYTES) throw new Error('Imagem maior que 5 MB mesmo depois de reduzir');
    const fd = new FormData();
    const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/gif' ? 'gif' : blob.type === 'image/webp' ? 'webp' : 'jpg';
    fd.append('file', blob, `imagem.${ext}`);
    const { data } = await api.post<UploadedMedia>('/media', fd, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 });
    return data;
  },
  remove: async (id: string) => {
    await api.delete(`/media/${id}`);
  },
};
