/**
 * Intent rule 3: images are always WebP [scott, 2026-10-17]. Admin uploads (home content images,
 * avatars) are re-encoded in the browser before they reach storage (max 2560px wide, q0.82).
 * GIF/SVG/WebP, and anything the browser can't decode or encode as WebP, pass through unchanged.
 */
export async function toWebpFile(file: File): Promise<File> {
  if (!/^image\/(jpeg|png)$/.test(file.type)) return file;
  try {
    const bmp = await createImageBitmap(file);
    const w = Math.min(bmp.width, 2560);
    const h = Math.round((bmp.height / bmp.width) * w);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    c.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/webp", 0.82));
    if (!blob || blob.type !== "image/webp") return file;
    return new File([blob], file.name.replace(/\.(jpe?g|png)$/i, "") + ".webp", { type: "image/webp" });
  } catch {
    return file;
  }
}
