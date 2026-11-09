// Shared by every page: the BindCraft2 pipeline, the header, data loading, and the
// command line + terminal + notes that each page uses.
//
// Same shape as the GROMACS visualizer's js/site.js, so the two sites behave alike.

export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
export const $ = id => document.getElementById(id);

// One page per part of a campaign, in the order a student meets them.
export const PAGES = [
  { page: 'process', title: 'How a campaign works' },
  { page: 'target', title: 'Pick the target and the epitope' },
  { page: 'settings', title: 'Write the settings file' },
  { page: 'run', title: 'Run it' },
  { page: 'trajectory', title: 'Watch a trajectory' },
  { page: 'mpnn', title: 'Redesign the sequence' },
  { page: 'scoring', title: 'Read the scores' },
  { page: 'ranked', title: 'Choose what to make' }
];

// The five gradient-design stages, in order, with their default step counts and the
// filters BC2 checks at the end of each. Defaults are from settings/core/default.json
// (BC2 v1.0.4); a recorded run's real values come from its campaign_metadata.json.
export const STAGES = [
  { key: 'screen', steps: 50, plddt: 0.6, iptm: null },
  { key: 'refine', steps: 25, plddt: 0.6, iptm: null },
  { key: 'anneal', steps: 45, plddt: 0.65, iptm: 0.5 },
  { key: 'harden', steps: 5, plddt: 0.65, iptm: 0.5 },
  { key: 'mutate', steps: 15, plddt: 0.6, iptm: 0.5 },
  { key: 'final', steps: 0, plddt: 0.7, iptm: 0.7 }
];

// The whole campaign as the site tells it. Each phase links to the page that teaches it.
export const PHASES = [
  { key: 'settings', page: 'settings', makes: ['campaign_metadata.json'] },
  { key: 'trajectory', page: 'trajectory', makes: ['1_Trajectories/!_Trajectories.csv', '1_Trajectories/<design>_losses.csv', '1_Trajectories/<design>_trajectory.cif'] },
  { key: 'mpnn', page: 'mpnn', makes: ['.redesigned_sequences.txt'] },
  { key: 'refold', page: 'scoring', makes: ['2_Refolded/!_Refolded.csv', '2_Refolded/Complexes/', '2_Refolded/BinderMonomer/'] },
  { key: 'rank', page: 'ranked', makes: ['3_Ranked/!_Ranked.csv', 'summary.csv'] }
];

// The candidate filters, with BC2's core defaults. `higher` means a bigger number is better.
// The site reads the real thresholds out of each recorded run and falls back to these.
export const FILTERS = [
  { key: 'Unbound_Binder_pLDDT', threshold: 0.8, higher: true },
  { key: 'pTM', threshold: 0.55, higher: true },
  { key: 'i_pTM', threshold: 0.7, higher: true },
  { key: 'i_pAE', threshold: 0.35, higher: false },
  { key: 'Interface_Residues', threshold: 7, higher: true },
  { key: 'Backbone_Clashes', threshold: 0, higher: false },
  { key: 'Binder_RMSD', threshold: 3.5, higher: false }
];

// i_pAE is a mean interface PAE divided by this, so the site can show angstroms too.
export const PAE_SCALE = 31;
export const toAngstrom = ipae => ipae * PAE_SCALE;

// Page text lives in data/text.json so it can be edited from the dashboard (admin.html).
// Keys are flat ("target.intro"); {name} placeholders are filled from vars.
let TEXT = {};
const SHOW_KEYS = typeof location !== 'undefined' && new URLSearchParams(location.search).has('showtext');
export async function loadText() {
  try { TEXT = await (await fetch('data/text.json', { cache: 'no-store' })).json(); } catch { TEXT = {}; }
  if (SHOW_KEYS) document.documentElement.classList.add('showtext');
}
export function T(key, vars = {}) {
  const v = TEXT[key];
  if (typeof v !== 'string') return `<span class="t-missing">[${esc(key)}]</span>`;
  const out = v.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  return SHOW_KEYS ? `<span class="tk" title="${esc(key)}">${out}</span>` : out;
}
export const Tplain = (key, vars) => { const d = document.createElement('div'); d.innerHTML = T(key, vars); return d.textContent; };
// For text that is optional, like a hover description that may not have been written yet.
export const hasText = key => typeof TEXT[key] === 'string' && TEXT[key].trim() !== '';
export function applyText(root = document) {
  for (const el of root.querySelectorAll('[data-t]')) {
    el.innerHTML = T(el.dataset.t);
    if (SHOW_KEYS) el.title = el.dataset.t;
  }
}

