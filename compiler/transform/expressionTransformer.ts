/**
 * Expression JSX Transformer
 * 
 * Transforms JSX-like tags inside Zenith expressions into __zenith.h() calls.
 * This allows Zenith to support JSX semantics without a full JSX compiler like Babel.
 * 
 * Handles:
 * - Multi-line JSX expressions
 * - Nested elements
 * - Complex event handlers like onclick={() => fn(item)}
 * - Expression attributes {expr}
 * - Text interpolation {item.title}
 */

/**
 * Find the end of a balanced brace expression
 */
function findBalancedBraceEnd(code: string, startIndex: number): number {
    let braceCount = 1
    let i = startIndex + 1
    let inString = false
    let stringChar = ''
    let inTemplate = false

    while (i < code.length && braceCount > 0) {
        const char = code[i]
        const prevChar = i > 0 ? code[i - 1] : ''

        // Handle escape sequences
        if (prevChar === '\\') {
            i++
            continue
        }

        // Handle string literals
        if (!inString && !inTemplate && (char === '"' || char === "'")) {
            inString = true
            stringChar = char
            i++
            continue
        }

        if (inString && char === stringChar) {
            inString = false
            stringChar = ''
            i++
            continue
        }

        // Handle template literals
        if (!inString && !inTemplate && char === '`') {
            inTemplate = true
            i++
            continue
        }

        if (inTemplate && char === '`') {
            inTemplate = false
            i++
            continue
        }

        // Count braces only when not in strings
        if (!inString && !inTemplate) {
            if (char === '{') braceCount++
            else if (char === '}') braceCount--
        }

        i++
    }

    return braceCount === 0 ? i : -1
}

/**
 * Parse JSX attributes using balanced parsing for expression values
 */
function parseJSXAttributes(code: string, startIndex: number): {
    attrs: string;
    endIndex: number;
    isSelfClosing: boolean
} {
    const attrPairs: string[] = []
    let i = startIndex

    // Skip whitespace
    while (i < code.length && /\s/.test(code[i]!)) i++

    while (i < code.length) {
        const char = code[i]

        // Check for end of opening tag
        if (char === '>') {
            return { attrs: formatAttrs(attrPairs), endIndex: i + 1, isSelfClosing: false }
        }
        if (char === '/' && code[i + 1] === '>') {
            return { attrs: formatAttrs(attrPairs), endIndex: i + 2, isSelfClosing: true }
        }

        // Parse attribute name
        const nameMatch = code.slice(i).match(/^([a-zA-Z_][a-zA-Z0-9_-]*)/)
        if (!nameMatch) {
            i++
            continue
        }

        const attrName = nameMatch[1]!
        i += attrName.length

        // Skip whitespace
        while (i < code.length && /\s/.test(code[i]!)) i++

        // Check for value
        if (code[i] !== '=') {
            attrPairs.push(`"${attrName}": true`)
            continue
        }

        i++ // Skip '='

        // Skip whitespace
        while (i < code.length && /\s/.test(code[i]!)) i++

        // Parse value
        if (code[i] === '"' || code[i] === "'") {
            const quote = code[i]
            let endQuote = i + 1
            while (endQuote < code.length && code[endQuote] !== quote) {
                if (code[endQuote] === '\\') endQuote++ // Skip escaped chars
                endQuote++
            }
            const value = code.slice(i + 1, endQuote)
            attrPairs.push(`"${attrName}": "${value}"`)
            i = endQuote + 1
        } else if (code[i] === '{') {
            // Expression value - find balanced end
            const endBrace = findBalancedBraceEnd(code, i)
            if (endBrace === -1) {
                i++
                continue
            }
            const expr = code.slice(i + 1, endBrace - 1).trim()
            attrPairs.push(`"${attrName}": ${expr}`)
            i = endBrace
        } else {
            // Unquoted value (rare in JSX, but support it)
            const unquotedMatch = code.slice(i).match(/^([^\s/>]+)/)
            if (unquotedMatch) {
                attrPairs.push(`"${attrName}": "${unquotedMatch[1]}"`)
                i += unquotedMatch[1]!.length
            }
        }

        // Skip whitespace
        while (i < code.length && /\s/.test(code[i]!)) i++
    }

    return { attrs: formatAttrs(attrPairs), endIndex: i, isSelfClosing: false }
}

function formatAttrs(pairs: string[]): string {
    return pairs.length > 0 ? `{ ${pairs.join(', ')} }` : 'null'
}

/**
 * Find the matching closing tag for an element
 */
function findClosingTag(code: string, startIndex: number, tagName: string): number {
    let depth = 1
    let i = startIndex
    const openPattern = new RegExp(`<${tagName}(?:\\s|>|/>)`, 'i')
    const closeTag = `</${tagName}>`

    while (i < code.length && depth > 0) {
        // Check for closing tag
        if (code.slice(i, i + closeTag.length).toLowerCase() === closeTag.toLowerCase()) {
            depth--
            if (depth === 0) return i
            i += closeTag.length
            continue
        }

        // Check for opening tag (same name, nested)
        const openMatch = code.slice(i).match(openPattern)
        if (openMatch && openMatch.index === 0) {
            // Check if it's self-closing
            const selfClosing = code.slice(i).match(new RegExp(`<${tagName}[^>]*/>`, 'i'))
            if (!selfClosing || selfClosing.index !== 0) {
                depth++
            }
            i += openMatch[0].length
            continue
        }

        i++
    }

    return -1
}

