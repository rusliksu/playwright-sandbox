import { test, expect } from '@playwright/test';

const BASE  = 'https://rusliksu.github.io/tm-tierlist';
const CORPS = BASE + '/output/tierlist_corporations_ru.html';

// ─── 1. Навигация между страницами ──────────────────────────────────────────

test.describe('Навигация', () => {

  test('главная → корпорации → прелюдии → назад на главную', async ({ page }) => {
    await page.goto(BASE + '/');
    await page.waitForLoadState('load');

    // Переходим на корпорации
    await page.getByRole('link', { name: /корпорации/i }).first().click();
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/corporations/);

    // Переходим на прелюдии через навбар
    await page.getByRole('link', { name: /прелюдии/i }).click();
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/preludes/);

    // Кнопка "Назад" → главная
    await page.getByRole('link', { name: /главная|back|←/i }).click();
    await page.waitForLoadState('load');
    await expect(page).toHaveURL(/tm-tierlist\/(index\.html)?$/);
  });

  test('все 4 страницы открываются без ошибок', async ({ page }) => {
    const pages = [
      { url: '/output/tierlist_corporations_ru.html', name: 'Корпорации' },
      { url: '/output/tierlist_preludes_ru.html',     name: 'Прелюдии' },
      { url: '/output/tierlist_projects_ru.html',     name: 'Проекты' },
      { url: '/output/tierlist_ceos_ru.html',         name: 'CEO' },
    ];

    for (const { url, name } of pages) {
      await page.goto(BASE + url, { waitUntil: 'domcontentloaded' });
      const cards = page.locator('.card');
      await expect(cards.first()).toBeVisible({ timeout: 10000 });
      const count = await cards.count();
      console.log(`  ${name}: ${count} карт`);
      expect(count).toBeGreaterThan(0);
    }
  });

});

// ─── 2. Переключение языка ───────────────────────────────────────────────────

test.describe('Язык', () => {

  test('переключение RU → EN меняет тексты', async ({ page }) => {
    await page.goto(CORPS, { waitUntil: 'domcontentloaded' });

    // Проверяем что сейчас RU
    const subtitle = page.locator('.subtitle');
    await expect(subtitle).toContainText('карт');

    // Кликаем EN
    await page.getByRole('link', { name: 'EN' }).click();
    await page.waitForLoadState('domcontentloaded');

    // Субтитл теперь на английском
    await expect(page.locator('.subtitle')).toContainText('cards');
    await expect(page).toHaveURL(/corporations\.html/);
  });

  test('EN → RU возвращает русский интерфейс', async ({ page }) => {
    await page.goto(BASE + '/output/tierlist_corporations.html', { waitUntil: 'domcontentloaded' });

    await page.getByRole('link', { name: 'RU' }).click();
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('.subtitle')).toContainText('карт');
    await expect(page).toHaveURL(/corporations_ru\.html/);
  });

});

// ─── 3. Фильтрация карт ─────────────────────────────────────────────────────

test.describe('Фильтры', () => {

  test('фильтр по тиру — показывает только карты выбранного тира', async ({ page }) => {
    await page.goto(CORPS, { waitUntil: 'domcontentloaded' });
    await page.locator('.card').first().waitFor({ state: 'visible' });

    const totalBefore = await page.locator('.card:not(.filtered-out)').count();

    // Кликаем на тир S
    await page.locator('.filter-chip.filter-tier[data-tier="S"]').click();
    await page.waitForTimeout(300);

    const visibleAfter = await page.locator('.card:not(.filtered-out)').count();

    console.log(`\n  Всего: ${totalBefore} → после фильтра S: ${visibleAfter}`);
    expect(visibleAfter).toBeGreaterThan(0);
    expect(visibleAfter).toBeLessThan(totalBefore);

    // Все видимые карты должны находиться в строке #tier-S
    // (data-tier нет на карточках — тир хранится в JS cardsData)
    const sTierVisible  = await page.locator('#tier-S .card:not(.filtered-out)').count();
    const allVisible    = await page.locator('.card:not(.filtered-out)').count();
    expect(sTierVisible).toBe(allVisible);
  });

  test('фильтр по тегу сужает список', async ({ page }) => {
    await page.goto(CORPS, { waitUntil: 'domcontentloaded' });
    await page.locator('.card').first().waitFor({ state: 'visible' });

    const totalBefore = await page.locator('.card:not(.filtered-out)').count();

    // Кликаем на тег Earth
    await page.locator('.filter-chip[data-tag="Earth"]').click();
    await page.waitForTimeout(300);

    const visibleAfter = await page.locator('.card:not(.filtered-out)').count();
    console.log(`\n  Earth-тег: ${totalBefore} → ${visibleAfter}`);

    expect(visibleAfter).toBeGreaterThan(0);
    expect(visibleAfter).toBeLessThan(totalBefore);
  });

  test('кнопка сброса снимает все фильтры', async ({ page }) => {
    await page.goto(CORPS, { waitUntil: 'domcontentloaded' });
    await page.locator('.card').first().waitFor({ state: 'visible' });

    const totalBefore = await page.locator('.card:not(.filtered-out)').count();

    // Включаем фильтр
    await page.locator('.filter-chip.filter-tier[data-tier="A"]').click();
    await page.waitForTimeout(200);
    const filtered = await page.locator('.card:not(.filtered-out)').count();
    expect(filtered).toBeLessThan(totalBefore);

    // Сброс
    await page.locator('.reset-btn').click();
    await page.waitForTimeout(200);

    const afterReset = await page.locator('.card:not(.filtered-out)').count();
    expect(afterReset).toBe(totalBefore);
    console.log(`\n  Сброс: ${filtered} → ${afterReset} (всё восстановлено)`);
  });

});

