/**
 * Zenith Plugin Registry
 * 
 * Manages plugin registration and initialization
 */

import type { ZenithPlugin, PluginContext, ContentItem } from '../config/types';

/**
 * Plugin registry for managing Zenith plugins
 */
export class PluginRegistry {
    private plugins = new Map<string, ZenithPlugin>();

    /**
     * Register a plugin
     */
    register(plugin: ZenithPlugin): void {
        if (this.plugins.has(plugin.name)) {
            console.warn(`[Zenith] Plugin "${plugin.name}" is already registered. Overwriting.`);
        }
        this.plugins.set(plugin.name, plugin);
    }

    /**
     * Get a plugin by name
     */
    get(name: string): ZenithPlugin | undefined {
        return this.plugins.get(name);
    }

    /**
     * Check if a plugin is registered
     */
    has(name: string): boolean {
        return this.plugins.has(name);
    }

    /**
     * Get all registered plugins
     */
    all(): ZenithPlugin[] {
        return Array.from(this.plugins.values());
    }

    /**
     * Initialize all plugins with the provided context
     */
    async initAll(ctx: PluginContext): Promise<void> {
        for (const plugin of this.plugins.values()) {
            try {
                await plugin.setup(ctx);
                console.log(`[Zenith] Plugin "${plugin.name}" initialized`);
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : String(error);
                console.error(`[Zenith] Failed to initialize plugin "${plugin.name}":`, message);
            }
        }
    }

    /**
     * Clear all registered plugins
     */
    clear(): void {
        this.plugins.clear();
    }
}

/**
 * Create a plugin context for initialization
 */
export function createPluginContext(
    projectRoot: string,
    contentSetter: (data: Record<string, ContentItem[]>) => void
): PluginContext {
    return {
        projectRoot,
        setContentData: contentSetter,
        options: {}
    };
}
