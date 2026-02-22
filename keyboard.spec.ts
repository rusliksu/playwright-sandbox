import { test, expect } from '@playwright/test';

const CORPS = 'https://rusliksu.github.io/tm-tierlist/output/tierlist_corporations_ru.html';

// ─── 1. Поиск ────────────────────────────────────────────────────────────────

test.describe('Keyboard — поиск', () => {

  test('keyboard.type() фильтрует карты', async ({ page }) => {
    await page.goto(CORPS, { waitUntil: 'domcontentloaded' });
    await page.locator('.card').first().waitFor({ state: 'visible' });

    const totalBefore = await page.locator('.card:not(.filtered-out)').count();

    const input = page.locator('input[type="search"], input[placeholder*="оиск"], input[placeholder*="earch"]');
    await input.focus();
    await page.keyboard.type('Luna');
    await page.waitForTimeout(300);

    const visible = await page.locator('.card:not(.filtered-out)').count();
    console.log(`\n  Поиск "Luna": ${totalBefore} → ${visible} карт`);
    expect(visible).toBeGreaterThan(0);
    expect(visible).toBeLessThan(totalBefore);
  });

  test('Ctrl+A + Delete очищает поиск', async ({ page }) => {
    await page.goto(CORPS, { waitUntil: 'domcontentloaded' });
    await page.locator('.card').first().waitFor({ state: 'visible' });

    const input = page.locator('input[type="search"], input[placeholder*="оиск"], input[placeholder*="earch"]');
    await input.focus();
    await page.keyboard.type('Luna');
    await page.waitForTimeout(300);

    const filtered = await page.locator('.card:not(.filtered-out)').count();

    await page.keyboard.press('Control+a');
    await page.keyboard.press('Delete');
    await page.waitForTimeout(300);

    const afterClear = await page.locator('.card:not(.filtered-out)').count();
    console.log(`\n  После Ctrl+A+Delete: ${filtered} → ${afterClear}`);
    expect(afterClear).toBeGreaterThan(filtered);
  });

});

// ─── 2. Модалка ───────────────────────────────────────────────────────────────

test.describe('Keyboard — модалка', () => {

  test('Escape закрывает модалку', async ({ page }) => {
    await page.goto(CORPS, { waitUntil: 'domcontentloaded' });
    await page.locator('.card').first().waitFor({ state: 'visible' });
    await page.locator('.card').first().click();

    const modal = page.locator('.modal, [id="modal"]');
    await expect(modal).toBeVisible({ timeout: 3000 });

    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible({ timeout: 3000 });
    console.log('\n  Escape закрыл модалку ✓');
  });

  test('ArrowRight → следующая карточка, ArrowLeft → предыдущая', async ({ page }) => {
    await page.goto(CORPS, { waitUntil: 'domcontentloaded' });
    await page.locator('.card').first().waitFor({ state: 'visible' });
    await page.locator('.card').first().click();

    const modal = page.locator('.modal, [id="modal"]');
    await expect(modal).toBeVisible({ timeout: 3000 });

    const title = modal.locator('h2, .modal-title, [class*="name"]').first();
    const nameBefore = await title.textContent();

    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(200);
    const nameNext = await title.textContent();
    expect(nameNext).not.toBe(nameBefore);

    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(200);
    const nameBack = await title.textContent();
    expect(nameBack).toBe(nameBefore);

    console.log(`\n  ArrowRight: "${nameBefore?.trim()}" → "${nameNext?.trim()}" → ArrowLeft назад ✓`);
  });

  test('a11y-пробел: focus trap не реализован — фокус уходит из модалки', async ({ page }) => {
    await page.goto(CORPS, { waitUntil: 'domcontentloaded' });
    await page.locator('.card').first().waitFor({ state: 'visible' });
    await page.locator('.card').first().click();

    const modal = page.locator('.modal, [id="modal"]');
    await expect(modal).toBeVisible({ timeout: 3000 });

    // Tab 6 раз — фокус уходит за пределы модалки (focus trap не реализован)
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
    }

    // Модалка остаётся открытой, но фокус уже снаружи
    await expect(modal).toBeVisible();

    const focusInsideModal = await page.evaluate(() => {
      const modal = document.querySelector<HTMLElement>('.modal, #modal');
      return modal ? modal.contains(document.activeElement) : false;
    });

    console.log(`\n  ⚠ Focus trap не реализован: фокус внутри модалки = ${focusInsideModal}`);
    // Документируем фактическое поведение: фокус выходит наружу
    expect(focusInsideModal).toBe(false);
  });

});

// ─── 3. Фильтры ───────────────────────────────────────────────────────────────

test.describe('Keyboard — фильтры', () => {

  test('Enter на кнопке сброса снимает фильтры', async ({ page }) => {
    await page.goto(CORPS, { waitUntil: 'domcontentloaded' });
    await page.locator('.card').first().waitFor({ state: 'visible' });

    await page.locator('.filter-chip.filter-tier[data-tier="S"]').click();
    await page.waitForTimeout(300);
    const filtered = await page.locator('.card:not(.filtered-out)').count();

    const resetBtn = page.locator('.reset-btn');
    await resetBtn.focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);

    const afterReset = await page.locator('.card:not(.filtered-out)').count();
    console.log(`\n  Enter на reset-btn: ${filtered} → ${afterReset}`);
    expect(afterReset).toBeGreaterThan(filtered);
  });

  test('a11y-пробел: filter-chip фокусируется, но Space не активирует', async ({ page }) => {
    await page.goto(CORPS, { waitUntil: 'domcontentloaded' });
    await page.locator('.card').first().waitFor({ state: 'visible' });

    const totalBefore = await page.locator('.card:not(.filtered-out)').count();

    // <label> без tabindex — вообще не keyboard-достижим
    const chip = page.locator('.filter-chip.filter-tier[data-tier="A"]');

    const tabindex = await chip.getAttribute('tabindex');
    console.log(`\n  ⚠ filter-chip tabindex="${tabindex}" — чип НЕ keyboard-достижим`);
    // Нет tabindex → нельзя попасть через Tab вообще
    expect(tabindex).toBeNull();

    // Space/Enter не работают — нет keydown-обработчика
    await chip.focus(); // Playwright может принудительно поставить фокус
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);
    const afterSpace = await page.locator('.card:not(.filtered-out)').count();
    console.log(`  Space не активирует чип: карт по-прежнему ${afterSpace}`);
    expect(afterSpace).toBe(totalBefore);

    // Зато click работает — только мышь/тач
    await chip.click();
    await page.waitForTimeout(300);
    const afterClick = await page.locator('.card:not(.filtered-out)').count();
    console.log(`  Click (мышь) работает: ${totalBefore} → ${afterClick}`);
    expect(afterClick).toBeLessThan(totalBefore);
  });

});
