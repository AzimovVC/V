// Сборка: esbuild бандлит src/main.ts → dist/game.js, статику копирует в dist/.
// node scripts/build.mjs --serve   — dev-сервер с пересборкой (http://localhost:5173)
// node scripts/build.mjs --prod    — минифицированная сборка в dist/
import * as esbuild from 'esbuild';
import { cpSync, mkdirSync, rmSync } from 'node:fs';

const prod = process.argv.includes('--prod');
const serve = process.argv.includes('--serve');

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });
cpSync('index.html', 'dist/index.html');
cpSync('style.css', 'dist/style.css');

const options = {
  entryPoints: ['src/main.ts'],
  bundle: true,
  outfile: 'dist/game.js',
  target: 'es2020',
  sourcemap: !prod,
  minify: prod,
  logLevel: 'info',
};

if (serve) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  const { port } = await ctx.serve({ servedir: 'dist', port: Number(process.env.PORT) || 5173, host: '0.0.0.0' });
  console.log(`dev: http://localhost:${port}  (index.html/style.css копируются при старте)`);
} else {
  await esbuild.build(options);
}