// Every page starts with this: load the text, draw the header, fill in the static text.
export async function setup(active) {
  await loadText();
  header(active);
  applyText();
}

export function header(active) {
  const el = document.createElement('header');
  el.className = 'top';
  el.innerHTML = `
    <a class="brand" href="index.html">
      <span class="brand-name">${T('common.brand')}</span>
      <span class="brand-sub">${T('common.brandSub')}</span>
    </a>
    <nav class="tools" aria-label="Campaign steps">
      <a class="tool${active === 'index' ? ' on' : ''}" href="index.html">${T('common.navOverview')}</a>
      ${PAGES.map(p => `<a class="tool${p.page === active ? ' on' : ''}" href="${p.page}.html" title="${esc(Tplain('nav.' + p.page))}"${p.page === active ? ' aria-current="page"' : ''}>${p.page}</a>`).join('')}
    </nav>`;
  document.body.prepend(el);
}

export async function loadTargets() {
  return (await fetch('data/targets.json', { cache: 'no-store' })).json();
}
export async function loadJSON(path) {
  const r = await fetch(path, { cache: 'no-store' });
  if (!r.ok) throw new Error(`Could not load ${path}`);
  return r.json();
}
export async function text(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`Could not load ${path}`);
  return r.text();
}
export const params = () => new URLSearchParams(location.search);

// ---------------------------------------------------------------------------
// The terminal. Nothing shows until the student presses Run (Brian, 2026-10-29),
// so hasRun() gates every page's output the same way the GROMACS site does.
// ---------------------------------------------------------------------------
let ran = false;
export const hasRun = () => ran;
export const markRun = () => { ran = true; };
export function resetRun() { ran = false; }

export function term(el, lines, { prompt = '(bc2) $', cmd = '' } = {}) {
  const body = Array.isArray(lines) ? lines.join('\n') : String(lines ?? '');
  el.innerHTML = `<pre class="term"><span class="term-cmd">${esc(prompt)} ${esc(cmd)}</span>${body ? '\n' + esc(body) : ''}</pre>`;
}

// A coach note under a panel: kind is 'note', 'warn' or 'bad'.
export function note(kind, html) {
  return `<p class="note ${kind}">${html}</p>`;
}

// ---------------------------------------------------------------------------
// Small helpers the pages share
// ---------------------------------------------------------------------------

// BC2 writes per-residue pLDDT into the B-factor column on a 0-100 scale.
// The analysis tables use 0-1. Keep one place that knows that.
export const bfactorToPlddt = b => b / 100;

export const fmt = (v, digits = 2) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? '-' : Number(v).toFixed(digits));

// Does a candidate pass one filter? Returns true, false, or null when the metric is absent.
export function passes(row, filter) {
  const v = Number(row[filter.key]);
  if (!Number.isFinite(v)) return null;
  return filter.higher ? v >= filter.threshold : v <= filter.threshold;
}

// Parse a BC2 CSV (plain comma-separated, no embedded commas in BC2's own output).
export function parseCSV(s) {
  const rows = s.replace(/\r/g, '').split('\n').filter(l => l.trim());
  if (!rows.length) return { columns: [], rows: [] };
  const columns = rows[0].split(',').map(c => c.trim());
  return {
    columns,
    rows: rows.slice(1).map(line => {
      const cells = line.split(',');
      return Object.fromEntries(columns.map((c, i) => [c, (cells[i] ?? '').trim()]));
    })
  };
}
