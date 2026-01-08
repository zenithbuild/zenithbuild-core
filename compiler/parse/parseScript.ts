/**
 * Script Parser
 * 
 * Extracts <script> blocks from .zen files
 * Phase 1: Only extracts raw content, no evaluation
 */

import type { ScriptIR } from '../ir/types'

export function parseScript(html: string): ScriptIR | null {
  const scripts: string[] = []
  const attributes: Record<string, string> = {}

  const scriptRegex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi
  let match

  while ((match = scriptRegex.exec(html)) !== null) {
    const attrString = match[1] || ''
    const content = match[2] || ''

    // Parse attributes
    const attrRegex = /([a-z0-9-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^>\s]+)))?/gi
    let attrMatch
    while ((attrMatch = attrRegex.exec(attrString)) !== null) {
      const name = attrMatch[1]
      if (name) {
        const value = attrMatch[2] || attrMatch[3] || attrMatch[4] || 'true'
        attributes[name] = value
      }
    }

    if (content) {
      scripts.push(content.trim())
    }
  }

  if (scripts.length === 0) {
    return null
  }

  return {
    raw: scripts.join('\n\n'),
    attributes
  }
}

