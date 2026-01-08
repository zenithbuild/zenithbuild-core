#!/usr/bin/env bun
/**
 * Zenith Internal Dev Server
 * 
 * Builds the app then starts a development server with SPA fallback.
 * This script is called via `bun run dev` in user projects.
 */

import path from 'path'
import { serve } from 'bun'
import { buildSPA } from '../compiler/spa-build'

const projectRoot = process.cwd()
const appDir = path.join(projectRoot, 'app')
const distDir = path.join(appDir, 'dist')
const port = parseInt(process.env.PORT || '3000', 10)

// File extensions that should be served as static assets
const STATIC_EXTENSIONS = new Set([
    '.js', '.css', '.ico', '.png', '.jpg', '.jpeg', '.gif', '.svg',
    '.webp', '.woff', '.woff2', '.ttf', '.eot', '.json', '.map'
])

async function main() {
    console.log('🔨 Building Zenith app...')
    console.log(`   Project: ${projectRoot}`)

    try {
        // Initial build
        buildSPA({
            pagesDir: path.join(appDir, 'pages'),
            outDir: distDir,
            baseDir: appDir
        })
        console.log('✅ Build complete')
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        console.error('❌ Build failed:', message)
        process.exit(1)
    }

    // Start dev server
    serve({
        port,
        async fetch(req) {
            const url = new URL(req.url)
            const pathname = url.pathname
            const ext = path.extname(pathname).toLowerCase()

            // Serve static assets directly
            if (STATIC_EXTENSIONS.has(ext)) {
                const filePath = path.join(distDir, pathname)
                const file = Bun.file(filePath)
                if (await file.exists()) {
                    return new Response(file)
                }
                return new Response('Not found', { status: 404 })
            }

            // SPA fallback: serve index.html for all other routes
            const indexPath = path.join(distDir, 'index.html')
            const indexFile = Bun.file(indexPath)
            if (await indexFile.exists()) {
                return new Response(indexFile, {
                    headers: { 'Content-Type': 'text/html; charset=utf-8' }
                })
            }

            return new Response('Build required. Run `bun run build` first.', { status: 500 })
        }
    })

    console.log(`🚀 Zenith dev server running at http://localhost:${port}`)
    console.log('   Press Ctrl+C to stop')
}

main()
