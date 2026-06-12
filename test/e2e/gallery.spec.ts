// Visual QA: drive specific challenges and screenshot them mid-play.
import { test, type Page } from '@playwright/test';

declare global {
  interface Window {
    __game: any;
  }
}

async function joinAs(page: Page, name: string, code?: string): Promise<void> {
  await page.goto(code ? `/?room=${code}` : '/');
  await page.fill('#j-name', name);
  if (code) {
    await page.fill('#j-code', code);
    await page.click('#j-join');
  } else {
    await page.click('#j-create');
  }
  await page.waitForFunction(() => window.__game?.code?.length === 4, undefined, { timeout: 15000 });
}

async function startGame(host: Page, guest: Page, key: string): Promise<void> {
  await joinAs(host, 'Joe');
  const code: string = await host.evaluate(() => window.__game.code);
  await joinAs(guest, 'Sara', code);
  await host.waitForFunction(() => window.__game.roster.filter((r: any) => r.connected).length === 2);
  await host.click('#l-start');
  await host.waitForFunction(() => window.__game.phase === 'pick', undefined, { timeout: 10000 });
  await host.click(`[data-pick="${key}"]`);
  await host.waitForFunction(() => window.__game.phase === 'playing', undefined, { timeout: 25000 });
}

test('gallery: friction', async ({ browser }) => {
  const ctxs = await Promise.all([browser.newContext(), browser.newContext()]);
  const [a, b] = await Promise.all(ctxs.map((x) => x.newPage()));
  await startGame(a, b, 'fire');
  for (let i = 0; i < 14; i++) {
    await a.keyboard.press(' ');
    await a.waitForTimeout(260);
  }
  await a.screenshot({ path: 'test-results/g-fire.png' });
  for (const x of ctxs) await x.close();
});

test('gallery: stampede', async ({ browser }) => {
  const ctxs = await Promise.all([browser.newContext(), browser.newContext()]);
  const [a, b] = await Promise.all(ctxs.map((x) => x.newPage()));
  await startGame(a, b, 'stampede');
  await a.keyboard.down('ArrowRight');
  await b.keyboard.down('ArrowLeft');
  await a.waitForTimeout(1800);
  await a.keyboard.press(' '); // charge if elephant
  await b.keyboard.press(' ');
  await a.waitForTimeout(900);
  await a.screenshot({ path: 'test-results/g-stampede.png' });
  for (const x of ctxs) await x.close();
});

test('gallery: shove', async ({ browser }) => {
  const ctxs = await Promise.all([browser.newContext(), browser.newContext()]);
  const [a, b] = await Promise.all(ctxs.map((x) => x.newPage()));
  await startGame(a, b, 'shove');
  await a.keyboard.down('d');
  await b.keyboard.down('a');
  await a.waitForTimeout(1500);
  await a.keyboard.press('e'); // charge!
  await b.keyboard.press('q'); // dodge!
  await a.waitForTimeout(700);
  await a.screenshot({ path: 'test-results/g-shove.png' });
  for (const x of ctxs) await x.close();
});

test('gallery: gather', async ({ browser }) => {
  const ctxs = await Promise.all([browser.newContext(), browser.newContext()]);
  const [a, b] = await Promise.all(ctxs.map((x) => x.newPage()));
  await startGame(a, b, 'gather');
  await a.keyboard.down('d');
  await b.keyboard.down('a');
  await a.waitForTimeout(2600);
  await a.screenshot({ path: 'test-results/g-gather.png' });
  for (const x of ctxs) await x.close();
});
