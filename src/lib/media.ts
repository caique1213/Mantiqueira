export async function imageToWebp(file: File, maxDimension = 2200, quality = 0.86) {
  if (!file.type.startsWith('image/')) throw new Error('Selecione uma imagem válida.');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    throw new Error('Este navegador não conseguiu preparar a imagem.');
  }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error('Falha ao otimizar a imagem.'))),
      'image/webp',
      quality,
    );
  });
  return { blob, width, height };
}

export async function sha256(blob: Blob): Promise<string> {
  const bytes = await blob.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
