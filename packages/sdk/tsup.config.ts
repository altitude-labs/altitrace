import { defineConfig } from 'tsup'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/client/altitrace-client.ts',
    'src/client/simulation-client.ts',
    'src/client/trace-client.ts',
    'src/builders/trace-builder.ts',
    'src/builders/simulation-builder.ts',
    'src/builders/helpers/bundle-helpers.ts',
    'src/builders/helpers/trace-helpers.ts',
    'src/builders/helpers/state-context-helpers.ts',
    'src/builders/helpers/state-override-helpers.ts',
    'src/builders/helpers/block-override-helpers.ts',
    'src/utils/validation.ts',
    'src/utils/viem-integration.ts',
  ],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  minify: false,
  target: 'es2022',
  outDir: 'dist',
  esbuildOptions(options) {
    options.conditions = ['module']
  },
  cjsInterop: true,
  onSuccess: 'echo "✅ Build completed successfully"',
  esbuildPlugins: [],
  external: ['viem'],
})
