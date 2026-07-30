const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const workflowDir = path.join(root, '.github', 'workflows');

if (!fs.existsSync(workflowDir)) {
  console.log('PASS：目前沒有 GitHub Actions 工作流程目錄。');
  process.exit(0);
}

const files = fs.readdirSync(workflowDir).filter((name) => /\.ya?ml$/i.test(name));
const failures = [];

for (const name of files) {
  const fullPath = path.join(workflowDir, name);
  const text = fs.readFileSync(fullPath, 'utf8');

  if (/actions\/(?:checkout|setup-node|upload-artifact|download-artifact)@v6\b/.test(text)) {
    failures.push(`${name} 使用尚未核准的 Actions v6`);
  }
  if (/至少\s*21\s*篇|posts\.length\s*<\s*21/.test(text)) {
    failures.push(`${name} 仍使用舊的 21 篇貼文門檻`);
  }
  if (/publish_before_approval\s*[:=]\s*true|approval_required\s*[:=]\s*false/i.test(text)) {
    failures.push(`${name} 允許未審核貼文發布`);
  }
  if (/龜鹿湯塊.{0,30}(?:150|300|600)\s*g/i.test(text)) {
    failures.push(`${name} 仍把舊湯塊規格當成正式規格`);
  }
}

if (failures.length) {
  throw new Error(`GitHub Actions 規則驗證失敗：\n${failures.join('\n')}`);
}

console.log(`PASS：已檢查 ${files.length} 個 GitHub Actions 工作流程；無已知紅叉設定。`);
