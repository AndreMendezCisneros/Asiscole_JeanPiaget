/**
 * Regenera favicons PNG, og-image (WhatsApp) y logos de reportes.
 * No modifica favicon.svg — ese SVG es solo para la UI del sistema.
 * Fuente: public/brand-icon-source.png
 *
 *   npm run generate:favicons
 */
import { readFileSync, existsSync, copyFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, '../public');
const sourcePath = resolve(publicDir, 'brand-icon-source.png');
const fallbackPath = resolve(publicDir, 'favicon-512.png');

function resolveSourceBuffer() {
  if (existsSync(sourcePath)) {
    return readFileSync(sourcePath);
  }
  if (existsSync(fallbackPath)) {
    console.warn('Usando favicon-512.png como fuente; guarde brand-icon-source.png como master.');
    return readFileSync(fallbackPath);
  }
  console.error('No se encontró brand-icon-source.png ni favicon-512.png');
  process.exit(1);
}

const BG = '#1e3a5f';

async function renderPng(source, size, outName, padding = 0.18) {
  const inner = Math.round(size * (1 - padding * 2));
  const offset = Math.round((size - inner) / 2);

  const icon = await sharp(source)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  await sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: icon, left: offset, top: offset }])
    .png()
    .toFile(resolve(publicDir, outName));

  console.log(`✓ ${outName} (${size}×${size})`);
}

async function renderOgImage(source) {
  const width = 1200;
  const height = 630;
  const iconSize = 320;
  const left = Math.round((width - iconSize) / 2);
  const top = Math.round((height - iconSize) / 2);

  const icon = await sharp(source)
    .resize(iconSize, iconSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  await sharp({
    create: { width, height, channels: 4, background: BG },
  })
    .composite([{ input: icon, left, top }])
    .png()
    .toFile(resolve(publicDir, 'og-image.png'));

  console.log(`✓ og-image.png (${width}×${height})`);
}

/** Vista previa de enlaces en WhatsApp — JPEG ligero, siempre la misma imagen. */
async function renderWhatsappPreview() {
  const branded = resolve(publicDir, 'og-asiscole.png');
  const fallback = resolve(publicDir, 'og-image.png');
  const input = existsSync(branded) ? branded : fallback;
  if (!existsSync(input)) {
    console.warn('⚠ Sin og-asiscole.png; omitiendo whatsapp-preview.jpg');
    return;
  }

  const out = resolve(publicDir, 'whatsapp-preview.jpg');
  const meta = await sharp(input).metadata();
  const pipeline = sharp(input).resize(1200, 630, { fit: 'cover', position: 'centre' });

  if ((meta.width ?? 0) < 1000) {
    await pipeline.jpeg({ quality: 88, mozjpeg: true }).toFile(out);
  } else {
    await pipeline.jpeg({ quality: 82, mozjpeg: true }).toFile(out);
  }

  const { size } = await import('node:fs/promises').then((fs) => fs.stat(out));
  console.log(`✓ whatsapp-preview.jpg (${Math.round(size / 1024)} KB)`);
}

async function renderReportAssets(source) {
  await sharp(source)
    .resize(420, 420, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(resolve(publicDir, 'guardy-watermark.png'));
  console.log('✓ guardy-watermark.png (420×420, fondo transparente)');

  await sharp(source)
    .resize(280, 280, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(resolve(publicDir, 'guardy-report-logo.png'));
  console.log('✓ guardy-report-logo.png (280×280)');
}

async function renderIco(source) {
  const size = 32;
  const inner = Math.round(size * 0.64);
  const offset = Math.round((size - inner) / 2);
  const icon = await sharp(source)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: icon, left: offset, top: offset }])
    .png()
    .toFile(resolve(publicDir, 'favicon.ico'));
  console.log('✓ favicon.ico');
}

async function main() {
  const source = resolveSourceBuffer();

  if (!existsSync(sourcePath) && existsSync(fallbackPath)) {
    copyFileSync(fallbackPath, sourcePath);
    console.log('✓ Creado brand-icon-source.png desde favicon-512.png\n');
  }

  console.log('Generando assets PNG desde brand-icon-source.png…\n');
  await renderPng(source, 16, 'favicon-16.png');
  await renderPng(source, 32, 'favicon-32.png');
  await renderPng(source, 48, 'favicon-48.png');
  await renderPng(source, 180, 'favicon-180.png');
  await renderPng(source, 192, 'favicon-192.png');
  await renderPng(source, 512, 'favicon-512.png', 0.15);
  await renderReportAssets(source);
  await renderOgImage(source);
  await renderWhatsappPreview();
  await renderIco(source);
  console.log('\nListo. whatsapp-preview.jpg para vista previa en WhatsApp; favicon.svg solo en la UI.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
