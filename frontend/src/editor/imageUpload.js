// Redimensionne et compresse une image avant envoi (éco-conception : pas de photo de 5 Mo dans un article).
export async function compressImage(file, maxWidth = 1600, quality = 0.82) {
  if (!file.type.startsWith('image/')) throw new Error('Le fichier doit être une image.');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Image illisible.'));
      i.src = url;
    });
    const scale = Math.min(1, maxWidth / img.naturalWidth);
    const width = Math.round(img.naturalWidth * scale);
    const height = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(img, 0, 0, width, height);
    const type = file.type === 'image/png' && file.size < 300000 ? 'image/png' : 'image/webp';
    return { dataUrl: canvas.toDataURL(type, quality), width, height, name: file.name };
  } finally {
    URL.revokeObjectURL(url);
  }
}
