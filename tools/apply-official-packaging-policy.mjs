import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const textExtensions = new Set(['.js', '.mjs', '.cjs', '.json', '.html', '.txt']);
const activeRoots = ['.', 'assets', 'public', 'internal-social-site', 'supabase'];
const skipDirs = new Set(['.git', 'node_modules', '.asset-upload', 'tools', '.github', 'docs', 'deploy-status']);

const replacements = [
  ['龜鹿飲30cc玻璃罐', '龜鹿飲30cc玻璃罐'],
  ['龜鹿飲 30cc 玻璃瓶', '龜鹿飲 30cc 玻璃罐'],
  ['30cc／罐（小玻璃罐）', '30cc／罐（小玻璃罐）'],
  ['30cc / 瓶（玻璃瓶）', '30cc／罐（小玻璃罐）'],
  ['30cc / 瓶 (玻璃瓶)', '30cc／罐（小玻璃罐）'],
  ['30cc玻璃小瓶', '30cc小玻璃罐'],
  ['30cc玻璃罐每日一瓶', '30cc玻璃罐每日 1-2罐'],
  ['30cc玻璃罐較輕巧', '30cc小玻璃罐較輕巧'],
  ['偏好小瓶即飲', '偏好小玻璃罐即飲'],
  ['$50 / 瓶', '$50 / 罐'],
];

function replaceText(input) {
  let output = String(input ?? '');
  for (const [oldValue, newValue] of replacements) output = output.split(oldValue).join(newValue);
  output = output.split('30cc玻璃罐').join('30cc玻璃罐');
  if (output.includes('30cc玻璃罐') || output.includes('30cc／罐（小玻璃罐）')) {
    output = output.split('30cc每日一瓶').join('30cc每日 1-2罐');
    output = output.split('每日一瓶；180cc').join('每日 1-2罐；180cc');
    output = output.split('開罐即可飲用').join('開罐即可飲用');
    output = output.split('開瓶後請儘速飲用完畢').join('開罐後請儘速飲用完畢');
  }
  return output;
}

function normalizeProduct(record, keyHint = '') {
  const id = String(record.id ?? record.productId ?? keyHint ?? '');
  const name = String(record.name ?? record.displayName ?? record.display_name ?? '');
  const joined = `${id} ${name}`;

  if (id === 'guilu-drink-30' || (/龜鹿飲/.test(joined) && /30\s*cc/i.test(joined))) {
    record.name = '龜鹿飲30cc玻璃罐';
    record.specification = '30cc／罐（小玻璃罐）';
    record.unit = '罐';
    if ('displayName' in record) record.displayName = '龜鹿飲30cc玻璃罐';
    if ('display_name' in record) record.display_name = '龜鹿飲30cc玻璃罐';
    if ('size' in record) record.size = '30cc／罐（小玻璃罐）';
    if ('spec' in record) record.spec = '30cc／罐（小玻璃罐）';
    if ('priceText' in record) record.priceText = '$50 / 罐';
    if (Array.isArray(record.usage)) record.usage = record.usage.map((entry) => entry === '每日一瓶' ? '每日 1-2罐' : replaceText(entry).replaceAll('開瓶', '開罐'));
    if (Array.isArray(record.storage)) record.storage = record.storage.map((entry) => replaceText(entry).replaceAll('開瓶', '開罐'));
  }

  if (id === 'guilu-tangkuai' || name.includes('龜鹿湯塊')) {
    record.name = record.name || '龜鹿湯塊75g';
    record.specification = '75g （2兩）／盒｜8塊裝｜每塊約9.375g';
    if ('size' in record) record.size = '75g （2兩）／盒｜8塊裝｜每塊約9.375g';
    if ('spec' in record) record.spec = '75g （2兩）／盒｜8塊裝｜每塊約9.375g';
    for (const field of ['sizes', 'variants', 'specifications']) {
      if (!Array.isArray(record[field])) continue;
      const kept = record[field].filter((entry) => !/\b(?:300|600)\s*g\b/i.test(JSON.stringify(entry)));
      record[field] = kept.length ? kept : ['75g（8入）'];
    }
  }
}

function normalize(value, keyHint = '') {
  if (Array.isArray(value)) return value.map((entry) => normalize(entry));
  if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) value[key] = normalize(entry, key);
    normalizeProduct(value, keyHint);
    return value;
  }
  return typeof value === 'string' ? replaceText(value) : value;
}

function walk(dir, output = []) {
  if (!fs.existsSync(dir)) return output;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skipDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, output);
    else if (textExtensions.has(path.extname(entry.name).toLowerCase())) output.push(full);
  }
  return output;
}

const files = [...new Set(activeRoots.flatMap((entry) => {
  if (entry === '.') {
    return fs.readdirSync(root, { withFileTypes: true })
      .filter((item) => item.isFile() && textExtensions.has(path.extname(item.name).toLowerCase()))
      .map((item) => path.join(root, item.name));
  }
  return walk(path.join(root, entry));
}))];

const changed = [];
for (const file of files) {
  const original = fs.readFileSync(file, 'utf8');
  let updated = original;
  if (path.extname(file).toLowerCase() === '.json') {
    try { updated = `${JSON.stringify(normalize(JSON.parse(original)), null, 2)}\n`; }
    catch { updated = replaceText(original); }
  } else {
    updated = replaceText(original);
  }
  if (updated !== original) {
    fs.writeFileSync(file, updated);
    changed.push(path.relative(root, file));
  }
}

const violations = [];
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  if (text.includes('龜鹿飲30cc玻璃罐') || text.includes('30cc／罐（小玻璃罐）')) violations.push(`${path.relative(root, file)}：仍有玻璃瓶舊稱`);
  if (/龜鹿湯塊[\s\S]{0,40}(?:300|600)\s*g|(?:300|600)\s*g[\s\S]{0,40}龜鹿湯塊/i.test(text)) violations.push(`${path.relative(root, file)}：仍有龜鹿湯塊 300g／600g 舊規格`);
}
if (violations.length) throw new Error(violations.join('\n'));

console.log(`LINE 官方包裝與規格同步完成，共更新 ${changed.length} 個檔案。`);
for (const file of changed) console.log(`- ${file}`);
