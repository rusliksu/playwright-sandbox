# playwright-sandbox

Эксперименты с Playwright: accessibility, e2e, API intercept, performance, scraping, visual regression.

Тесты написаны для сайта [tm-tierlist](https://rusliksu.github.io/tm-tierlist) — тир-листа карт Terraforming Mars.

## Структура

| Файл | Что делает |
|------|-----------|
| `a11y.spec.ts` | WCAG 2.1 AA проверка всех страниц через axe-core |
| `api-intercept.spec.ts` | Перехват запросов, мок, passthrough, блокировка ресурсов |
| `e2e.spec.ts` | End-to-end: навигация, язык, фильтры, поиск, модалка |
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
npx playwright test e2e.spec.ts

# С UI (trace viewer)
npx playwright test --ui
```

## a11y.spec.ts

Проверяет 5 страниц на соответствие WCAG 2.1 AA с помощью [@axe-core/playwright](https://github.com/dequelabs/axe-core-npm/tree/develop/packages/playwright):

- Главная страница
- Корпорации, Прелюдии, Проекты, CEO

Блокирует на `critical` и `serious` нарушениях. Дополнительно проверяет наличие `alt` у всех `<img>` и контрастность на главной.

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

## e2e.spec.ts

End-to-end тесты пользовательских сценариев:

| Группа | Тестов | Что проверяем |
|--------|--------|---------------|
| Навигация | 2 | главная → корпорации → прелюдии → назад; все 4 страницы открываются |
| Язык | 2 | RU→EN меняет тексты; EN→RU возвращает кириллицу |
| Фильтры | 3 | фильтр по тиру; фильтр по тегу; кнопка сброса |
| Поиск | 2 | поиск по имени; поиск без результатов даёт 0 карт |
| Модалка | 3 | открытие с данными; закрытие ×; навигация prev/next |

**Нюансы реализации:**
- URL-проверка через regex: GitHub Pages может вернуть `/index.html` вместо `/`
- Тир-фильтр: `data-tier` нет на карточках (тир в JS-объекте `cardsData`), поэтому проверяем через `#tier-S .card:not(.filtered-out)` vs общий счётчик

## perf.spec.ts

Измеряет производительность через `PerformanceNavigationTiming` и `PerformanceObserver`:

| Тест | Что измеряем |
|------|-------------|
| Core Web Vitals — главная | TTFB, FCP, DOMContentLoaded, размер страницы |
| Core Web Vitals — корпорации | те же метрики для страницы с 67 картами |
| Сетевые запросы | типы ресурсов, количество, суммарный размер |
| 5 холодных загрузок | min/max/avg DOMContentLoaded |
| LCP через PerformanceObserver | Largest Contentful Paint с оценкой Good/Needs Improvement/Poor |

## scrape.spec.ts + to-csv.ts

Парсит все карточки (`.card`) с 4 страниц тир-листа, извлекает `name`, `tier`, `score`, `expansion`, `tags`.

```bash
# Спарсить в JSON
npx playwright test scrape.spec.ts

# Конвертировать в CSV
npx ts-node to-csv.ts
```

Результат: `tm-tierlist-cards.json` (684 карты), `tm-tierlist-cards-v2.csv` (открывается в Excel).

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

## Итоги

**37 тестов, все зелёные:**

| Файл | Тестов |
|------|--------|
| `a11y.spec.ts` | 7 |
| `api-intercept.spec.ts` | 5 |
| `e2e.spec.ts` | 12 |
| `perf.spec.ts` | 4 |
| `scrape.spec.ts` | 1 |
| `visual.spec.ts` | 7 |
| **Итого** | **37** |

## Стек

- [Playwright](https://playwright.dev) — браузерная автоматизация
- [@axe-core/playwright](https://github.com/dequelabs/axe-core-npm) — accessibility
- TypeScript
