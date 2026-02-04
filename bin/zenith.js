#!/usr/bin/env node

import { createZenithBundler } from '@zenithbuild/bundler';

const args = process.argv.slice(2);
const command = args[0];
const root = process.cwd();

(async () => {
    const bundler = createZenithBundler();

    try {
        if (command === 'dev') {
            await bundler.dev({ root });
        } else if (command === 'build') {
            await bundler.build({ root });
        } else {
            console.log("Usage: zenith [dev|build]");
            process.exit(1);
        }
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
