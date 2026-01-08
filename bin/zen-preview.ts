#!/usr/bin/env bun
/**
 * Zenith Internal Preview Server
 * 
 * Serves the production build from app/dist without rebuilding.
 * This script is called via `bun run preview` in user projects.
 */

import path from 'path'
import { serve } from 'bun'

const projectRoot = process.cwd()
const distDir = path.join(projectRoot, 'app', 'dist')
const port = parseInt(process.env.PORT || '4173', 10)

// File extensions that should be served as static assets
const STATIC_EXTENSIONS = new Set([
    '.js', '.css', '.ico', '.png', '.jpg', '.jpeg', '.gif', '.svg',
    '.webp', '.woff', '.woff2', '.ttf', '.eot', '.json', '.map'
])

console.log('🔎 Previewing production build...')
console.log(`   Serving: ${distDir}`)

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

        return new Response('No production build found. Run `bun run build` first.', { status: 500 })
    }
})

console.log(`🚀 Preview server running at http://localhost:${port}`)
console.log('   Press Ctrl+C to stop')
