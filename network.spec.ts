import { test, expect, type CDPSession } from '@playwright/test';

const BASE  = 'https://rusliksu.github.io/tm-tierlist';
const CORPS = BASE + '/output/tierlist_corporations_ru.html';

// ─── 1. Замер нормальной загрузки vs throttling ─────────────────────────────

test.describe('Network conditions', () => {

  test('baseline: нормальное соединение — DOMContentLoaded', async ({ page }) => {
    const start = Date.now();
    await page.goto(CORPS, { waitUntil: 'domcontentloaded' });
    const elapsed = Date.now() - start;

    console.log(`\n  🌐 Нормальное соединение: ${elapsed}ms`);
    expect(elapsed).toBeLessThan(10_000);
  });

  test('slow 3G: throttling через CDP замедляет загрузку', async ({ page }) => {
    const cdp: CDPSession = await page.context().newCDPSession(page);

    // Slow 3G: ~400kbps download, ~400ms latency
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: (400 * 1024) / 8,  // 400 Kbps → bytes/sec
      uploadThroughput: (400 * 1024) / 8,
      latency: 400,
    });

    const start = Date.now();
    await page.goto(CORPS, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    const elapsed = Date.now() - start;

    console.log(`\n  🐌 Slow 3G (400kbps, 400ms latency): ${elapsed}ms`);
    // На slow 3G загрузка должна быть существенно медленнее
    expect(elapsed).toBeGreaterThan(500);

    await cdp.detach();
  });

  test('fast 3G: промежуточный профиль', async ({ page }) => {
    const cdp: CDPSession = await page.context().newCDPSession(page);

    // Fast 3G: ~1.5mbps download, ~150ms latency
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: (1.5 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
      latency: 150,
    });

    const start = Date.now();
    await page.goto(CORPS, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    const elapsed = Date.now() - start;

    console.log(`\n  📶 Fast 3G (1.5mbps, 150ms latency): ${elapsed}ms`);
    expect(elapsed).toBeGreaterThan(200);

    await cdp.detach();
  });

});

// ─── 2. Offline ──────────────────────────────────────────────────────────────

test.describe('Offline mode', () => {

  test('offline: навигация фейлится с net::ERR_INTERNET_DISCONNECTED', async ({ page }) => {
    const cdp: CDPSession = await page.context().newCDPSession(page);

    await cdp.send('Network.emulateNetworkConditions', {
      offline: true,
      downloadThroughput: 0,
      uploadThroughput: 0,
      latency: 0,
    });

    let errorThrown = false;
    try {
      await page.goto(CORPS, { timeout: 10_000 });
    } catch (e: unknown) {
      errorThrown = true;
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`\n  ✈ Offline: ${msg.split('\n')[0]}`);
      expect(msg).toMatch(/net::ERR_INTERNET_DISCONNECTED|ERR_FAILED|NS_ERROR/);
    }

    expect(errorThrown).toBe(true);
    await cdp.detach();
  });

  test('offline → online: восстановление загрузки', async ({ page }) => {
    const cdp: CDPSession = await page.context().newCDPSession(page);

    // Уходим в offline
    await cdp.send('Network.emulateNetworkConditions', {
      offline: true,
      downloadThroughput: 0,
      uploadThroughput: 0,
      latency: 0,
    });

    let failed = false;
    try {
      await page.goto(CORPS, { timeout: 5_000 });
    } catch {
      failed = true;
    }
    expect(failed).toBe(true);

    // Возвращаемся online
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: -1, // без ограничений
      uploadThroughput: -1,
      latency: 0,
    });

    await page.goto(CORPS, { waitUntil: 'domcontentloaded' });
    const cards = await page.locator('.card').count();
    console.log(`\n  ✈→🌐 Offline → Online: загрузились ${cards} карт`);
    expect(cards).toBe(67);

    await cdp.detach();
  });

});

// ─── 3. Влияние блокировки ресурсов ──────────────────────────────────────────

test.describe('Resource impact', () => {

  test('с картинками vs без: замер разницы', async ({ browser }) => {
    // С картинками
    const ctx1 = await browser.newContext();
    const page1 = await ctx1.newPage();
    const start1 = Date.now();
    await page1.goto(CORPS, { waitUntil: 'load', timeout: 30_000 });
    const withImages = Date.now() - start1;
    await ctx1.close();

    // Без картинок
    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();
    await page2.route('**/*.{png,jpg,jpeg,gif,svg,webp}', route => route.abort());
    const start2 = Date.now();
    await page2.goto(CORPS, { waitUntil: 'load', timeout: 30_000 });
    const withoutImages = Date.now() - start2;
    await ctx2.close();

    const diff = withImages - withoutImages;
    const pct = withImages > 0 ? Math.round((diff / withImages) * 100) : 0;

    console.log(`\n  🖼 С картинками: ${withImages}ms`);
    console.log(`  🚫 Без картинок: ${withoutImages}ms`);
    console.log(`  ⚡ Разница: ${diff}ms (${pct}% экономии)`);

    // Без картинок должно быть быстрее (или как минимум не медленнее)
    expect(withoutImages).toBeLessThanOrEqual(withImages + 500);
  });

  test('блокировка CSS: страница грузится, но без стилей', async ({ page }) => {
    let blockedCSS = 0;
    await page.route('**/*.css', route => {
      blockedCSS++;
      return route.abort();
    });

    await page.goto(CORPS, { waitUntil: 'domcontentloaded' });
    const cards = await page.locator('.card').count();

    console.log(`\n  🎨 Заблокировано CSS: ${blockedCSS}`);
    console.log(`  Карт на странице (без стилей): ${cards}`);

    // Контент загружается даже без CSS
    expect(cards).toBe(67);
  });

});
