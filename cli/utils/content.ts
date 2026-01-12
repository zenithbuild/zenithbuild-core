import fs from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';

export interface ContentItem {
    id?: string | number;
    slug?: string | null;
    collection?: string | null;
    content?: string | null;
    [key: string]: any | null;
}

/**
 * Load all content from the content directory
 */
export function loadContent(contentDir: string): Record<string, ContentItem[]> {
    if (!fs.existsSync(contentDir)) {
        return {};
    }

    const collections: Record<string, ContentItem[]> = {};
    const files = getAllFiles(contentDir);

    for (const filePath of files) {
        const ext = path.extname(filePath).toLowerCase();
        const relativePath = path.relative(contentDir, filePath);
        const collection = relativePath.split(path.sep)[0];
        if (!collection) continue;

        const slug = relativePath.replace(/\.(md|mdx|json)$/, '').replace(/\\/g, '/');
        const id = slug;

        const rawContent = fs.readFileSync(filePath, 'utf-8');

        if (!collections[collection]) {
            collections[collection] = [];
        }

        if (ext === '.json') {
            try {
                const data = JSON.parse(rawContent);
                collections[collection].push({
                    id,
                    slug,
                    collection,
                    content: '',
                    ...data
                });
            } catch (e) {
                console.error(`Error parsing JSON file ${filePath}:`, e);
            }
        } else if (ext === '.md' || ext === '.mdx') {
            const { metadata, content } = parseMarkdown(rawContent);
            collections[collection].push({
                id,
                slug,
                collection,
                content,
                ...metadata
            });
        }
    }

    return collections;
}

function getAllFiles(dir: string, fileList: string[] = []): string[] {
    const files = fs.readdirSync(dir);
    files.forEach((file: string) => {
        const name = path.join(dir, file);
        if (fs.statSync(name).isDirectory()) {
            getAllFiles(name, fileList);
        } else {
            fileList.push(name);
        }
    });
    return fileList;
}

function parseMarkdown(content: string): { metadata: Record<string, any>, content: string } {
    const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
    const match = content.match(frontmatterRegex);

    if (!match) {
        return { metadata: {}, content: content.trim() };
    }

    const [, yamlStr, body] = match;
    const metadata: Record<string, any> = {};

    if (yamlStr) {
        yamlStr.split('\n').forEach(line => {
            const [key, ...values] = line.split(':');
            if (key && values.length > 0) {
                const value = values.join(':').trim();
                // Basic type conversion
                if (value === 'true') metadata[key.trim()] = true;
                else if (value === 'false') metadata[key.trim()] = false;
                else if (!isNaN(Number(value))) metadata[key.trim()] = Number(value);
                else if (value.startsWith('[') && value.endsWith(']')) {
                    metadata[key.trim()] = value.slice(1, -1).split(',').map(v => v.trim().replace(/^['"]|['"]$/g, ''));
                }
                else metadata[key.trim()] = value.replace(/^['"]|['"]$/g, '');
            }
        });
    }

    return {
        metadata,
        content: marked.parse((body || '').trim()) as string
    };
}
