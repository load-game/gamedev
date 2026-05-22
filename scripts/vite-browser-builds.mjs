import fs from 'fs-extra'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { build, transformWithOxc } from 'vite-plus'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export const rootDir = path.join(dirname, '../')
export const buildDir = path.join(rootDir, 'build')

const clientPublicDir = path.join(rootDir, 'packages/client/public')
const clientIndexHtmlSrc = path.join(clientPublicDir, 'index.html')
const clientAdminHtmlSrc = path.join(clientPublicDir, 'admin.html')
const worldAssetsDir = path.join(rootDir, 'packages/server/plugins/builtins/assets')
const physxWasmSrc = path.join(rootDir, 'packages/plugins/spatial/physx/physx-js-webidl.wasm')

const packageAliases = {
  '@gamedev/app-server': path.join(rootDir, 'packages/app-server'),
  '@gamedev/client': path.join(rootDir, 'packages/client'),
  '@gamedev/core': path.join(rootDir, 'packages/core'),
  '@gamedev/node-client': path.join(rootDir, 'packages/node-client'),
  '@gamedev/server': path.join(rootDir, 'packages/server'),
  react: 'react',
}

const cleanId = id => id.split('?')[0]
const trimLeadingSlash = value => String(value || '').replace(/^\/+/, '')
const asRelativeImport = value => `./${trimLeadingSlash(value)}`
const asAbsolutePath = value => `/${trimLeadingSlash(value)}`
const writeLine = value => {
  process.stdout.write(`${value}\n`)
}

function clientJsxInJsPlugin() {
  return {
    name: 'gamedev:jsx-in-js',
    enforce: 'pre',
    async transform(code, id) {
      const clean = cleanId(id)
      if (!clean.endsWith('.js')) return null
      if (!clean.includes('/packages/client/')) return null
      const result = await transformWithOxc(code, clean, {
        lang: 'jsx',
        jsx: {
          runtime: 'automatic',
          importSource: '@firebolt-dev/jsx',
        },
        sourcemap: true,
      })
      return { code: result.code, map: result.map }
    },
  }
}

function browserPlugins(extraPlugins = []) {
  return [
    clientJsxInJsPlugin(),
    react({
      include: [/packages\/client\/.*\.js$/],
      jsxImportSource: '@firebolt-dev/jsx',
    }),
    ...extraPlugins,
  ]
}

function captureEntriesPlugin({ onBundle }) {
  let entries = {}
  return {
    name: 'gamedev:capture-entries',
    generateBundle(_options, bundle) {
      entries = {}
      for (const item of Object.values(bundle)) {
        if (item.type === 'chunk' && item.isEntry) {
          entries[item.name] = item.fileName
        }
      }
    },
    async closeBundle() {
      await onBundle(entries)
    },
  }
}

async function runBrowserBuild({
  input,
  outDir,
  dev = false,
  minify = !dev,
  sourcemap = true,
  emptyOutDir = true,
  external = [],
  output,
  plugins = [],
  define = {},
}) {
  return build({
    root: rootDir,
    base: './',
    configFile: false,
    publicDir: false,
    plugins: browserPlugins(plugins),
    resolve: {
      alias: packageAliases,
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify(dev ? 'development' : 'production'),
      ...define,
    },
    build: {
      outDir,
      emptyOutDir,
      sourcemap,
      minify,
      watch: dev ? {} : null,
      rolldownOptions: {
        input,
        external,
        output,
      },
    },
  })
}

function fillClientHtml(html, { assetPrefix, jsPath, particlesPath, buildId, meta = null }) {
  let result = html
  result = result.replaceAll('{assetPrefix}', assetPrefix)
  result = result.replace('{jsPath}', jsPath)
  result = result.replace('{particlesPath}', particlesPath)
  result = result.replaceAll('{buildId}', buildId)
  if (meta) {
    result = result.replaceAll('{title}', meta.title)
    result = result.replaceAll('{desc}', meta.desc)
    result = result.replaceAll('{url}', meta.url)
    result = result.replaceAll('{image}', meta.image)
  }
  return result
}

async function copyClientPublicAssets(outDir) {
  await fs.copy(clientPublicDir, outDir)
  await fs.copy(physxWasmSrc, path.join(outDir, 'physx-js-webidl.wasm'))
}

function requireEntry(entries, name) {
  const fileName = entries[name]
  if (!fileName) {
    const available = Object.keys(entries).sort().join(', ') || 'none'
    throw new Error(`Vite Plus build did not emit expected entry "${name}". Available entries: ${available}`)
  }
  return fileName
}

