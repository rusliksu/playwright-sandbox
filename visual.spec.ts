import { test, expect } from '@playwright/test';

const BASE = 'https://rusliksu.github.io/tm-tierlist';

test.describe('Visual regression — tm-tierlist', () => {

  // ─── 1. Главная страница целиком ──────────────────────────────────────────

  test('главная — full page', async ({ page }) => {
    await page.goto(BASE + '/');
    await page.waitForLoadState('load');
    // Ждём шрифты/картинки
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('home-full.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });

  // ─── 2. Хедер крупным планом ─────────────────────────────────────────────

  test('главная — хедер', async ({ page }) => {
    await page.goto(BASE + '/');
    await page.waitForLoadState('load');
    await page.waitForTimeout(300);

    const header = page.locator('.header');
    await expect(header).toHaveScreenshot('home-header.png', {
      maxDiffPixelRatio: 0.02,
    });
  });

  // ─── 3. Карточки навигации ────────────────────────────────────────────────

  test('главная — nav cards', async ({ page }) => {
    await page.goto(BASE + '/');
    await page.waitForLoadState('load');
    await page.waitForTimeout(300);

    const grid = page.locator('.cards-grid');
    await expect(grid).toHaveScreenshot('home-nav-cards.png', {
      maxDiffPixelRatio: 0.02,
    });
  });

  // ─── 4. Страница корпораций — viewport desktop ────────────────────────────

  test('корпорации — desktop viewport', async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(BASE + '/output/tierlist_corporations_ru.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    await expect(page).toHaveScreenshot('corps-desktop.png', {
      fullPage: false,
      maxDiffPixelRatio: 0.02,
      timeout: 15000,
      mask: [page.locator('img')],
    });
  });

  // ─── 5. Страница корпораций — mobile viewport ─────────────────────────────

  test('корпорации — mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(BASE + '/output/tierlist_corporations_ru.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    // Маскируем картинки — они грузятся нестабильно, сравниваем только layout
    await expect(page).toHaveScreenshot('corps-mobile.png', {
      fullPage: false,
      maxDiffPixelRatio: 0.02,
      mask: [page.locator('img')],
    });
  });

  // ─── 6. Hover-состояние карточки ─────────────────────────────────────────

  test('корпорации — hover на карточке', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(BASE + '/output/tierlist_corporations_ru.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);

    const firstCard = page.locator('.card').first();
    await firstCard.waitFor({ state: 'visible', timeout: 15000 });
    await firstCard.scrollIntoViewIfNeeded();
    await firstCard.hover();
    await page.waitForTimeout(300); // transition 0.2s

    await expect(firstCard).toHaveScreenshot('card-hover.png', {
      maxDiffPixelRatio: 0.03,
      mask: [firstCard.locator('img')],
    });
  });

  // ─── 7. Первый тир-ряд ───────────────────────────────────────────────────

  test('корпорации — S-тир', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(BASE + '/output/tierlist_corporations_ru.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const sTier = page.locator('#tier-S');
    await expect(sTier).toHaveScreenshot('corps-s-tier.png', {
      maxDiffPixelRatio: 0.02,
      mask: [sTier.locator('img')],
    });
  });

});
