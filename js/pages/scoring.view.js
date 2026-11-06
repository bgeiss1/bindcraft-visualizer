// The scoring page: per-residue pLDDT of refolded candidates, in the complex and alone,
// and the candidate filters as sliders over the campaign's real refolded table.
import { esc, $, loadJSON, fmt, FILTERS, toAngstrom } from '../site.js';
import { lineChart } from '../chart.js';
import { pick, campaignSelect, fetchText, atoms, plddtByResidue } from '../view3d.js';

// The filters that decided this campaign: BC2's merged settings mark each with a threshold,
// and a filter with an infinite threshold or mandatory=false does not gate anything.
export function activeFilters(settings) {
  const f = settings?.filters;
  if (!f) return FILTERS.map(x => ({ ...x }));
  return Object.entries(f)
    .filter(([, v]) => v.mandatory !== false && Number.isFinite(Number(v.threshold)))
    .map(([key, v]) => ({ key, threshold: Number(v.threshold), higher: !!v.higher }));
}

export function verdict(row, filters) {
  const failed = [];
  for (const f of filters) {
    const v = Number(row[f.key]);
    if (row[f.key] === '' || !Number.isFinite(v)) continue;
    if (f.higher ? v < f.threshold : v > f.threshold) failed.push(f.key);
  }
  return failed;
}

export async function render(campaigns) {
  const { keys, key } = pick(campaigns, 'scoring');

  async function loadCampaign(k) {
    const c = campaigns[k];
    const [meta, refolded, scored] = await Promise.all([
      loadJSON(`${c.dir}/campaign.json`), loadJSON(`${c.dir}/refolded.json`), loadJSON(`${c.dir}/scored.json`)
    ]);

    // pLDDT, complex against binder alone.
    $('plddt').innerHTML = `${campaignSelect(keys, k, loadCampaign)}
      <label class="field">Candidate
        <select id="cand">${scored.map((s, i) => `<option value="${i}">${esc(s.design)} · ${esc(s.outcome)}</option>`).join('')}</select>
      </label>
      <div class="charts"><div class="chart-card"><h3>Binder in the complex</h3><div id="pl-complex"></div></div>
      <div class="chart-card"><h3>Binder predicted alone</h3><div id="pl-mono"></div></div></div>
      <p class="small muted" id="pl-note"></p>`;
    const drawPlddt = async s => {
      const row = refolded.find(r => r.design === s.design) ?? {};
      for (const [el, file] of [['pl-complex', s.complex], ['pl-mono', s.monomer]]) {
        if (!file) { $(el).innerHTML = '<p class="small muted">Not captured.</p>'; continue; }
        const list = atoms(await fetchText(`${c.dir}/refolded/${file}`));
        const chain = list.some(a => a.chain === 'B') ? 'B' : list[0]?.chain;
        const p = plddtByResidue(list, chain);
        lineChart($(el), { x: p.map(r => r.resi), y: p.map(r => r.plddt), xlabel: 'binder residue', ylabel: 'pLDDT', yRange: [0, 1], hline: { y: 0.8, label: '0.8' } });
      }
      $('pl-note').textContent = `Mean pLDDT ${fmt(row.pLDDT)} in the complex, ${fmt(row.Unbound_Binder_pLDDT)} alone. i_pTM ${fmt(row.i_pTM)}, i_pAE ${fmt(row.i_pAE)} (about ${fmt(toAngstrom(Number(row.i_pAE)), 1)} angstroms).`;
    };
    $('cand').onchange = () => drawPlddt(scored[+$('cand').value]);
    await drawPlddt(scored[0]);

    // BC2 v1.0.4 does not write the error matrix to disk, so we say so rather than draw one.
    $('pae').innerHTML = '<p class="note warn">BindCraft2 does not save the error matrix itself, only the numbers it computes from it, so this campaign has no grid to show. The i_pAE and i_pDAE columns in the table below are those numbers.</p>';

    // The gates.
    const filters = activeFilters(meta.settings);
    const draw = () => {
      const rows = refolded.map(r => ({ r, failed: verdict(r, filters) }));
      const passed = rows.filter(x => !x.failed.length).length;
      const stops = {};
      rows.forEach(x => x.failed.forEach(f => { stops[f] = (stops[f] ?? 0) + 1; }));
      $('refolded').innerHTML = `<p class="note ${passed ? 'ok' : 'warn'}">${passed} of ${rows.length} candidates clear every filter at these thresholds. The campaign itself passed ${refolded.filter(r => r.outcome === 'passed').length}.</p>
        <table class="grid small"><thead><tr><th>filter</th><th>candidates it stops</th></tr></thead>
        <tbody>${filters.map(f => `<tr><td class="mono">${esc(f.key)}</td><td class="mono">${stops[f.key] ?? 0}</td></tr>`).join('')}</tbody></table>`;
    };
    $('gates').innerHTML = filters.map((f, i) => {
      const vals = refolded.map(r => Number(r[f.key])).filter(Number.isFinite);
      const lo = Math.min(f.threshold, ...vals), hi = Math.max(f.threshold, ...vals);
      const step = hi - lo > 20 ? 1 : 0.01;
      return `<div class="setting"><label for="g${i}">${esc(f.key)} ${f.higher ? 'at least' : 'at most'}</label>
        <input type="range" id="g${i}" min="${lo}" max="${hi}" step="${step}" value="${f.threshold}">
        <span class="mono" id="gv${i}">${fmt(f.threshold, step === 1 ? 0 : 2)}</span></div>`;
    }).join('');
    filters.forEach((f, i) => {
      $(`g${i}`).oninput = e => { f.threshold = Number(e.target.value); $(`gv${i}`).textContent = fmt(f.threshold, Number(e.target.step) === 1 ? 0 : 2); draw(); };
    });
    draw();
  }

  await loadCampaign(key);
}
