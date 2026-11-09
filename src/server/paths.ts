import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Pasta raiz do projeto (funciona rodando pelo tsx ou compilado). */
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
/** Os mapas (um arquivo .tmj do Tiled por zona; o nome do arquivo é o id do mapa). */
export const MAPS_DIR = path.join(ROOT, 'public/assets/maps');
export const MONSTERS_FILE = path.join(ROOT, 'data/monsters.json');
export const ITEMS_FILE = path.join(ROOT, 'data/items.json');
export const NPCS_FILE = path.join(ROOT, 'data/npcs.json');
export const QUESTS_FILE = path.join(ROOT, 'data/missoes.json');
export const CLIENT_DIR = path.join(ROOT, 'dist/client');
/** Personagens salvos (não vai para o Git: cada computador tem os seus). */
export const SAVE_FILE = path.join(ROOT, 'saves/meummo.db');