// ─── 4. Поиск ───────────────────────────────────────────────────────────────

test.describe('Поиск', () => {

  test('поиск по имени карты', async ({ page }) => {
    await page.goto(CORPS, { waitUntil: 'domcontentloaded' });
    await page.locator('.card').first().waitFor({ state: 'visible' });

    const searchInput = page.locator('input[type="search"], input[placeholder*="оиск"], input[placeholder*="earch"]');
    await searchInput.fill('Point');
    await page.waitForTimeout(300);

    const visible = await page.locator('.card:not(.filtered-out)').count();
    console.log(`\n  Поиск "Point": ${visible} карт`);
    expect(visible).toBeGreaterThan(0);

    // Все видимые карты содержат "Point" в имени
    const names = await page.locator('.card:not(.filtered-out)').evaluateAll(
      cards => cards.map(c => c.getAttribute('data-name') || '')
    );
    expect(names.every(n => n.toLowerCase().includes('point'))).toBe(true);
  });

  test('поиск без результатов — 0 карт', async ({ page }) => {
    await page.goto(CORPS, { waitUntil: 'domcontentloaded' });
    await page.locator('.card').first().waitFor({ state: 'visible' });

    const searchInput = page.locator('input[type="search"], input[placeholder*="оиск"], input[placeholder*="earch"]');
    await searchInput.fill('xyzxyzxyz_несуществующая');
    await page.waitForTimeout(300);

    const visible = await page.locator('.card:not(.filtered-out)').count();
    expect(visible).toBe(0);
  });

});

// ─── 5. Модальное окно карточки ─────────────────────────────────────────────

test.describe('Модалка', () => {

  test('клик на карточку открывает модалку с данными', async ({ page }) => {
    await page.goto(CORPS, { waitUntil: 'domcontentloaded' });

    const firstCard = page.locator('.card').first();
    await firstCard.waitFor({ state: 'visible' });

    const cardName = await firstCard.getAttribute('data-name');
    await firstCard.click();

    const modal = page.locator('.modal, [id="modal"]');
    await expect(modal).toBeVisible({ timeout: 3000 });

    // Модалка содержит имя карты
    await expect(modal).toContainText(cardName || '');
    console.log(`\n  Открыта модалка: "${cardName}"`);
  });

  test('модалка закрывается по кнопке ×', async ({ page }) => {
    await page.goto(CORPS, { waitUntil: 'domcontentloaded' });

    await page.locator('.card').first().waitFor({ state: 'visible' });
    await page.locator('.card').first().click();

    const modal = page.locator('.modal, [id="modal"]');
    await expect(modal).toBeVisible({ timeout: 3000 });

    await page.locator('.modal-close, [id="modalClose"]').click();
    await expect(modal).not.toBeVisible({ timeout: 3000 });
  });

  test('навигация по модалке — кнопки prev/next', async ({ page }) => {
    await page.goto(CORPS, { waitUntil: 'domcontentloaded' });

    await page.locator('.card').first().waitFor({ state: 'visible' });
    await page.locator('.card').first().click();

    const modal = page.locator('.modal, [id="modal"]');
    await expect(modal).toBeVisible({ timeout: 3000 });

    const nameBefore = await modal.locator('h2, .modal-title, [class*="name"]').first().textContent();

    // Следующая карточка
    await page.locator('.modal-nav.next, [id="modalNext"]').click();
    await page.waitForTimeout(200);

    const nameAfter = await modal.locator('h2, .modal-title, [class*="name"]').first().textContent();
    console.log(`\n  Модалка: "${nameBefore?.trim()}" → "${nameAfter?.trim()}"`);

    expect(nameAfter).not.toBe(nameBefore);
    await expect(modal).toBeVisible();
  });

});
