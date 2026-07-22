const fs = require('fs');
const path = require('path');

const root = path.join('app', '[company]', 'dashboard');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name === 'page.tsx') out.push(p);
  }
  return out;
}

const replacements = [
  ['className="container mx-auto py-4 md:py-6 px-4 md:px-6 space-y-6"', 'className="space-y-6"'],
  ['className="container mx-auto p-6 space-y-6"', 'className="space-y-6"'],
  ['className="container mx-auto p-6 max-w-4xl"', 'className="max-w-4xl space-y-6"'],
  ['className="container mx-auto p-8"', 'className="space-y-6"'],
  ['className="container mx-auto py-8"', 'className="space-y-6"'],
  ['className="container mx-auto py-6 space-y-6"', 'className="space-y-6"'],
  ['className="container mx-auto py-6"', 'className="space-y-6"'],
  ['className="container mx-auto py-10"', 'className="space-y-6"'],
  ['className="container mx-auto space-y-6"', 'className="space-y-6"'],
  ['className="container mx-auto space-y-4"', 'className="space-y-4"'],
  ['className="container mx-auto max-w-5xl space-y-6"', 'className="max-w-5xl space-y-6"'],
  ['className="container mx-auto p-4 md:p-6 max-w-5xl"', 'className="max-w-5xl space-y-6"'],
  ['className="container mx-auto"', 'className="space-y-6"'],
  ['className="flex-1 space-y-6 max-w-7xl mx-auto"', 'className="space-y-6"'],
  ['className="flex-1 space-y-6 max-w-4xl mx-auto py-6"', 'className="max-w-4xl space-y-6"'],
  ['className="flex-1 space-y-4 md:space-y-6"', 'className="space-y-6"'],
  ['className="p-6 space-y-6"', 'className="space-y-6"'],
  ['className="p-6 max-w-7xl mx-auto"', 'className="space-y-6"'],
  ['className="p-6 max-w-4xl mx-auto"', 'className="max-w-4xl space-y-6"'],
];

const files = walk(root);
let changed = 0;

for (const f of files) {
  let s = fs.readFileSync(f, 'utf8');
  const before = s;
  for (const [from, to] of replacements) {
    s = s.split(from).join(to);
  }
  s = s.replace(/<div className="p-6">/g, '<div className="space-y-6">');
  s = s.replace(/<div className="p-8">/g, '<div className="space-y-6">');
  if (s !== before) {
    fs.writeFileSync(f, s);
    changed += 1;
    console.log('updated', f);
  }
}

console.log(`changed ${changed} of ${files.length}`);
