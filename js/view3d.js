// Shared by the data-driven pages: loading 3Dmol, picking a campaign, and reading the
// structures BindCraft2 writes. Every number shown comes from a captured campaign.
/* global $3Dmol */
import { esc, params } from './site.js';

let loading = null;
export function load3Dmol() {
  if (typeof $3Dmol !== 'undefined') return Promise.resolve();
  loading ??= new Promise((ok, bad) => {
    const s = document.createElement('script');
    s.src = 'vendor/3Dmol-min.js';
    s.onload = ok;
    s.onerror = () => bad(new Error('Could not load vendor/3Dmol-min.js'));
    document.head.append(s);
  });
  return loading;
}

export async function viewer(el) {
  await load3Dmol();
  return $3Dmol.createViewer(el, { backgroundColor: '#0b1520', antialias: true });
}

// The campaigns that have a given part captured, and the one the URL asks for.
export function pick(campaigns, part) {
  const keys = Object.keys(campaigns).filter(k => campaigns[k][part]);
  const want = params().get('campaign');
  return { keys, key: keys.includes(want) ? want : keys[0] };
}

export function campaignSelect(keys, key, onChange) {
  if (keys.length < 2) return '';
  const id = 'campaign-pick';
  setTimeout(() => document.getElementById(id)?.addEventListener('change', e => onChange(e.target.value)));
  return `<label class="field">Campaign
    <select id="${id}">${keys.map(k => `<option value="${esc(k)}"${k === key ? ' selected' : ''}>${esc(k)}</option>`).join('')}</select>
  </label>`;
}

export async function fetchText(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`Could not load ${path}`);
  return r.text();
}

// Atoms from a BC2 mmCIF (or PDB) file: chain, residue number, residue name, atom name,
// B-factor and coordinates. Only what the pages need.
export function atoms(text) {
  const out = [];
  if (/^ATOM  /m.test(text) && !/_atom_site\./.test(text)) {
    for (const l of text.split('\n')) {
      if (!l.startsWith('ATOM')) continue;
      out.push({ chain: l[21], resi: parseInt(l.slice(22, 26)), resn: l.slice(17, 20).trim(), atom: l.slice(12, 16).trim(),
        b: parseFloat(l.slice(60, 66)), x: parseFloat(l.slice(30, 38)), y: parseFloat(l.slice(38, 46)), z: parseFloat(l.slice(46, 54)) });
    }
    return out;
  }
  const cols = [];
  for (const l of text.split('\n')) {
    if (l.startsWith('_atom_site.')) { cols.push(l.trim().slice(11)); continue; }
    if (!l.startsWith('ATOM') || !cols.length) continue;
    const f = l.trim().split(/\s+/);
    const c = k => f[cols.indexOf(k)];
    out.push({ chain: c('auth_asym_id'), resi: parseInt(c('auth_seq_id')), resn: c('label_comp_id'), atom: c('label_atom_id'),
      b: parseFloat(c('B_iso_or_equiv')), x: parseFloat(c('Cartn_x')), y: parseFloat(c('Cartn_y')), z: parseFloat(c('Cartn_z')) });
  }
  return out;
}

// Per-residue pLDDT (0 to 1) for one chain, read from the CA B-factors.
export function plddtByResidue(list, chain) {
  return list.filter(a => a.atom === 'CA' && (!chain || a.chain === chain)).map(a => ({ resi: a.resi, chain: a.chain, plddt: a.b / 100 }));
}

// Which residue pairs, one from each chain, have any heavy atoms within cutoff angstroms.
export function contacts(list, a = 'A', b = 'B', cutoff = 4) {
  const A = list.filter(x => x.chain === a), B = list.filter(x => x.chain === b);
  const c2 = cutoff * cutoff, cell = cutoff, grid = new Map();
  const key = (x, y, z) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
  for (const t of A) {
    const k = key(t.x, t.y, t.z);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(t);
  }
  const pairs = new Set();
  for (const s of B) {
    const gx = Math.floor(s.x / cell), gy = Math.floor(s.y / cell), gz = Math.floor(s.z / cell);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      for (const t of grid.get(`${gx + dx},${gy + dy},${gz + dz}`) ?? []) {
        if ((t.x - s.x) ** 2 + (t.y - s.y) ** 2 + (t.z - s.z) ** 2 < c2) pairs.add(`${s.resi}:${t.resi}`);
      }
    }
  }
  return [...pairs].map(p => p.split(':').map(Number));
}

// The colour BC2-style viewers use for pLDDT: blue confident, orange not.
export function plddtColour(p) {
  if (p >= 0.9) return '#2a6fdb';
  if (p >= 0.7) return '#6cc3f0';
  if (p >= 0.5) return '#f2d24b';
  return '#f08a3c';
}

export const num = v => (v === '' || v === undefined || v === null ? null : Number(v));
