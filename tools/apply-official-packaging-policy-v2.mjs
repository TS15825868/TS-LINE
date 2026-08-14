import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const extensions = new Set(['.js', '.mjs', '.cjs', '.json', '.html', '.txt']);
const activeRoots = ['.', 'assets', 'public', 'internal-social-site', 'supabase'];
const skipped = new Set(['.git', 'node_modules', '.asset-upload', 'tools', '.github', 'docs', 'deploy-status']);

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
  for (const [from, to] of replacements) output = output.split(from).join(to);
  output = output.split('30cc玻璃罐').join('30cc玻璃罐');
  if (output.includes('30cc玻璃罐') || output.includes('30cc／罐（小玻璃罐）')) {
    output = output.split('30cc每日一瓶').join('30cc每日 1-2罐');
    output = output.split('每日一瓶；180cc').join('每日 1-2罐；180cc');
    output = output.split('開罐即可飲用').join('開罐即可飲用');
    output = output.split('開瓶後請儘速飲用完畢').join('開罐後請儘速飲用完畢');
  }
  return output;
}

function normalize(value, keyHint = '') {
  if (Array.isArray(value)) return value.map((entry) => normalize(entry));
  if (!value || typeof value !== 'object') return typeof value === 'string' ? replaceText(value) : value;

  for (const [key, entry] of Object.entries(value)) value[key] = normalize(entry, key);
  const id = String(value.id ?? value.productId ?? keyHint ?? '');
  const name = String(value.name ?? value.displayName ?? value.display_name ?? '');

  if (id === 'guilu-drink-30' || (/龜鹿飲/.test(name) && /30\s*cc/i.test(name))) {
    value.name = '龜鹿飲30cc玻璃罐';
    value.specification = '30cc／罐（小玻璃罐）';
    value.unit = '罐';
    if ('displayName' in value) value.displayName = '龜鹿飲30cc玻璃罐';
    if ('display_name' in value) value.display_name = '龜鹿飲30cc玻璃罐';
    if ('size' in value) value.size = '30cc／罐（小玻璃罐）';
    if ('spec' in value) value.spec = '30cc／罐（小玻璃罐）';
    if ('priceText' in value) value.priceText = '$50 / 罐';
  }

  if (id === 'guilu-tangkuai' || name.includes('龜鹿湯塊')) {
    value.name = value.name || '龜鹿湯塊75g';
    value.specification = '75g／盒｜8塊裝｜每塊約9.375g';
    if ('size' in value) value.size = '75g／盒｜8塊裝｜每塊約9.375g';
    if ('spec' in value) value.spec = '75g／盒｜8塊裝｜每塊約9.375g';
    for (const field of ['sizes', 'variants', 'specifications']) {
      if (!Array.isArray(value[field])) continue;
      const kept = value[field].filter((entry) => !/\b(?:300|600)\s*g\b/i.test(JSON.stringify(entry)));
      value[field] = kept.length ? kept : ['75g（8入）'];
    }
  }
  return value;
}

function walk(dir, output = []) {
  if (!fs.existsSync(dir)) return output;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skipped.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, output);
    else if (extensions.has(path.extname(entry.name).toLowerCase())) output.push(full);
  }
  return output;
}

const files = [...new Set(activeRoots.flatMap((entry) => {
  if (entry !== '.') return walk(path.join(root, entry));
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((item) => item.isFile() && extensions.has(path.extname(item.name).toLowerCase()))
    .map((item) => path.join(root, item.name));
}))];

const changed = [];
for (const file of files) {
  const oldText = fs.readFileSync(file, 'utf8');
  let newText = oldText;
  if (path.extname(file).toLowerCase() === '.json') {
    try { newText = `${JSON.stringify(normalize(JSON.parse(oldText)), null, 2)}\n`; }
    catch { newText = replaceText(oldText); }
  } else {
    newText = replaceText(oldText);
  }
  if (newText !== oldText) {
    fs.writeFileSync(file, newText);
    changed.push(path.relative(root, file));
  }
}

const allText = files.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
if (allText.includes('龜鹿飲30cc玻璃罐') || allText.includes('30cc／罐（小玻璃罐）')) throw new Error('仍有龜鹿飲30cc玻璃罐舊稱');
if (/龜鹿湯塊\s*(?:300|600)\s*g/i.test(allText)) throw new Error('仍有龜鹿湯塊300g／600g舊規格');

console.log(`LINE 同步完成：${changed.length} 個檔案`);
for (const file of changed) console.log('-', file);
