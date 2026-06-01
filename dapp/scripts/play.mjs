// `pnpm play` — run the publish bridge and the Vite dev server together (zero extra deps).
// Streams both outputs (prefixed) and tears both down on exit / Ctrl-C.

import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const FRONTEND = join(HERE, '..', 'frontend');

function run(name, cmd, args, cwd) {
  const child = spawn(cmd, args, { cwd, env: process.env });
  const tag = `[${name}] `;
  const pipe = (stream, out) => {
    let buf = '';
    stream.on('data', (d) => {
      buf += d.toString();
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const l of lines) out.write(tag + l + '\n');
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  child.on('exit', (code) => {
    process.stdout.write(`${tag}exited (${code})\n`);
    shutdown();
  });
  return child;
}

const bridge = run('bridge', 'node', [join(HERE, 'bridge.mjs')], HERE);
const vite = run('vite', 'npx', ['vite'], FRONTEND);

let down = false;
function shutdown() {
  if (down) return;
  down = true;
  for (const c of [bridge, vite]) { try { c.kill('SIGTERM'); } catch { /* ignore */ } }
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