export async function buildPlatformClient({ dev = false } = {}) {
  const outDir = path.join(buildDir, 'public')
  return runBrowserBuild({
    dev,
    outDir,
    input: {
      index: path.join(rootDir, 'packages/client/index.js'),
      particles: path.join(rootDir, 'packages/client/particles.js'),
      admin: path.join(rootDir, 'packages/client/admin.js'),
    },
    output: {
      entryFileNames: '[name]-[hash].js',
      chunkFileNames: 'chunks/[name]-[hash].js',
      assetFileNames: 'client-assets/[name]-[hash][extname]',
    },
    plugins: [
      captureEntriesPlugin({
        onBundle: async entries => {
          const buildId = Date.now()
          await copyClientPublicAssets(outDir)

          const indexFile = requireEntry(entries, 'index')
          const particlesFile = requireEntry(entries, 'particles')
          const adminFile = requireEntry(entries, 'admin')

          await fs.writeFile(path.join(outDir, 'index.js'), `import '${asRelativeImport(indexFile)}';\n`)
          await fs.writeFile(path.join(outDir, 'particles.js'), `import '${asRelativeImport(particlesFile)}';\n`)
          await fs.writeFile(path.join(outDir, 'admin.js'), `import '${asRelativeImport(adminFile)}';\n`)

          const html = fillClientHtml(await fs.readFile(clientIndexHtmlSrc, 'utf-8'), {
            assetPrefix: '/',
            jsPath: asAbsolutePath(indexFile),
            particlesPath: asAbsolutePath(particlesFile),
            buildId,
          })
          await fs.writeFile(path.join(outDir, 'index.html'), html)

          if (await fs.pathExists(clientAdminHtmlSrc)) {
            const adminHtml = fillClientHtml(await fs.readFile(clientAdminHtmlSrc, 'utf-8'), {
              assetPrefix: '/',
              jsPath: asAbsolutePath(adminFile),
              particlesPath: asAbsolutePath(particlesFile),
              buildId,
            })
            await fs.writeFile(path.join(outDir, 'admin.html'), adminHtml)
          }

          await fs.writeJson(
            path.join(buildDir, 'meta.json'),
            {
              tool: 'vite-plus',
              entries: entries,
            },
            { spaces: 2 }
          )
        },
      }),
    ],
  })
}

export async function buildStaticClient() {
  const outDir = path.join(buildDir, 'static')
  const publicEnvs = {
    PUBLIC_ALLOW_WS_OVERRIDE: 'true',
    PUBLIC_MAX_UPLOAD_SIZE: '0',
    ...(process.env.PUBLIC_WS_URL && { PUBLIC_WS_URL: process.env.PUBLIC_WS_URL }),
  }

  await runBrowserBuild({
    outDir,
    minify: true,
    input: {
      index: path.join(rootDir, 'packages/client/index.js'),
      particles: path.join(rootDir, 'packages/client/particles.js'),
    },
    output: {
      entryFileNames: '[name]-[hash].js',
      chunkFileNames: 'chunks/[name]-[hash].js',
      assetFileNames: 'client-assets/[name]-[hash][extname]',
    },
    plugins: [
      captureEntriesPlugin({
        onBundle: async entries => {
          const buildId = Date.now()
          await copyClientPublicAssets(outDir)

          if (await fs.pathExists(worldAssetsDir)) {
            await fs.copy(worldAssetsDir, path.join(outDir, 'assets'))
          }

          await fs.writeFile(path.join(outDir, 'env.js'), `globalThis.env = ${JSON.stringify(publicEnvs)}`)

          const html = fillClientHtml(await fs.readFile(clientIndexHtmlSrc, 'utf-8'), {
            assetPrefix: '',
            jsPath: trimLeadingSlash(requireEntry(entries, 'index')),
            particlesPath: trimLeadingSlash(requireEntry(entries, 'particles')),
            buildId,
            meta: {
              title: 'Hyperfy',
              desc: 'Interactive 3D world',
              url: '',
              image: '',
            },
          })
          await fs.writeFile(path.join(outDir, 'index.html'), html)
          await fs.copy(path.join(outDir, 'index.html'), path.join(outDir, '404.html'))
          await fs.writeFile(path.join(outDir, '.nojekyll'), '')

          writeLine('\nStatic build ready -> build/static/')
          writeLine('\nTest locally:')
          writeLine('  npx serve build/static')
          if (publicEnvs.PUBLIC_WS_URL) {
            writeLine(`\nDefault server: ${publicEnvs.PUBLIC_WS_URL}`)
          } else {
            writeLine('\nNo default server - boots offline. Share ?connect=wss://... links to connect.')
          }
        },
      }),
    ],
  })
}

export async function buildWorldClient({ dev = false } = {}) {
  await fs.remove(path.join(buildDir, 'world-client.js'))
  await fs.remove(path.join(buildDir, 'assets'))
  await fs.remove(path.join(buildDir, 'world-client-assets'))
  return runBrowserBuild({
    dev,
    outDir: buildDir,
    emptyOutDir: false,
    minify: false,
    sourcemap: 'inline',
    input: path.join(rootDir, 'packages/client/world-client.js'),
    external: ['three', 'react', 'react-dom', 'ses'],
    output: {
      entryFileNames: 'world-client.js',
      chunkFileNames: 'world-client-assets/[name]-[hash].js',
      assetFileNames: 'world-client-assets/[name]-[hash][extname]',
      codeSplitting: false,
    },
  })
}

export async function buildViewer({ dev = false } = {}) {
  return runBrowserBuild({
    dev,
    outDir: path.join(buildDir, 'viewer'),
    minify: false,
    sourcemap: 'inline',
    input: {
      createViewerWorld: path.join(rootDir, 'packages/core/createViewerWorld.js'),
    },
    external: ['three'],
    output: {
      entryFileNames: '[name]-[hash].js',
      chunkFileNames: 'chunks/[name]-[hash].js',
      assetFileNames: 'assets/[name]-[hash][extname]',
      codeSplitting: false,
    },
  })
}

export async function waitForWatch() {
  await new Promise(() => {})
}
