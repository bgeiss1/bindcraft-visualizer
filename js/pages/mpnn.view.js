// The sequence redesign page: one finished attempt's own sequence against the ProteinMPNN
// candidates drawn for it, with what happened to each candidate when it was refolded.
import { esc, $, loadJSON, fmt } from '../site.js';
import { pick, campaignSelect } from '../view3d.js';

// Residue positions (1-based) named in a BC2 list such as "D69,I72,M73".
export const positions = s => new Set(String(s ?? '').split(',').map(x => parseInt(x.replace(/^\D+/, ''))).filter(Number.isFinite));

// Positions where every candidate kept the attempt's own residue.
export function heldPositions(original, seqs) {
  const out = new Set();
  for (let i = 0; i < original.length; i++) if (seqs.every(s => s[i] === original[i])) out.add(i + 1);
  return out;
}

export async function render(campaigns) {
  const { keys, key } = pick(campaigns, 'mpnn');

  async function loadCampaign(k) {
    const c = campaigns[k];
    const designs = (await loadJSON(`${c.dir}/mpnn.json`)).filter(d => d.original && d.candidates.length);
    // Put an attempt with a passing candidate first, since that is the story worth telling.
    designs.sort((p, q) => q.candidates.filter(x => x.outcome === 'passed').length - p.candidates.filter(x => x.outcome === 'passed').length);
    $('alignment').innerHTML = `${campaignSelect(keys, k, loadCampaign)}
      <label class="field">Attempt
        <select id="design">${designs.map((d, i) => `<option value="${i}">${esc(d.design)} · ${d.candidates.filter(x => x.outcome === 'passed').length} of ${d.candidates.length} passed</option>`).join('')}</select>
      </label>
      <div id="align-body"></div>`;
    $('design').onchange = () => draw(designs[+$('design').value]);
    draw(designs[0]);
  }

  function draw(d) {
    const seqs = d.candidates.map(x => x.Binder_Sequence);
    const held = heldPositions(d.original, seqs);
    const best = d.candidates.find(x => x.outcome === 'passed') ?? d.candidates[0];
    const iface = positions(best.Interface_Binder_Residues);
    const cell = (aa, i, ref) => {
      const pos = i + 1;
      const cls = [aa !== ref[i] ? 'mut' : '', iface.has(pos) ? 'if' : '', held.has(pos) ? 'held' : ''].filter(Boolean).join(' ');
      return `<span class="${cls}" title="${pos}">${esc(aa)}</span>`;
    };
    const line = (label, seq, extra = '') => `<div class="aln-row"><span class="aln-label">${label}</span><span class="aln-seq">${[...seq].map((aa, i) => cell(aa, i, d.original)).join('')}</span>${extra}</div>`;
    $('align-body').innerHTML = `
      <div class="aln">
        ${line('designed', d.original)}
        ${d.candidates.map((x, i) => line(`MPNN ${i + 1}`, x.Binder_Sequence, `<span class="aln-out ${x.outcome === 'passed' ? 'ok' : 'bad'}">${x.outcome}</span>`)).join('')}
      </div>
      <p class="small muted">A highlighted letter differs from the designed sequence. Underlined positions touch the target in the first passing candidate. ${held.size} of ${d.original.length} positions are the same in every candidate.</p>`;

    $('candidates').innerHTML = `<table class="grid small">
      <thead><tr><th>candidate</th><th>outcome</th><th>i_pTM</th><th>i_pAE</th><th>pLDDT</th><th>binder alone pLDDT</th><th>binder RMSD</th><th>stopped by</th></tr></thead>
      <tbody>${d.candidates.map((x, i) => `<tr${x.outcome === 'passed' ? ' class="final"' : ''}>
        <td class="mono">MPNN ${i + 1}</td><td>${esc(x.outcome)}</td><td class="mono">${fmt(x.i_pTM)}</td><td class="mono">${fmt(x.i_pAE)}</td>
        <td class="mono">${fmt(x.pLDDT)}</td><td class="mono">${fmt(x.Unbound_Binder_pLDDT)}</td><td class="mono">${fmt(x.Binder_RMSD)}</td>
        <td class="small">${esc((x.failed_filters ?? '').replace(/,/g, ', ')) || '-'}</td></tr>`).join('')}</tbody>
    </table>`;
  }

  await loadCampaign(key);
}
