import { expect, test, type Page } from '@playwright/test';

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

test('three castaways run a season opener', async ({ browser }) => {
  const ctxs = await Promise.all([browser.newContext(), browser.newContext(), browser.newContext()]);
  const [a, b, c] = await Promise.all(ctxs.map((x) => x.newPage()));

  await joinAs(a, 'Alice');
  const code: string = await a.evaluate(() => window.__game.code);
  await joinAs(b, 'Bob', code);
  await joinAs(c, 'Carol', code);
  await a.waitForFunction(() => window.__game.roster.filter((r: any) => r.connected).length === 3);
  await a.screenshot({ path: 'test-results/lobby.png' });

  await a.click('#l-start');
  await a.waitForFunction(() => window.__game.phase === 'intro', undefined, { timeout: 10000 });
  await a.screenshot({ path: 'test-results/intro.png' });

  await a.waitForFunction(() => window.__game.phase === 'playing', undefined, { timeout: 25000 });
  await b.waitForFunction(() => window.__game.phase === 'playing', undefined, { timeout: 25000 });
  const g = await a.evaluate(() => window.__game.state?.g);
  expect(['fire', 'fish', 'balance', 'climb', 'memory', 'idol', 'gather', 'type']).toContain(g);
  // everyone sees the same game
  expect(await b.evaluate(() => window.__game.state?.g)).toBe(g);

  // taps don't break anything (canvas input path)
  await a.mouse.click(640, 400);
  await a.mouse.click(640, 400);
  await a.waitForTimeout(800);
  await a.screenshot({ path: 'test-results/challenge.png' });

  // Bob refreshes and lands back in the same slot, same season
  const slotBefore = await b.evaluate(() => window.__game.you.slot);
  await b.reload();
  await b.waitForFunction(() => window.__game?.phase && window.__game.phase !== 'lobby', undefined, { timeout: 15000 });
  expect(await b.evaluate(() => window.__game.you.slot)).toBe(slotBefore);

  for (const x of ctxs) await x.close();
});

test('join screen renders', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.title')).toContainText('CASTAWAY CUP');
  await page.screenshot({ path: 'test-results/join.png' });
});
