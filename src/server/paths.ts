import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Pasta raiz do projeto (funciona rodando pelo tsx ou compilado). */
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const MAP_FILE = path.join(ROOT, 'public/assets/maps/world.tmj');
export const MONSTERS_FILE = path.join(ROOT, 'data/monsters.json');
export const CLIENT_DIR = path.join(ROOT, 'dist/client');
