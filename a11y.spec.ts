import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const BASE = 'https://rusliksu.github.io/tm-tierlist';

const OUTPUT_PAGES = [
  { name: 'корпорации', file: 'tierlist_corporations_ru.html' },
  { name: 'прелюдии',   file: 'tierlist_preludes_ru.html' },
  { name: 'проекты',    file: 'tierlist_projects_ru.html' },
  { name: 'CEO',        file: 'tierlist_ceos_ru.html' },
];

test.describe('Accessibility — tm-tierlist', () => {

  test('главная — WCAG 2.1 AA', async ({ page }) => {
    await page.goto(BASE + '/');
    await page.waitForLoadState('load');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    const violations = results.violations;

    if (violations.length > 0) {
      console.log(`\n❌ Нарушений: ${violations.length}`);
      violations.forEach(v => {
        console.log(`\n  [${v.impact?.toUpperCase()}] ${v.id}: ${v.description}`);
        console.log(`  Правило: ${v.helpUrl}`);
        v.nodes.slice(0, 2).forEach(n => {
          console.log(`  Элемент: ${n.html.slice(0, 100)}`);
          console.log(`  Проблема: ${n.failureSummary?.split('\n')[0]}`);
        });
      });
    } else {
      console.log('✅ Нарушений нет!');
    }

    const critical = violations.filter(v => v.impact === 'critical');
    expect(critical, `Критические a11y нарушения: ${critical.map(v => v.id).join(', ')}`).toHaveLength(0);
  });

  for (const { name, file } of OUTPUT_PAGES) {
    test(`${name} — WCAG 2.1 AA`, async ({ page }) => {
      await page.goto(`${BASE}/output/${file}`);
      await page.waitForLoadState('load');

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();

      const violations = results.violations;

      if (violations.length === 0) {
        console.log(`\n✅ ${name} — нарушений нет`);
      } else {
        console.log(`\n❌ ${name} — нарушений: ${violations.length}`);
        violations.forEach(v => {
          console.log(`\n  [${v.impact?.toUpperCase()}] ${v.id}: ${v.description}`);
          v.nodes.slice(0, 2).forEach(n => {
            console.log(`  Элемент: ${n.html.slice(0, 100)}`);
            console.log(`  Проблема: ${n.failureSummary?.split('\n')[0]}`);
          });
        });
      }

      console.log(`  Passes: ${results.passes.length} | Incomplete: ${results.incomplete.length}`);

      const blocker = violations.filter(v => v.impact === 'critical' || v.impact === 'serious');
      expect(blocker, `Критические/серьёзные нарушения: ${blocker.map(v => v.id).join(', ')}`).toHaveLength(0);
    });
  }

  test('alt-тексты картинок — корпорации', async ({ page }) => {
    await page.goto(BASE + '/output/tierlist_corporations_ru.html');
    await page.waitForLoadState('load');

    const images = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('img')).map(img => ({
        src: img.src.split('/').pop(),
        alt: img.alt,
        hasAlt: img.hasAttribute('alt'),
      }));
    });

    const noAlt   = images.filter(i => !i.hasAlt);
    const emptyAlt = images.filter(i => i.hasAlt && i.alt === '');
    const withAlt  = images.filter(i => i.alt && i.alt.length > 0);

    console.log(`\n🖼 Картинки на странице корпораций:`);
    console.log(`  Всего: ${images.length}`);
    console.log(`  С alt-текстом: ${withAlt.length}`);
    console.log(`  Без атрибута alt: ${noAlt.length}`);
    console.log(`  Пустой alt (декоративные): ${emptyAlt.length}`);
    if (withAlt.length > 0) {
      console.log(`  Примеры alt: ${withAlt.slice(0, 3).map(i => `"${i.alt}"`).join(', ')}`);
    }

    expect(noAlt).toHaveLength(0);
  });

  test('контрастность — главная', async ({ page }) => {
    await page.goto(BASE + '/');
    await page.waitForLoadState('load');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2aa'])
      .withRules(['color-contrast'])
      .analyze();

    const contrastViolations = results.violations.filter(v => v.id === 'color-contrast');

    if (contrastViolations.length > 0) {
      console.log(`\n🎨 Проблемы контрастности:`);
      contrastViolations[0].nodes.forEach(n => {
        console.log(`  ${n.html.slice(0, 80)}`);
        console.log(`  ${n.failureSummary?.split('\n')[0]}`);
      });
    } else {
      console.log('\n✅ Контрастность в порядке!');
    }
  });

});
