/**
 * Component Script Transformer
 * 
 * Transforms component scripts for instance-scoped execution.
 * Uses namespace binding pattern for cleaner output:
 *   const { signal, effect, onMount, ... } = __inst;
 * 
 * Uses es-module-lexer to parse imports:
 * - .zen imports are stripped (compile-time resolved)
 * - npm imports are extracted as structured metadata for bundling
 * 
 * IMPORTANT: No regex-based import parsing.
 */

import { init, parse } from 'es-module-lexer'
import type { ComponentScriptIR, ScriptImport } from '../ir/types'

// Initialize es-module-lexer (must be called before parsing)
let lexerInitialized = false
async function ensureLexerInit(): Promise<void> {
    if (!lexerInitialized) {
        await init
        lexerInitialized = true
    }
}

/**
 * Namespace bindings - destructured from the instance
 * This is added at the top of every component script
 */
const NAMESPACE_BINDINGS = `const { 
    signal, state, memo, effect, ref, 
    batch, untrack, onMount, onUnmount 
} = __inst;`

/**
 * Mapping of zen* prefixed names to unprefixed names
 * These get rewritten to use the destructured namespace
 */
const ZEN_PREFIX_MAPPINGS: Record<string, string> = {
    'zenSignal': 'signal',
    'zenState': 'state',
    'zenMemo': 'memo',
    'zenEffect': 'effect',
    'zenRef': 'ref',
    'zenBatch': 'batch',
    'zenUntrack': 'untrack',
    'zenOnMount': 'onMount',
    'zenOnUnmount': 'onUnmount',
}

/**
 * Result of script transformation including extracted imports
 */
export interface TransformResult {
    script: string           // Transformed script (imports removed)
    imports: ScriptImport[]  // Structured npm imports to hoist
}

/**
 * Parse and extract imports from script content using es-module-lexer
 * 
 * @param scriptContent - Raw script content
 * @returns Object with imports array and script with imports stripped
 */
export async function parseAndExtractImports(scriptContent: string): Promise<{
    imports: ScriptImport[]
    strippedCode: string
}> {
    await ensureLexerInit()

    const imports: ScriptImport[] = []
    const [parsedImports] = parse(scriptContent)

    // Sort imports by start position (descending) for safe removal
    const sortedImports = [...parsedImports].sort((a, b) => b.ss - a.ss)

    let strippedCode = scriptContent

    for (const imp of sortedImports) {
        const source = imp.n || ''  // Module specifier
        const importStatement = scriptContent.slice(imp.ss, imp.se)

        // Skip .zen file imports (compile-time resolved) - just strip them
        if (source.endsWith('.zen')) {
            strippedCode = strippedCode.slice(0, imp.ss) + strippedCode.slice(imp.se)
            continue
        }

        // Skip relative imports (compile-time resolved) - just strip them
        if (source.startsWith('./') || source.startsWith('../')) {
            strippedCode = strippedCode.slice(0, imp.ss) + strippedCode.slice(imp.se)
            continue
        }

        // This is an npm/external import - extract as structured metadata
        const isTypeOnly = importStatement.startsWith('import type')
        const isSideEffect = imp.ss === imp.se || !importStatement.includes(' from ')

        // Extract specifiers from the import statement
        let specifiers = ''
        if (!isSideEffect) {
            const fromIndex = importStatement.indexOf(' from ')
            if (fromIndex !== -1) {
                // Get everything between 'import' (or 'import type') and 'from'
                const start = isTypeOnly ? 'import type '.length : 'import '.length
                specifiers = importStatement.slice(start, fromIndex).trim()
            }
        }

        imports.push({
            source,
            specifiers,
            typeOnly: isTypeOnly,
            sideEffect: isSideEffect
        })

        // Strip the import from the code (it will be hoisted to bundle top)
        strippedCode = strippedCode.slice(0, imp.ss) + strippedCode.slice(imp.se)
    }

    // Clean up any leftover empty lines from stripped imports
    strippedCode = strippedCode.replace(/^\s*\n/gm, '')

    // Reverse imports array since we processed in reverse order
    imports.reverse()

    return { imports, strippedCode }
}

/**
 * Transform a component's script content for instance-scoped execution
 * 
 * @param componentName - Name of the component
 * @param scriptContent - Raw script content from the component
 * @param props - Declared prop names
 * @returns TransformResult with transformed script and extracted imports
 */
