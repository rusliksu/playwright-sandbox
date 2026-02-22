import { test, expect } from '@playwright/test';

const URL = 'https://rusliksu.github.io/tm-tierlist/';
const CORPS_URL = 'https://rusliksu.github.io/tm-tierlist/output/tierlist_corporations_ru.html';

test.describe('Performance — tm-tierlist', () => {

  test('Core Web Vitals — главная', async ({ page }) => {
    await page.goto(URL);
    await page.waitForLoadState('load');

    const metrics = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const paint = performance.getEntriesByType('paint');
      const fcp = paint.find(p => p.name === 'first-contentful-paint');

      return {
        // Navigation Timing
        ttfb: Math.round(nav.responseStart - nav.requestStart),
        domContentLoaded: Math.round(nav.domContentLoadedEventEnd - nav.startTime),
        loadComplete: Math.round(nav.loadEventEnd - nav.startTime),
        // Paint
        fcp: fcp ? Math.round(fcp.startTime) : null,
        // Transfer
        transferSize: Math.round(nav.transferSize / 1024),
        encodedBodySize: Math.round(nav.encodedBodySize / 1024),
        decodedBodySize: Math.round(nav.decodedBodySize / 1024),
      };
    });

    console.log('\n📊 Главная страница:');
    console.log(`  TTFB:              ${metrics.ttfb}ms`);
    console.log(`  FCP:               ${metrics.fcp}ms`);
    console.log(`  DOMContentLoaded:  ${metrics.domContentLoaded}ms`);
    console.log(`  Load complete:     ${metrics.loadComplete}ms`);
    console.log(`  Transfer size:     ${metrics.transferSize} KB`);
    console.log(`  Decoded size:      ${metrics.decodedBodySize} KB`);

    // FCP может быть null на чисто JS-рендере
    if (metrics.fcp !== null) expect(metrics.fcp).toBeLessThan(3000);
    expect(metrics.loadComplete).toBeLessThan(10000);
  });

  test('Core Web Vitals — страница корпораций', async ({ page }) => {
    await page.goto(CORPS_URL);
    await page.waitForLoadState('load');

    const metrics = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const paint = performance.getEntriesByType('paint');
      const fcp = paint.find(p => p.name === 'first-contentful-paint');

      return {
        ttfb: Math.round(nav.responseStart - nav.requestStart),
        domContentLoaded: Math.round(nav.domContentLoadedEventEnd - nav.startTime),
        loadComplete: Math.round(nav.loadEventEnd - nav.startTime),
        fcp: fcp ? Math.round(fcp.startTime) : null,
        transferSize: Math.round(nav.transferSize / 1024),
        decodedBodySize: Math.round(nav.decodedBodySize / 1024),
      };
    });

    console.log('\n📊 Страница корпораций (67 карт):');
    console.log(`  TTFB:              ${metrics.ttfb}ms`);
    console.log(`  FCP:               ${metrics.fcp}ms`);
    console.log(`  DOMContentLoaded:  ${metrics.domContentLoaded}ms`);
    console.log(`  Load complete:     ${metrics.loadComplete}ms`);
    console.log(`  Transfer size:     ${metrics.transferSize} KB`);
    console.log(`  Decoded size:      ${metrics.decodedBodySize} KB`);

    expect(metrics.fcp).toBeLessThan(3000);
    expect(metrics.loadComplete).toBeLessThan(15000);
  });

  test('сетевые запросы — сколько и что грузится', async ({ page }) => {
    const requests: { url: string; type: string; size: number }[] = [];

    page.on('response', async res => {
      const size = parseInt(res.headers()['content-length'] || '0');
      requests.push({
        url: res.url().replace('https://rusliksu.github.io/tm-tierlist/', ''),
        type: res.request().resourceType(),
        size: Math.round(size / 1024),
      });
    });

    await page.goto(CORPS_URL);
    await page.waitForLoadState('load');

    // Группируем по типу
    const byType = requests.reduce((acc, r) => {
      acc[r.type] = (acc[r.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const images = requests.filter(r => r.type === 'image');
    const totalImageSize = images.reduce((s, r) => s + r.size, 0);

    console.log('\n📦 Сетевые запросы на странице корпораций:');
    console.log('  По типу:', byType);
    console.log(`  Картинок: ${images.length}, суммарно ~${totalImageSize} KB`);
    console.log(`  Всего запросов: ${requests.length}`);

    expect(requests.length).toBeGreaterThan(0);
  });

  test('5 холодных загрузок — среднее время', async ({ page }) => {
    const times: number[] = [];

    for (let i = 0; i < 5; i++) {
      const start = Date.now();
      await page.goto(URL, { waitUntil: 'domcontentloaded' });
      times.push(Date.now() - start);
      await page.waitForTimeout(200);
    }

    const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
    const min = Math.min(...times);
    const max = Math.max(...times);

    console.log('\n⏱ 5 загрузок главной (DOMContentLoaded):');
    console.log(`  Замеры: ${times.map(t => t + 'ms').join(', ')}`);
    console.log(`  Min: ${min}ms  Max: ${max}ms  Avg: ${avg}ms`);

    expect(avg).toBeLessThan(5000);
  });

  test('LCP через PerformanceObserver', async ({ page }) => {
    await page.goto(URL);

    const lcp = await page.evaluate(() => {
      return new Promise<number>(resolve => {
        new PerformanceObserver(list => {
          const entries = list.getEntries();
          const last = entries[entries.length - 1] as any;
          resolve(Math.round(last.startTime));
        }).observe({ type: 'largest-contentful-paint', buffered: true });

        // fallback если нет LCP
        setTimeout(() => resolve(-1), 5000);
      });
    });

    console.log('\n🖼 LCP (Largest Contentful Paint):', lcp === -1 ? 'не определён' : `${lcp}ms`);
    if (lcp !== -1) {
      // Google рекомендует < 2500ms
      const rating = lcp < 2500 ? '✅ Good' : lcp < 4000 ? '⚠️ Needs improvement' : '❌ Poor';
      console.log(`  Оценка: ${rating} (порог Good: <2500ms)`);
      expect(lcp).toBeLessThan(5000);
    }
  });
});
