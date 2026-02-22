import { test } from '@playwright/test';
import * as fs from 'fs';

const BASE = 'https://rusliksu.github.io/tm-tierlist/output/';

const PAGES = [
  { file: 'tierlist_corporations_ru.html', category: 'Корпорации' },
  { file: 'tierlist_preludes_ru.html',     category: 'Прелюдии' },
  { file: 'tierlist_projects_ru.html',     category: 'Проектные карты' },
  { file: 'tierlist_ceos_ru.html',         category: 'CEO' },
];

test('парсим все карты tm-tierlist', async ({ page }) => {
  const allCards: any[] = [];

  for (const { file, category } of PAGES) {
    await page.goto(BASE + file);
    await page.waitForLoadState('load');

    const cards = await page.evaluate((cat) => {
      const result: any[] = [];

      // Тир-секции: каждый блок с id="tier-S", "tier-A" и т.д.
      const tierSections = document.querySelectorAll('.tier-row, [class*="tier-section"], .tier-block');

      // Альтернативный подход — берём все карточки и читаем родителя
      const cardEls = document.querySelectorAll('.card');

      cardEls.forEach(card => {
        const name = card.querySelector('[class*="card-name"], .card-title, .name')?.textContent?.trim()
          || card.getAttribute('data-name')
          || '';

        const scoreEl = card.querySelector('[class*="score"], .card-score');
        const score = scoreEl
          ? parseInt(scoreEl.textContent?.trim() || '0')
          : parseInt(card.getAttribute('data-score') || '0');

        // Тир из data-tier или из родительского элемента
        const tier = card.getAttribute('data-tier')
          || card.closest('[data-tier]')?.getAttribute('data-tier')
          || card.closest('[class*="tier-"]')?.className.match(/tier-([SABCDF])/)?.[1]
          || '';

        const expansion = card.getAttribute('data-expansion') || '';
        const tags = card.getAttribute('data-tags') || '';

        if (name) {
          result.push({ name, tier, score, expansion, tags: tags ? tags.split(',') : [], category: cat });
        }
      });

      return result;
    }, category);

    console.log(`${category}: ${cards.length} карт`);
    allCards.push(...cards);
  }

  // Сортируем: по категории, тиру, скору
  const tierOrder: Record<string, number> = { S: 0, A: 1, B: 2, C: 3, D: 4, F: 5 };
  allCards.sort((a, b) => {
    if (a.category !== b.category) return 0;
    if (a.tier !== b.tier) return (tierOrder[a.tier] ?? 9) - (tierOrder[b.tier] ?? 9);
    return b.score - a.score;
  });

  fs.writeFileSync('tm-tierlist-cards.json', JSON.stringify(allCards, null, 2), 'utf-8');

  console.log(`\nВсего карт: ${allCards.length}`);
  console.log('Файл сохранён: tm-tierlist-cards.json');

  // Статистика
  const byTier = allCards.reduce((acc, c) => {
    acc[c.tier] = (acc[c.tier] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  console.log('По тирам:', byTier);

  // Топ-5 карт
  const top5 = [...allCards].sort((a, b) => b.score - a.score).slice(0, 5);
  console.log('\nТоп-5 карт:');
  top5.forEach(c => console.log(`  ${c.tier} ${c.score} — ${c.name} (${c.category})`));
});
