# playwright-sandbox

Эксперименты с Playwright: accessibility, performance, scraping, API intercept, visual regression.

Тесты написаны для сайта [tm-tierlist](https://rusliksu.github.io/tm-tierlist) — тир-листа карт Terraforming Mars.

## Структура

| Файл | Что делает |
|------|-----------|
| `a11y.spec.ts` | WCAG 2.1 AA проверка всех страниц через axe-core |
| `api-intercept.spec.ts` | Перехват запросов, мок, passthrough, блокировка ресурсов |
| `perf.spec.ts` | Замер LCP, FCP, TTFB через Performance API |
| `scrape.spec.ts` | Парсинг карт с тир-листа → JSON |
| `visual.spec.ts` | Visual regression — 7 тестов, pixel-perfect сравнение |
| `to-csv.ts` | Конвертация JSON → CSV (UTF-8 BOM, разделитель `;`) |
| `playwright.config.ts` | Конфиг Playwright |

## Установка

```bash
npm install
npx playwright install chromium
```

## Запуск тестов

```bash
# Все тесты
npx playwright test

# Конкретный файл
npx playwright test a11y.spec.ts

# С UI (trace viewer)
npx playwright test --ui
```

## a11y.spec.ts

Проверяет 5 страниц на соответствие WCAG 2.1 AA с помощью [@axe-core/playwright](https://github.com/dequelabs/axe-core-npm/tree/develop/packages/playwright):

- Главная страница
- Корпорации, Прелюдии, Проекты, CEO

Блокирует на `critical` и `serious` нарушениях. Дополнительно проверяет наличие `alt` у всех `<img>` и контрастность на главной.

## scrape.spec.ts + to-csv.ts

Парсит все карточки (`.card`) с 4 страниц тир-листа, извлекает `name`, `tier`, `score`, `expansion`, `tags`.

```bash
# Спарсить в JSON
npx playwright test scrape.spec.ts

# Конвертировать в CSV
npx ts-node to-csv.ts
```

Результат: `tm-tierlist-cards.json` (684 карты), `tm-tierlist-cards-v2.csv` (открывается в Excel).

## api-intercept.spec.ts

Демонстрирует 5 техник работы с сетью в Playwright:

| Тест | Техника |
|------|---------|
| Логирование запросов | `page.on('response')` |
| Мок ответа | `route.fulfill()` |
| Passthrough + модификация | `route.fetch()` → patch → `route.fulfill()` |
| Блокировка ресурсов | `route.abort()` по glob-паттерну |
| Ожидание ответа | `page.waitForResponse()` |

Использует [JSONPlaceholder](https://jsonplaceholder.typicode.com) как тестовый API.

## visual.spec.ts

Pixel-perfect сравнение страниц с baseline-скриншотами через `toHaveScreenshot()`.

| Тест | Что снимаем |
|------|------------|
| главная — full page | вся страница |
| главная — хедер | элемент `.header` |
| главная — nav cards | сетка навигации |
| корпорации — desktop (1280px) | viewport |
| корпорации — mobile (390px) | viewport |
| корпорации — hover | карточка в hover-состоянии |
| корпорации — S-тир | элемент `#tier-S` |

Baseline-скриншоты хранятся в `visual.spec.ts-snapshots/`. Для страниц с большим количеством изображений используется `mask: [locator('img')]` — сравнивается только layout, не содержимое картинок.

```bash
# Обновить baseline (после намеренных изменений дизайна)
npx playwright test visual.spec.ts --update-snapshots

# Просмотреть diff в UI
npx playwright test visual.spec.ts --ui
```

## perf.spec.ts

Измеряет Web Vitals через `PerformanceNavigationTiming` и `PerformanceObserver`.

## Стек

- [Playwright](https://playwright.dev) — браузерная автоматизация
- [@axe-core/playwright](https://github.com/dequelabs/axe-core-npm) — accessibility
- TypeScript
