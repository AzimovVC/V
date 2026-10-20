// Собирает один автономный файл dist/dom-vnutri.html (CSS и JS внутри).
// Открывается двойным кликом, сервер и интернет не нужны.
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

execSync('node scripts/build.mjs --prod', { stdio: 'inherit' });
const html = readFileSync('index.html', 'utf8');
const css = readFileSync('style.css', 'utf8');
const js = readFileSync('dist/game.js', 'utf8');
if (/<\/script/i.test(js)) throw new Error('в бандле встретился </script>');
const out = html
  .replace('<link rel="stylesheet" href="style.css">', () => `<style>\n${css}\n</style>`)
  .replace('<script src="game.js"></script>', () => `<script>\n${js}\n</script>`);
writeFileSync('dist/dom-vnutri.html', out);
console.log(`dist/dom-vnutri.html  ${Math.round(out.length / 1024)} KB`);