/**
 * Parse JSX children content
 */
function parseJSXChildren(code: string, startIndex: number, tagName: string): {
    children: string;
    endIndex: number
} {
    const closingIndex = findClosingTag(code, startIndex, tagName)
    if (closingIndex === -1) {
        return { children: 'null', endIndex: code.length }
    }

    const content = code.slice(startIndex, closingIndex)

    if (!content.trim()) {
        return { children: 'null', endIndex: closingIndex }
    }

    // Transform the children content
    const transformedContent = transformChildContent(content)

    return { children: transformedContent, endIndex: closingIndex }
}

/**
 * Transform content that may contain text, expressions, and nested JSX
 */
function transformChildContent(content: string): string {
    const parts: string[] = []
    let i = 0
    let currentText = ''

    while (i < content.length) {
        const char = content[i]

        // Check for JSX element
        if (char === '<' && /[a-zA-Z]/.test(content[i + 1] || '')) {
            // Save any accumulated text
            if (currentText.trim()) {
                parts.push(`"${escapeString(currentText.trim())}"`)
                currentText = ''
            }

            // Try to parse as JSX element
            const parsed = parseJSXElement(content, i)
            if (parsed) {
                parts.push(parsed.hCall)
                i = parsed.endIndex
                continue
            }
        }

        // Check for expression {expr}
        if (char === '{') {
            const endBrace = findBalancedBraceEnd(content, i)
            if (endBrace !== -1) {
                // Save any accumulated text
                if (currentText.trim()) {
                    parts.push(`"${escapeString(currentText.trim())}"`)
                    currentText = ''
                }

                // Extract and add expression
                const expr = content.slice(i + 1, endBrace - 1).trim()
                if (expr) {
                    // Transform any JSX inside the expression
                    const transformedExpr = transformExpressionJSX(expr)
                    parts.push(transformedExpr)
                }
                i = endBrace
                continue
            }
        }

        // Accumulate text
        currentText += char
        i++
    }

    // Add remaining text
    if (currentText.trim()) {
        parts.push(`"${escapeString(currentText.trim())}"`)
    }

    if (parts.length === 0) return 'null'
    if (parts.length === 1) return parts[0]!
    return `[${parts.join(', ')}]`
}

/**
 * Escape a string for use in JavaScript
 */
function escapeString(str: string): string {
    return str
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t')
}

/**
 * Parse a single JSX element starting at the given index
 */
function parseJSXElement(code: string, startIndex: number): { hCall: string; endIndex: number } | null {
    // Extract tag name
    const tagMatch = code.slice(startIndex).match(/^<([a-zA-Z][a-zA-Z0-9]*)/)
    if (!tagMatch) return null

    const tagName = tagMatch[1]!
    let i = startIndex + tagMatch[0].length

    // Parse attributes
    const { attrs, endIndex: attrEnd, isSelfClosing } = parseJSXAttributes(code, i)
    i = attrEnd

    if (isSelfClosing) {
        return {
            hCall: `__zenith.h("${tagName}", ${attrs}, null)`,
            endIndex: i
        }
    }

    // Parse children until closing tag
    const { children, endIndex: childEnd } = parseJSXChildren(code, i, tagName)
    i = childEnd

    // Skip closing tag
    const closeTag = `</${tagName}>`
    if (code.slice(i, i + closeTag.length).toLowerCase() === closeTag.toLowerCase()) {
        i += closeTag.length
    }

    return {
        hCall: `__zenith.h("${tagName}", ${attrs}, ${children})`,
        endIndex: i
    }
}

/**
 * Main transformer function
 * 
 * Transforms JSX-like tags inside Zenith expressions into __zenith.h() calls.
 */
export function transformExpressionJSX(code: string): string {
    // Skip if no JSX-like content (optimization)
    if (!/<[a-zA-Z]/.test(code)) {
        return code
    }

    let result = ''
    let i = 0

    while (i < code.length) {
        // Look for potential JSX tag start
        // Only treat as JSX if it follows common JSX contexts: (, return, =, :, ,, [, ?
        if (code[i] === '<' && /[a-zA-Z]/.test(code[i + 1] || '')) {
            // Check if this looks like a JSX context
            const beforeChar = i > 0 ? code[i - 1] : ''
            const beforeTrimmed = code.slice(0, i).trimEnd()
            const lastChar = beforeTrimmed[beforeTrimmed.length - 1] || ''

            // Common JSX-starting contexts
            const jsxContexts = ['(', '=', ':', ',', '[', '?', '{', 'n'] // 'n' for 'return'
            const isJSXContext = jsxContexts.includes(lastChar) ||
                beforeTrimmed.endsWith('return') ||
                beforeTrimmed === '' ||
                (beforeChar && /\s/.test(beforeChar))

            if (isJSXContext) {
                const parsed = parseJSXElement(code, i)
                if (parsed) {
                    result += parsed.hCall
                    i = parsed.endIndex
                    continue
                }
            }
        }

        result += code[i]
        i++
    }

    return result
}
