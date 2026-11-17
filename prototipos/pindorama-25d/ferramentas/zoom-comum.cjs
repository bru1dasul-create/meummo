// O que as ferramentas de medir o zoom têm em comum: entrar no jogo de verdade (um servidor de teste ligado, com
// `npm run build && npm start`), virar ADM, levar o herói para um lugar e achar os NPCs.
// O personagem de teste é criado na primeira vez (NOME e SENHA trocam o nome e a senha dele; é uma conta só do
// servidor de teste, como a dos bots).
const NOME = process.env.NOME || 'Medidor';
const SENHA = process.env.SENHA || 'medidor-do-zoom';

const admin = (base, route, body) => fetch(base + route, { method: 'POST', headers: { 'content-type': 'application/json', 'x-meummo-admin': '1' }, body: JSON.stringify(body) }).then((r) => r.text());

/** Entra no jogo (cria a conta se ela ainda não existe) e espera o mundo aparecer. Devolve o id do herói. */
async function entrar(page, base, nome = NOME, senha = SENHA) {
  const pronto = (ms) => page.waitForFunction(() => window.__mundoNovo && window.__mundoNovo.me, null, { timeout: ms }).then(() => true, () => false);
  await page.goto(base + '/');
  // quem nunca entrou neste navegador começa em "Criar uma conta": primeiro tenta entrar com a que já existe
  if (await page.isVisible('#password2')) await page.click('#mode-toggle');
  await page.fill('#name', nome);
  await page.fill('#password', senha);
  await page.click('#login-button');
  if (!(await pronto(8000))) {
    await page.goto(base + '/');
    if (!(await page.isVisible('#password2'))) await page.click('#mode-toggle');
    await page.fill('#name', nome);
    await page.fill('#password', senha);
    await page.fill('#password2', senha);
    await page.click('#login-button');
    if (!(await pronto(30000))) throw new Error('não consegui entrar nem criar a conta ' + nome);
  }
  await page.waitForTimeout(1500);
  await admin(base, '/admin/api/adm', { nome, admin: true });
  return page.evaluate(() => window.__mundoNovo.me.id);
}

/** Leva o herói (painel do administrador: só funciona no computador do servidor). */
const levar = (base, id, x, y, mapa = 'capao') => admin(base, '/admin/api/jogador', { acao: 'levar', id, mapa, x, y });

/** Dia claro e nenhum monstro por perto (os botões do menu ADM, tecla G): a cena fica igual em toda rodada. */
async function cenaLimpa(page) {
  await page.keyboard.press('g');
  await page.waitForTimeout(300);
  await page.evaluate(() => { for (const t of ['Virar dia', 'Derrubar monstros perto']) { const bt = [...document.querySelectorAll('#gm-panel button')].find((x) => x.textContent.trim() === t); if (bt) bt.click(); } });
  await page.keyboard.press('g');
}

/** Os NPCs do mapa: { id, type, name, x, y } (metros). `tipo` escolhe um pelo tipo ou pelo nome. */
async function acharNpc(page, tipo) {
  const npcs = await page.evaluate(() => [...window.PD.view.actors.values()].filter((a) => a.kind === 'npc').map((a) => ({ id: a.id, type: a.type, name: a.name, x: a.ch ? a.ch.pos.x / 100 : a.creature ? a.creature.pos.x / 100 : 0, y: a.ch ? a.ch.pos.y / 100 : a.creature ? a.creature.pos.y / 100 : 0 })));
  return npcs.find((a) => new RegExp(tipo, 'i').test(a.type + ' ' + a.name)) || npcs[0] || null;
}

/** Um nome curto para um objeto do mundo (as classes saem com o nome encurtado no jogo compilado). */
const ROTULO = `(o) => {
  const d = o.t || o.b || o.d || o.p || o.w || o.f || (o.house && o.house.b) || {};
  const what = o.t ? (o.overhead ? 'copa ' : 'tronco ') : o.b ? (o.b.interior ? 'casa de entrar ' : 'casa/prédio ') : '';
  return what + (d.kind || d.type || d.id || d.name || (d.shop && d.shop.type) || '?') + (o.house ? ' (de dentro da casa)' : '');
}`;

module.exports = { NOME, SENHA, admin, entrar, levar, cenaLimpa, acharNpc, ROTULO };
