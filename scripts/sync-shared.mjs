// Copies the shared domain layer into functions/src/shared so Cloud Functions deploys are self-contained.
import { cpSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
rmSync(`${root}functions/src/shared`, { recursive: true, force: true });
cpSync(`${root}shared`, `${root}functions/src/shared`, { recursive: true });
console.log('shared/ → functions/src/shared synced');
