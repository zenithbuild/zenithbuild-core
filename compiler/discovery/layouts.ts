import fs from 'fs'
import path from 'path'
import { parseTemplate } from '../parse/parseTemplate'
import { parseScript } from '../parse/parseScript'
import { extractProps, extractStateDeclarations } from '../parse/scriptAnalysis'

export interface LayoutMetadata {
    name: string
    filePath: string
    props: string[]
    states: Map<string, string>
    html: string
    scripts: string[]
    styles: string[]
}

/**
 * Discover layouts in a directory
 */
export function discoverLayouts(layoutsDir: string): Map<string, LayoutMetadata> {
    const layouts = new Map<string, LayoutMetadata>()

    if (!fs.existsSync(layoutsDir)) return layouts

    const files = fs.readdirSync(layoutsDir)
    for (const file of files) {
        if (file.endsWith('.zen')) {
            const filePath = path.join(layoutsDir, file)
            const name = path.basename(file, '.zen')
            const source = fs.readFileSync(filePath, 'utf-8')

            const script = parseScript(source)
            const props = script ? extractProps(script.raw) : []
            const states = script ? extractStateDeclarations(script.raw) : new Map()

            // Extract styles
            const styles: string[] = []
            const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi
            let match
            while ((match = styleRegex.exec(source)) !== null) {
                if (match[1]) styles.push(match[1].trim())
            }

            // Extract HTML (everything except script/style)
            let html = source.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            html = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').trim()

            layouts.set(name, {
                name,
                filePath,
                props,
                states,
                html,
                scripts: script ? [script.raw] : [],
                styles
            })
        }
    }

    return layouts
}
