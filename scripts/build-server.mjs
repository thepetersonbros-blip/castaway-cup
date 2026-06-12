import { build } from 'esbuild';

await build({
  entryPoints: ['src/server/index.ts'],
  outfile: 'dist/server/index.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  sourcemap: true,
  external: ['bufferutil', 'utf-8-validate'],
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'info'
});
