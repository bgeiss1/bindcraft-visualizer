// The ranked page: the accepted designs from every captured campaign, best first, and two
// of them side by side with their structures.
import { esc, $, loadJSON, fmt } from '../site.js';
import { viewer, plddtColour } from '../view3d.js';

const COLS = [
  ['i_pDAE', 'i_pDAE'], ['i_pTM', 'i_pTM'], ['i_pAE', 'i_pAE'], ['pLDDT', 'pLDDT'],
  ['Unbound_Binder_pLDDT', 'alone pLDDT'], ['Binder_RMSD', 'binder RMSD'], ['Interface_Residues', 'interface residues']
];

export async function render(campaigns) {
  const rows = [];
  for (const [k, c] of Object.entries(campaigns)) {
    if (!c.ranked) continue;
    for (const r of await loadJSON(`${c.dir}/ranked.json`)) rows.push({ ...r, campaign: k, dir: c.dir });
  }
  rows.sort((a, b) => a.campaign.localeCompare(b.campaign) || Number(a.rank) - Number(b.rank));

  $('table').innerHTML = rows.length ? `<table class="grid small">
    <thead><tr><th>campaign</th><th>rank</th><th>design</th><th>length</th>${COLS.map(([, l]) => `<th>${l}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(r => `<tr><td>${esc(r.campaign)}</td><td class="mono">${esc(r.rank)}</td><td class="mono">${esc(r.design)}</td><td class="mono">${esc(r.length)}</td>
      ${COLS.map(([k]) => `<td class="mono">${k === 'Interface_Residues' ? esc(r[k]) : fmt(r[k])}</td>`).join('')}</tr>`).join('')}</tbody>
  </table>` : '<p class="note warn">No design in the captured campaigns passed every filter.</p>';

  if (!rows.length) { $('compare').innerHTML = ''; return; }
  const opts = sel => rows.map((r, i) => `<option value="${i}"${i === sel ? ' selected' : ''}>${esc(r.campaign)} · ${esc(r.design)}</option>`).join('');
  $('compare').innerHTML = `${rows.length < 2 ? '<p class="note">Only one design has been accepted so far, so both sides start on it. Come back when more campaigns are captured.</p>' : ''}
    <div class="work wide">${[0, 1].map(s => `<div class="panel">
      <label class="field">Design <select id="pick${s}">${opts(Math.min(s, rows.length - 1))}</select></label>
      <div class="viewer-wrap" style="min-height:320px"><div class="viewer" id="cv${s}" style="min-height:300px"></div>
        <div class="legend"><span>grey: target</span><span>binder coloured by pLDDT, blue is confident</span></div></div>
      <div id="cd${s}"></div></div>`).join('')}</div>`;

  for (const s of [0, 1]) {
    const v = await viewer($(`cv${s}`));
    const draw = async () => {
      const r = rows[+$(`pick${s}`).value];
      const res = await fetch(`${r.dir}/ranked/${r.design}.cif`);
      v.removeAllModels();
      if (res.ok) {
        const m = v.addModel(await res.text(), 'cif');
        m.setStyle({ chain: 'A' }, { cartoon: { color: '#8ea4b5', opacity: 0.8 } });
        m.setStyle({ chain: 'B' }, { cartoon: { colorfunc: a => plddtColour(a.b / 100) } });
        v.zoomTo({ chain: 'B' });
      }
      v.render();
      $(`cd${s}`).innerHTML = `<table class="grid small"><tbody>${COLS.map(([k, l]) => `<tr><th scope="row">${l}</th><td class="mono">${k === 'Interface_Residues' ? esc(r[k]) : fmt(r[k])}</td></tr>`).join('')}</tbody></table>
        <p class="small mono" style="word-break:break-all">${esc(r.Binder_Sequence)}</p>`;
    };
    $(`pick${s}`).onchange = draw;
    await draw();
  }
}
