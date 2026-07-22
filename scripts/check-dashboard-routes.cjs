const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

function walkPages(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkPages(p, out);
    else if (e.name === 'page.tsx' || e.name === 'page.ts' || e.name === 'page.jsx') {
      out.push(p.replace(/\\/g, '/'));
    }
  }
  return out;
}

function walkSource(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.next' || e.name === 'dist') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkSource(p, out);
    else if (/\.(tsx|ts|jsx|js)$/.test(e.name)) out.push(p);
  }
  return out;
}

/** Map app file path → route pattern */
function fileToRoute(file) {
  let rel = file.replace(/\\/g, '/');
  const idx = rel.indexOf('/app/');
  if (idx === -1) return null;
  rel = rel.slice(idx + '/app/'.length);
  rel = rel.replace(/\/page\.(tsx|ts|jsx|js)$/, '');
  if (!rel || rel === 'page') return '/';
  const parts = rel.split('/').map((seg) => {
    if (seg.startsWith('[') && seg.endsWith(']')) return ':param';
    if (seg.startsWith('(') && seg.endsWith(')')) return null; // route groups
    return seg;
  }).filter(Boolean);
  return '/' + parts.join('/');
}

function routesFromPages() {
  const pages = walkPages(path.join(ROOT, 'app'));
  const set = new Set();
  for (const f of pages) {
    const r = fileToRoute(f);
    if (r) set.add(r);
  }
  return set;
}

function normalizeHref(href) {
  if (!href || typeof href !== 'string') return null;
  let h = href.trim();
  if (!h.startsWith('/')) return null;
  if (h.startsWith('//') || h.startsWith('http')) return null;
  if (h.startsWith('mailto:') || h.startsWith('tel:') || h.startsWith('#')) return null;
  // Drop query/hash
  h = h.split('?')[0].split('#')[0];
  // Template literals → :param
  h = h.replace(/\$\{[^}]+\}/g, ':param');
  // Collapse double slashes
  h = h.replace(/\/+/g, '/');
  if (h.length > 1 && h.endsWith('/')) h = h.slice(0, -1);
  return h || '/';
}

/** Company-prefixed: /{slug}/dashboard/... → /[company]/dashboard/... pattern */
function toPattern(href) {
  const h = normalizeHref(href);
  if (!h) return null;

  // Already using :param
  let p = h;

  // /something/dashboard/... where something isn't a known top-level
  const top = ['admin', 'portal', 'pricing', 'start', 'login', 'register', 'api', 'auth', 'employee'];
  const segs = p.split('/').filter(Boolean);
  if (segs.length >= 2 && !top.includes(segs[0]) && segs[1] === 'dashboard') {
    // /{companySlug}/dashboard/...
    p = '/[company]/' + segs.slice(1).join('/');
  } else if (segs.length >= 2 && !top.includes(segs[0]) && segs[1] === 'employee') {
    p = '/[company]/' + segs.slice(1).join('/');
  } else if (segs.length >= 2 && !top.includes(segs[0]) && segs[1] === 'admin') {
    p = '/[company]/' + segs.slice(1).join('/');
  } else if (segs[0] === 'dashboard' || (segs[0] === 'employee' && segs[1])) {
    // relative workspace paths used in sidebar: /dashboard/...
    p = '/[company]/' + segs.join('/');
  }

  // Convert [company] literal and :param for matching
  p = p.replace(/\[company\]/g, ':param');
  p = p.replace(/\$\{[^}]+\}/g, ':param');

  return p;
}