export async function transformComponentScript(
    componentName: string,
    scriptContent: string,
    props: string[]
): Promise<TransformResult> {
    // Parse and extract imports using es-module-lexer
    const { imports, strippedCode } = await parseAndExtractImports(scriptContent)

    let transformed = strippedCode

    // Rewrite zen* prefixed calls to unprefixed (uses namespace bindings)
    for (const [zenName, unprefixedName] of Object.entries(ZEN_PREFIX_MAPPINGS)) {
        // Match the zen* name as a standalone call
        const regex = new RegExp(`(?<!\\w)${zenName}\\s*\\(`, 'g')
        transformed = transformed.replace(regex, `${unprefixedName}(`)
    }

    return {
        script: transformed.trim(),
        imports
    }
}

/**
 * Generate a component factory function
 * 
 * IMPORTANT: Factories are PASSIVE - they are registered but NOT invoked here.
 * Instantiation is driven by the hydrator when it discovers component markers.
 * 
 * @param componentName - Name of the component
 * @param transformedScript - Script content after hook rewriting
 * @param propNames - Declared prop names for destructuring
 * @returns Component factory registration code (NO eager instantiation)
 */
export function generateComponentFactory(
    componentName: string,
    transformedScript: string,
    propNames: string[]
): string {
    const propsDestructure = propNames.length > 0
        ? `const { ${propNames.join(', ')} } = props || {};`
        : ''

    // Register factory only - NO instantiation
    // Hydrator will call instantiate() when it finds data-zen-component markers
    return `
// Component Factory: ${componentName}
// Instantiation is driven by hydrator, not by bundle load
__zenith.defineComponent('${componentName}', function(props, rootElement) {
    const __inst = __zenith.createInstance('${componentName}', rootElement);
    
    // Namespace bindings (instance-scoped primitives)
    ${NAMESPACE_BINDINGS}
    
    ${propsDestructure}
    
    // Component script (instance-scoped)
    ${transformedScript}
    
    // Execute mount lifecycle (rootElement is already in DOM)
    __inst.mount();
    
    return __inst;
});
`
}

/**
 * Result of transforming all component scripts
 */
export interface TransformAllResult {
    code: string             // Combined factory code
    imports: ScriptImport[]  // All collected npm imports (deduplicated)
}

/**
 * Deduplicate imports by (source + specifiers + typeOnly) tuple
 * Returns deterministically sorted imports
 */
function deduplicateImports(imports: ScriptImport[]): ScriptImport[] {
    const seen = new Map<string, ScriptImport>()

    for (const imp of imports) {
        const key = `${imp.source}|${imp.specifiers}|${imp.typeOnly}`
        if (!seen.has(key)) {
            seen.set(key, imp)
        }
    }

    // Sort by source for deterministic output
    return Array.from(seen.values()).sort((a, b) => a.source.localeCompare(b.source))
}

/**
 * Emit import statements from structured metadata
 */
export function emitImports(imports: ScriptImport[]): string {
    const deduplicated = deduplicateImports(imports)

    return deduplicated.map(imp => {
        if (imp.sideEffect) {
            return `import '${imp.source}';`
        }
        const typePrefix = imp.typeOnly ? 'type ' : ''
        return `import ${typePrefix}${imp.specifiers} from '${imp.source}';`
    }).join('\n')
}

/**
 * Transform all component scripts from collected ComponentScriptIR
 * 
 * @param componentScripts - Array of component script IRs
 * @returns TransformAllResult with combined code and deduplicated imports
 */
export async function transformAllComponentScripts(
    componentScripts: ComponentScriptIR[]
): Promise<TransformAllResult> {
    if (!componentScripts || componentScripts.length === 0) {
        return { code: '', imports: [] }
    }

    const allImports: ScriptImport[] = []

    const factories = await Promise.all(
        componentScripts
            .filter(comp => comp.script && comp.script.trim().length > 0)
            .map(async comp => {
                const result = await transformComponentScript(
                    comp.name,
                    comp.script,
                    comp.props
                )

                // Collect imports
                allImports.push(...result.imports)

                return generateComponentFactory(comp.name, result.script, comp.props)
            })
    )

    return {
        code: factories.join('\n'),
        imports: deduplicateImports(allImports)
    }
}
