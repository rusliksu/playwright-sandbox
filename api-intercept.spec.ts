import { test, expect } from '@playwright/test';

const API = 'https://jsonplaceholder.typicode.com';
const TM  = 'https://rusliksu.github.io/tm-tierlist';

// ─── 1. Логирование запросов ────────────────────────────────────────────────

test('логируем все запросы страницы', async ({ page }) => {
  const requests: { method: string; url: string; status: number }[] = [];

  page.on('response', resp => {
    requests.push({
      method: resp.request().method(),
      url:    resp.url().replace(/^https?:\/\/[^/]+/, ''),
      status: resp.status(),
    });
  });

  await page.goto(TM + '/');
  await page.waitForLoadState('load');

  const byStatus = requests.reduce((acc, r) => {
    const key = String(r.status);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log(`\n📡 Запросов всего: ${requests.length}`);
  Object.entries(byStatus).sort().forEach(([s, n]) => {
    console.log(`  HTTP ${s}: ${n}`);
  });

  const ok  = requests.filter(r => r.status >= 200 && r.status < 300);
  const err = requests.filter(r => r.status >= 400);

  console.log(`  Успешных: ${ok.length}, Ошибочных: ${err.length}`);
  if (err.length > 0) err.forEach(r => console.log(`  ❌ ${r.status} ${r.url}`));

  expect(err).toHaveLength(0);
});

// ─── 2. Мок API-ответа ─────────────────────────────────────────────────────

test('мок: подменяем ответ API', async ({ page }) => {
  await page.route(`${API}/todos/1`, route => {
    route.fulfill({
      status:      200,
      contentType: 'application/json',
      body: JSON.stringify({
        userId:    42,
        id:        1,
        title:     'Сыграть партию в Terraforming Mars',
        completed: true,
      }),
    });
  });

  await page.goto(`${API}/todos/1`);

  const data = await page.evaluate(() => JSON.parse(document.body.innerText));

  console.log(`\n🎭 Мок-ответ:`);
  console.log(`  title: "${data.title}"`);
  console.log(`  userId: ${data.userId}, completed: ${data.completed}`);

  expect(data.title).toBe('Сыграть партию в Terraforming Mars');
  expect(data.userId).toBe(42);
  expect(data.completed).toBe(true);
});

// ─── 3. Passthrough + модификация ответа ────────────────────────────────────

test('passthrough: модифицируем реальный ответ', async ({ page }) => {
  await page.route(`${API}/users/1`, async route => {
    const resp = await route.fetch();
    const body = await resp.json() as Record<string, unknown>;

    // Добавляем поле
    body.rank = 'S-tier';

    route.fulfill({
      status:      resp.status(),
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });

  await page.goto(`${API}/users/1`);
  const data = await page.evaluate(() => JSON.parse(document.body.innerText));

  console.log(`\n🔧 Passthrough + patch:`);
  console.log(`  name: "${data.name}"`);
  console.log(`  email: "${data.email}"`);
  console.log(`  rank: "${data.rank}" ← добавлено нами`);

  expect(data.name).toBeTruthy();
  expect(data.rank).toBe('S-tier');
});

// ─── 4. Блокировка ресурсов ─────────────────────────────────────────────────

test('блокируем картинки — страница грузится быстрее', async ({ page }) => {
  let blocked = 0;

  await page.route('**/*.{png,jpg,jpeg,webp,gif,svg}', route => {
    blocked++;
    route.abort();
  });

  const t0 = Date.now();
  await page.goto(TM + '/output/tierlist_corporations_ru.html');
  await page.waitForLoadState('domcontentloaded');
  const loadTime = Date.now() - t0;

  console.log(`\n🚫 Заблокировано картинок: ${blocked}`);
  console.log(`  Время загрузки (без картинок): ${loadTime} мс`);

  // Страница должна рендериться без ошибок
  const title = await page.title();
  expect(title).toBeTruthy();
  expect(blocked).toBeGreaterThan(0);
});

// ─── 5. waitForResponse ─────────────────────────────────────────────────────

test('waitForResponse: перехватываем конкретный запрос', async ({ page }) => {
  const [response] = await Promise.all([
    page.waitForResponse(resp =>
      resp.url().includes('jsonplaceholder') && resp.url().includes('/posts')
    ),
    page.goto(`${API}/posts`),
  ]);

  const status = response.status();
  const posts  = await response.json() as unknown[];

  console.log(`\n⏳ waitForResponse перехватил:`);
  console.log(`  URL: ${response.url()}`);
  console.log(`  Status: ${status}`);
  console.log(`  Постов в ответе: ${posts.length}`);
  console.log(`  Первый пост: "${(posts[0] as any).title}"`);

  expect(status).toBe(200);
  expect(posts.length).toBeGreaterThan(0);
});
