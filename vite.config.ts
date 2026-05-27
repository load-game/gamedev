import fs from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite-plus'

const fromRoot = (value: string) => fileURLToPath(new URL(value, import.meta.url))
const packageJson = JSON.parse(fs.readFileSync(fromRoot('./package.json'), 'utf-8')) as {
  dependencies?: Record<string, string>
}
const externalPackages = Object.keys(packageJson.dependencies ?? {}).filter(name => !name.startsWith('@gamedev/'))

const runtimeCopy = [
  { from: 'packages/core/physx-js-webidl.js', to: 'build' },
  { from: 'packages/core/physx-js-webidl.wasm', to: 'build' },
]
const serverRuntimeCopy = [...runtimeCopy, { from: 'packages/core/physx-js-webidl.wasm', to: 'build/server-chunks' }]

export default defineConfig({
  plugins: [
    react({
      include: [/packages\/client\/.*\.js$/],
      jsxImportSource: '@firebolt-dev/jsx',
    }),
  ],
  resolve: {
    alias: {
      '@gamedev/app-server': fromRoot('./packages/app-server'),
      '@gamedev/extra-systems': fromRoot('./packages/extra-systems'),
      '@gamedev/client': fromRoot('./packages/client'),
      '@gamedev/core': fromRoot('./packages/core'),
      '@gamedev/node-client': fromRoot('./packages/node-client'),
      '@gamedev/runtime-adapters': fromRoot('./packages/runtime-adapters'),
      '@gamedev/server': fromRoot('./packages/server'),
      '@gamedev/world-project': fromRoot('./packages/world-project'),
    },
  },
  test: {
    include: ['test/integration/**/*.test.js'],
    testTimeout: 120_000,
    hookTimeout: 120_000,
    pool: 'forks',
  },
  lint: {
    ignorePatterns: [
      'build/**',
      '.codex-status/**',
      'node_modules/**',
      'packages/core/libs/**',
      'packages/core/physx-js-webidl.js',
      'packages/core/physx-js-webidl.wasm',
    ],
    rules: {
      'no-console': 'warn',
      'no-var': 'warn',
      'no-unused-vars': 'warn',
    },
  },
  fmt: {
    ignorePatterns: [
      'build/**',
      '.codex-status/**',
      'node_modules/**',
      'packages/core/libs/**',
      'packages/core/physx-js-webidl.js',
      'packages/core/physx-js-webidl.wasm',
    ],
    semi: false,
    singleQuote: true,
    jsxSingleQuote: true,
    trailingComma: 'es5',
    arrowParens: 'avoid',
    printWidth: 120,
  },
  run: {
    cache: {
      scripts: false,
      tasks: true,
    },
  },
  pack: [
    {
      name: 'server',
      entry: {
        index: 'packages/server/index.js',
      },
      outDir: 'build',
      clean: ['build/index.js', 'build/index.js.map', 'build/server-chunks'],
      format: 'esm',
      platform: 'node',
      target: 'node24',
      sourcemap: true,
      minify: false,
      dts: false,
      report: false,
      hash: false,
      fixedExtension: false,
      failOnWarn: false,
      env: {
        CLIENT: false,
        SERVER: true,
      },
      deps: {
        neverBundle: externalPackages,
      },
      outputOptions: {
        entryFileNames: '[name].js',
        chunkFileNames: 'server-chunks/[name].js',
        assetFileNames: 'server-assets/[name][extname]',
      },
      copy: [
        ...serverRuntimeCopy,
        {
          from: 'packages/server/world/assets',
          to: 'build/world',
        },
      ],
    },
    {
      name: 'node-client',
      entry: {
        'world-node-client': 'packages/node-client/index.js',
      },
      outDir: 'build',
      clean: ['build/world-node-client.js', 'build/world-node-client.js.map', 'build/node-client-chunks'],
      format: 'esm',
      platform: 'node',
      target: 'node24',
      sourcemap: true,
      minify: false,
      dts: false,
      report: false,
      hash: false,
      fixedExtension: false,
      failOnWarn: false,
      deps: {
        neverBundle: externalPackages,
      },
      outputOptions: {
        entryFileNames: '[name].js',
        chunkFileNames: 'node-client-chunks/[name].js',
        assetFileNames: 'node-client-assets/[name][extname]',
      },
      copy: runtimeCopy,
    },
  ],
})
