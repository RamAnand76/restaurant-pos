'use strict';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function main() {
  const inputPath =
    'C:/Users/LENOVO/.gemini/antigravity-ide/brain/f448d66a-6005-494b-9a97-815bad31b08b/.user_uploaded/media_1792590417548.png';
  const publicDir = path.join(__dirname, '..', 'frontend', 'public');

  console.log('Reading input image from:', inputPath);

  // Trim transparent padding to get the exact tight bounding box of the logo
  const trimmedBuffer = await sharp(inputPath).trim().toBuffer();
  const trimmedMeta = await sharp(trimmedBuffer).metadata();
  console.log('Trimmed dimensions:', trimmedMeta.width, 'x', trimmedMeta.height);

  // Create a square icon with generous balanced padding (e.g. 512x512)
  const size = 512;
  const paddingRatio = 0.85; // 85% of container
  const targetDimension = Math.round(size * paddingRatio);

  const resizedLogo = await sharp(trimmedBuffer)
    .resize(targetDimension, targetDimension, {
      fit: 'inside',
      kernel: sharp.kernel.lanczos3,
    })
    .toBuffer();

  const square512 = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: resizedLogo, gravity: 'center' }])
    .png()
    .toBuffer();

  // Write high-res logo
  fs.writeFileSync(path.join(publicDir, 'tavroq-logo.png'), square512);
  fs.writeFileSync(path.join(publicDir, 'logo.png'), square512);

  // Write icons for PWA & favicon
  await sharp(square512).resize(512, 512).png().toFile(path.join(publicDir, 'icon-512.png'));
  await sharp(square512).resize(192, 192).png().toFile(path.join(publicDir, 'icon-192.png'));
  await sharp(square512)
    .resize(180, 180)
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  await sharp(square512).resize(32, 32).png().toFile(path.join(publicDir, 'favicon-32x32.png'));
  await sharp(square512).resize(16, 16).png().toFile(path.join(publicDir, 'favicon-16x16.png'));

  console.log('Successfully generated Tavroq logo assets in frontend/public!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
