// Affiche l'URL de l'app et son QR code dans le terminal.
// Usage : npm run qr [-- https://autre-url/]

import qrcode from 'qrcode-terminal';

const DEFAULT_URL = 'https://osint-tt.github.io/prise-de-masse/';
const url = process.argv[2] || process.env.PDM_URL || DEFAULT_URL;

console.log('');
console.log('  Protal');
console.log(`  ${url}`);
console.log('');
qrcode.generate(url, { small: true }, (qr) => {
  console.log(
    qr
      .split('\n')
      .map((line) => `  ${line}`)
      .join('\n')
  );
  console.log('  Scanne ce code avec l’appareil photo du téléphone.');
  console.log('');
});
