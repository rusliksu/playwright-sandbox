import * as fs from 'fs';

const cards = JSON.parse(fs.readFileSync('tm-tierlist-cards.json', 'utf-8'));

const sep = ';';
const header = ['name', 'tier', 'score', 'expansion', 'tags', 'category'].join(sep);
const rows = cards.map((c: any) => [
  `"${c.name.replace(/"/g, '""')}"`,
  c.tier,
  c.score,
  `"${c.expansion}"`,
  `"${c.tags.join('|')}"`,
  `"${c.category}"`,
].join(sep));

const csv = [header, ...rows].join('\n');
// UTF-8 BOM — Excel нужен для корректного чтения кириллицы
const BOM = '\uFEFF';
fs.writeFileSync('tm-tierlist-cards-v2.csv', BOM + csv, 'utf-8');
console.log(`Экспортировано ${cards.length} карт → tm-tierlist-cards.csv`);
