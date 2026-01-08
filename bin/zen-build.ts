#!/usr/bin/env bun
/**
 * Zenith Internal Build Script
 * 
 * Compiles all pages in app/pages to app/dist using the SPA builder.
 * This script is called via `bun run build` in user projects.
 */

import path from 'path'
import { buildSPA } from '../compiler/spa-build'

const projectRoot = process.cwd()
const appDir = path.join(projectRoot, 'app')

console.log('🔨 Building Zenith app...')
console.log(`   Project: ${projectRoot}`)

try {
    buildSPA({
        pagesDir: path.join(appDir, 'pages'),
        outDir: path.join(appDir, 'dist'),
        baseDir: appDir
    })
    console.log('✅ Build complete → app/dist/')
} catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('❌ Build failed:', message)
    process.exit(1)
}
