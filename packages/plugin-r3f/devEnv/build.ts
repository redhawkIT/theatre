import path from 'path'
import {build} from 'esbuild'
import type {Plugin} from 'esbuild'
import {writeFileSync} from 'fs'

const externalPlugin = (patterns: RegExp[]): Plugin => {
  return {
    name: `external`,

    setup(build) {
      build.onResolve({filter: /.*/}, (args) => {
        const external = patterns.some((p) => {
          return p.test(args.path)
        })

        if (external) {
          return {path: args.path, external}
        }
      })
    },
  }
}

const definedGlobals = {
  global: 'window',
}

function createBundles(watch: boolean) {
  const pathToPackage = path.join(__dirname, '../')
  const esbuildConfig: Parameters<typeof build>[0] = {
    entryPoints: [path.join(pathToPackage, 'src/index.tsx')],
    bundle: true,
    sourcemap: true,
    define: definedGlobals,
    watch,
    platform: 'neutral',
    mainFields: ['browser', 'module', 'main'],
    target: ['firefox57', 'chrome58'],
    conditions: ['browser', 'node'],
    // every dependency is considered external
    plugins: [externalPlugin([/^[\@a-zA-Z]+/])],
  }

  build({
    ...esbuildConfig,
    define: {...definedGlobals, 'process.env.NODE_ENV': '"production"'},
    outfile: path.join(pathToPackage, 'dist/index.production.js'),
    format: 'cjs',
    treeShaking: true,
  })

  build({
    ...esbuildConfig,
    define: {...definedGlobals, 'process.env.NODE_ENV': '"development"'},
    outfile: path.join(pathToPackage, 'dist/index.development.js'),
    format: 'cjs',
  })

  writeFileSync(
    path.join(pathToPackage, 'dist/index.js'),
    `module.exports =
  process.env.NODE_ENV === "production"
    ? require("./index.production.js")
    : require("./index.development.js")`,
    {encoding: 'utf-8'},
  )

  build({
    ...esbuildConfig,
    outfile: path.join(pathToPackage, 'dist/index.mjs'),
    format: 'esm',
  })
}

createBundles(false)
