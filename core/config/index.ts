/**
 * Zenith Config
 * 
 * Public exports for zenith/config
 */

export { defineConfig } from './types';
export type {
    ZenithConfig,
    ZenithPlugin,
    PluginContext,
    ContentSourceConfig,
    ContentPluginOptions,
    ContentItem
} from './types';
export { loadZenithConfig, hasZenithConfig } from './loader';
