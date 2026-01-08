#!/usr/bin/env bun
/**
 * Zenith Internal Build Script
 * 
 * Compiles all pages in app/pages to app/dist using the SSG builder.
 * This script is called via `bun run build` in user projects.
 * 
 * SSG-first approach:
 * - Static pages: HTML + CSS only
 * - Hydrated pages: HTML + bundle.js + page-specific JS
 * - Shared runtime in assets/bundle.js
 */

import path from 'path'
import fs from 'fs'
import { buildSSG } from '../compiler/ssg-build'

const projectRoot = process.cwd()

// Support both app/ and src/ directory structures
let appDir = path.join(projectRoot, 'app')
if (!fs.existsSync(appDir)) {
    appDir = path.join(projectRoot, 'src')
}

if (!fs.existsSync(appDir)) {
    console.error('❌ No app/ or src/ directory found')
    process.exit(1)
}

try {
    buildSSG({
        pagesDir: path.join(appDir, 'pages'),
        outDir: path.join(appDir, 'dist'),
        baseDir: appDir
    })
} catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('❌ Build failed:', message)
    process.exit(1)
}
