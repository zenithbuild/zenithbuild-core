import type { LayoutMetadata } from '../discovery/layouts'

/**
 * Process a page by inlining a layout
 */
export function processLayout(
    source: string,
    layout: LayoutMetadata,
    props: Record<string, any> = {}
): string {
    // 1. Extract scripts and styles from the page source
    const pageScripts: string[] = []
    const pageStyles: string[] = []
    let isTypeScript = false

    // Extract script blocks
    const scriptRegex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi
    let scriptMatch
    while ((scriptMatch = scriptRegex.exec(source)) !== null) {
        const attrString = scriptMatch[1] || ''
        const content = scriptMatch[2] || ''
        if (attrString.includes('lang="ts"') || attrString.includes('setup="ts"')) {
            isTypeScript = true
        }
        if (content) pageScripts.push(content.trim())
    }

    // Extract style blocks
    const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi
    let styleMatch
    while ((styleMatch = styleRegex.exec(source)) !== null) {
        if (styleMatch[1]) pageStyles.push(styleMatch[1].trim())
    }

    // 2. Extract content from page source and parse props
    const layoutTag = layout.name
    // Support both <DefaultLayout ...> and <DefaultLayout>...</DefaultLayout>
    const layoutRegex = new RegExp(`<${layoutTag}\\b([^>]*)>(?:([\\s\\S]*?)</${layoutTag}>)?`, 'i')
    const match = source.match(layoutRegex)

    let pageHtml = ''
    let layoutPropsStr = ''

    if (match) {
        layoutPropsStr = match[1] || ''
        pageHtml = match[2] || ''

        // If it's a self-closing tag or empty, it might not have captured content correctly if regex failed
        if (!pageHtml && !source.includes(`</${layoutTag}>`)) {
            // Self-closing check? No, Zenith usually expects explicit tags or the layout to wrap everything.
        }
    } else {
        // If layout tag not found as root, assume everything minus script/style is content
        pageHtml = source.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        pageHtml = pageHtml.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').trim()
    }

    // 3. Parse props from the tag
    const mergedProps = { ...props }
    if (layoutPropsStr) {
        // Support legacy props={{...}}
        const legacyMatch = layoutPropsStr.match(/props=\{\{([^}]+)\}\}/)
        if (legacyMatch && legacyMatch[1]) {
            const propsBody = legacyMatch[1]
            const pairs = propsBody.split(/,(?![^[]*\])(?![^{]*\})/)
            for (const pair of pairs) {
                const [key, ...valParts] = pair.split(':')
                if (key && valParts.length > 0) {
                    mergedProps[key.trim()] = valParts.join(':').trim()
                }
            }
        }

        // Support natural props: title={"Home"} or title="Home" or title={title}
        const attrRegex = /([a-zA-Z0-9-]+)=(?:\{([^}]+)\}|"([^"]*)"|'([^']*)')/g
        let attrMatch
        while ((attrMatch = attrRegex.exec(layoutPropsStr)) !== null) {
            const name = attrMatch[1]
            const value = attrMatch[2] || attrMatch[3] || attrMatch[4]
            if (name && name !== 'props') {
                mergedProps[name] = value
            }
        }
    }

    // 4. Merge Scripts with Prop Injection
    // Layout scripts come first, then page scripts. Props are injected at the very top.
    const propDeclarations = Object.entries(mergedProps)
        .map(([key, value]) => {
            // If value looks like a string literal, keep it as is, otherwise wrap if needed
            // Actually, if it came from {expression}, we should treat it as code.
            // If it came from "string", we treat it as a string.
            const isExpression = layoutPropsStr.includes(`${key}={${value}}`)
            if (isExpression) {
                return `const ${key} = ${value};`
            }
            return `const ${key} = ${typeof value === 'string' && !value.startsWith("'") && !value.startsWith('"') ? `'${value}'` : value};`
        })
        .join('\n')

    const mergedScripts = [
        propDeclarations,
        ...layout.scripts,
        ...pageScripts
    ].filter(Boolean).join('\n\n')

    // 5. Merge Styles
    const mergedStyles = [
        ...layout.styles,
        ...pageStyles
    ].filter(Boolean).join('\n\n')

    // 6. Inline HTML into layout slot
    let finalizedHtml = layout.html.replace(/<Slot\s*\/>/gi, pageHtml)
    finalizedHtml = finalizedHtml.replace(/<slot\s*>[\s\S]*?<\/slot>/gi, pageHtml)

    // 7. Reconstruct the full .zen source
    const propNames = Object.keys(mergedProps).join(',')
    const scriptTag = `<script setup${isTypeScript ? '="ts"' : ''}${propNames ? ` props="${propNames}"` : ''}>`

    return `
${scriptTag}
${mergedScripts}
</script>

${finalizedHtml}

<style>
${mergedStyles}
</style>
`.trim()
}
