#!/usr/bin/env node
import { createZenithBundler } from '@zenithbuild/bundler';

const args = process.argv.slice(2);
const command = args[0];
const root = process.cwd();

(async () => {
    if (command === 'dev') {
        // Direct delegation to bundler dev server
        await import('@zenithbuild/bundler/dev-server');
    } else if (command === 'build') {
        const bundler = createZenithBundler();
        await bundler.build({ root });
    } else {
        console.log("Usage: zenith [dev|build]");
        process.exit(1);
    }
})();