function routeExists(pattern, routeSet) {
  if (!pattern) return true;
  // Exact
  if (routeSet.has(pattern)) return true;
  // Compare segment-wise with :param wildcards
  const want = pattern.split('/').filter(Boolean);
  for (const r of routeSet) {
    const have = r.split('/').filter(Boolean);
    if (have.length !== want.length) continue;
    let ok = true;
    for (let i = 0; i < want.length; i++) {
      if (want[i] === ':param' || have[i] === ':param') continue;
      if (want[i] !== have[i]) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

const routeSet = routesFromPages();

const linkPatterns = [
  /(?:href|actionHref)\s*[:=]\s*['"`]([^'"`]+)['"`]/g,
  /(?:href|actionHref)\s*[:=]\s*`([^`]+)`/g,
  /path\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
  /path\(\s*`([^`]+)`\s*\)/g,
  /employeePath\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
  /employeePath\(\s*`([^`]+)`\s*\)/g,
  /getCompanyUrl\(\s*['"`]([^'"`]+)['"`]/g,
  /router\.push\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
  /router\.push\(\s*`([^`]+)`\s*\)/g,
  /router\.push\(\s*path\(\s*`([^`]+)`\s*\)\s*\)/g,
  /router\.push\(\s*path\(\s*['"`]([^'"`]+)['"`]\s*\)\s*\)/g,
];

const files = [
  ...walkSource(path.join(ROOT, 'app')),
  ...walkSource(path.join(ROOT, 'components')),
];

const dead = [];
const ok = [];
const seen = new Set();

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  for (const re of linkPatterns) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) {
      const raw = m[1];
      if (!raw || raw.includes('${') && !raw.startsWith('/')) {
        // skip relative template junk
      }
      if (!raw.startsWith('/') && !raw.startsWith('/dashboard') && !raw.includes('dashboard') && !raw.startsWith('dashboard')) {
        if (!raw.startsWith('/')) continue;
      }
      if (!raw.startsWith('/')) continue;
      // skip api
      if (raw.startsWith('/api')) continue;
      const key = `${rel}::${raw}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const pattern = toPattern(raw);
      if (!pattern) continue;
      // skip marketing/auth pages we may not care about if missing check differently
      if (routeExists(pattern, routeSet)) {
        ok.push({ file: rel, raw, pattern });
      } else {
        dead.push({ file: rel, raw, pattern });
      }
    }
  }
}

// Also verify every sidebar href
const sidebar = fs.readFileSync(path.join(ROOT, 'components/layout/sidebar.tsx'), 'utf8');
const sidebarHrefs = [...sidebar.matchAll(/href:\s*['"`]([^'"`]+)['"`]/g)].map((m) => m[1]);
const sidebarDead = [];
for (const h of sidebarHrefs) {
  if (h.startsWith('http') || h.includes('getCompanyUrl')) continue;
  const pattern = toPattern(h);
  if (!routeExists(pattern, routeSet)) sidebarDead.push({ raw: h, pattern });
}

console.log('App page routes:', routeSet.size);
console.log('Link occurrences checked:', ok.length + dead.length);
console.log('OK:', ok.length);
console.log('DEAD:', dead.length);
if (dead.length) {
  console.log('\nDead links:');
  for (const d of dead.slice(0, 80)) {
    console.log(`  ${d.file}`);
    console.log(`    href: ${d.raw}`);
    console.log(`    pattern: ${d.pattern}`);
  }
  if (dead.length > 80) console.log(`  ... and ${dead.length - 80} more`);
}

console.log('\nSidebar static hrefs:', sidebarHrefs.length);
console.log('Sidebar dead:', sidebarDead.length ? sidebarDead : '(none)');

// Orphan pages (exist but never linked from components/app) — informational
const linkedPatterns = new Set(ok.map((o) => o.pattern));
const orphans = [];
for (const r of [...routeSet].sort()) {
  if (!r.includes('/dashboard/')) continue;
  if (r.endsWith('/dashboard') || r === '/:param/dashboard') continue;
  let linked = false;
  for (const lp of linkedPatterns) {
    if (routeExists(lp, new Set([r])) || routeExists(r, new Set([lp]))) {
      linked = true;
      break;
    }
  }
  // also check if any link pattern matches this route
  for (const o of ok) {
    if (routeExists(o.pattern, new Set([r]))) {
      linked = true;
      break;
    }
  }
  if (!linked) orphans.push(r);
}

console.log('\nPossibly unlinked dashboard routes (orphan):', orphans.length);
for (const o of orphans.slice(0, 40)) console.log('  ', o);
if (orphans.length > 40) console.log(`  ... and ${orphans.length - 40} more`);
