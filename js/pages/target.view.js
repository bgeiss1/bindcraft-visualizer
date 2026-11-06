// The target page: the prepared structure coloured by how exposed each residue is, and a
// hotspot builder that checks each residue against the real file.
import { T, esc, $, loadJSON, loadTargets, params } from '../site.js';
import { residueNumbers } from '../settings.js';
import { viewer } from '../view3d.js';

// A fifth of the residue's surface reachable by solvent counts as exposed (target.exposure).
export const EXPOSED = 0.2;

export function checkHotspots(spec, table, firstChain) {
  const byKey = new Map(table.map(r => [`${r.chain}${r.number}`, r]));
  return residueNumbers(spec, firstChain).map(h => {
    if (h.bad) return { ...h, problem: 'not a residue' };
    const r = byKey.get(`${h.chain}${h.number}`);
    if (!r) return { ...h, problem: 'not in the file' };
    if (r.exposure !== undefined && r.exposure !== null && r.exposure < EXPOSED) return { ...h, r, problem: 'buried' };
    return { ...h, r };
  });
}

// One bar per residue, in file order, with the exposed cut-off drawn across.
function exposureBars(table) {
  const W = 300, H = 90, w = W / table.length;
  const bars = table.map((r, i) => {
    const e = r.exposure ?? 0, h = e * (H - 4);
    return `<rect x="${(i * w).toFixed(2)}" y="${(H - h).toFixed(1)}" width="${Math.max(w, 0.6).toFixed(2)}" height="${h.toFixed(1)}" fill="${e >= EXPOSED ? 'var(--accent)' : 'var(--line)'}"><title>${esc(r.chain)}${r.number} ${esc(r.name)}: ${Math.round(e * 100)}%</title></rect>`;
  }).join('');
  const y = H - EXPOSED * (H - 4);
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Exposure of each residue">${bars}
    <line class="target" x1="0" x2="${W}" y1="${y}" y2="${y}"/></svg>`;
}

export async function render(campaigns) {
  const targets = await loadTargets();
  const keys = Object.keys(campaigns).filter(k => campaigns[k].target);
  const want = params().get('target');
  const v = await viewer($('viewer'));
  $('target').innerHTML = keys.map(k => `<option value="${esc(k)}"${k === want ? ' selected' : ''}>${esc(targets[campaigns[k].target]?.name ?? k)}</option>`).join('');

  let structure = null, picked = [];

  async function load(k) {
    const c = campaigns[k];
    const t = targets[c.target] ?? {};
    structure = await loadJSON(`${c.dir}/structure.json`);
    const pdb = await (await fetch(`${c.dir}/target.pdb`)).text();
    $('target-note').innerHTML = t.note ? T(t.note) : '';
    picked = [];

    v.removeAllModels();
    const m = v.addModel(pdb, 'pdb');
    const exp = new Map(structure.table.map(r => [`${r.chain}${r.number}`, r.exposure]));
    const colour = a => {
      const e = exp.get(`${a.chain}${a.resi}`);
      return e === undefined || e === null ? '#556' : e >= EXPOSED ? '#5fd4c9' : '#3a4c5c';
    };
    m.setStyle({}, { cartoon: { colorfunc: colour } });
    v.setClickable({}, true, a => {
      const id = `${a.chain}${a.resi}`;
      picked = picked.includes(id) ? picked.filter(x => x !== id) : [...picked, id];
      $('hs').value = picked.join(',');
      check();
    });
    v.zoomTo();
    v.render();
    $('legend').innerHTML = '<span>teal: exposed</span><span>dark: buried</span><span class="drag">click a residue to add it as a hotspot</span>';

    const n = structure.table.length, exposed = structure.table.filter(r => r.exposure >= EXPOSED).length;
    $('panel').innerHTML = `<h2>${esc(t.name ?? k)}</h2>
      <table class="grid small"><tbody>
        <tr><th scope="row">chains</th><td class="mono">${esc(structure.chains.join(', '))}</td></tr>
        <tr><th scope="row">residues</th><td class="mono">${n} (${structure.table[0].number} to ${structure.table[n - 1].number})</td></tr>
        <tr><th scope="row">exposed</th><td class="mono">${exposed}</td></tr>
        <tr><th scope="row">hotspots used</th><td class="mono">${esc(t.hotspots || 'none, unguided')}</td></tr>
      </tbody></table>
      <p class="small">${T('target.exposure')}</p>
      ${exposureBars(structure.table)}`;
    check();
  }

  $('hotspot-build').innerHTML = `<label class="field">Hotspots <input type="text" id="hs" class="mono" placeholder="A54,A56" style="font:inherit;padding:6px 8px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--fg)"></label><div id="hs-out"></div>`;
  function check() {
    const spec = $('hs').value.trim();
    if (!spec) { $('hs-out').innerHTML = ''; return; }
    const res = checkHotspots(spec, structure.table, structure.chains[0]);
    const bad = res.filter(r => r.problem);
    $('hs-out').innerHTML = `<pre class="code">"hotspots": "${esc(spec)}"</pre>`
      + (bad.length
        ? `<p class="note bad">${bad.map(r => `${esc(r.bad ? r.raw : `${r.chain}${r.number}`)} is ${r.problem}`).join('. ')}.</p>`
        : `<p class="note ok">All ${res.length} residues are in the file and on the surface.</p>`)
      + (res.length && (res.length < 3 || res.length > 6) ? `<p class="note warn">${res.length} hotspots. Three to six usually works best.</p>` : '');
  }
  $('hs').addEventListener('input', () => { picked = $('hs').value.split(',').map(s => s.trim()).filter(Boolean); check(); });
  $('target').onchange = () => load($('target').value);
  await load($('target').value);
}
