// The process page: the campaign as one drawing, then the five design stages with their
// step counts and confidence floors, then what each phase leaves on disk.
import { setup, T, esc, $, STAGES, PHASES } from '../site.js';

const STAGE_TEXT = { screen: 'process.screen', refine: 'process.refine', anneal: 'process.anneal', harden: 'process.harden', mutate: 'process.mutate' };

// The whole loop, drawn left to right, with the three checks that can end an attempt.
function pipeline() {
  const boxes = [
    { x: 0, label: 'settings.json', sub: 'what you decide', page: 'settings' },
    { x: 1, label: 'design stages', sub: 'five, with a check after each', page: 'trajectory' },
    { x: 2, label: 'ProteinMPNN', sub: 'new sequences for that shape', page: 'mpnn' },
    { x: 3, label: 'AlphaFold2 again', sub: 'held-back models, then filters', page: 'scoring' },
    { x: 4, label: 'ranked designs', sub: 'best first by i_pDAE', page: 'ranked' }
  ];
  const W = 1000, H = 215, bw = 168, bh = 66, gap = (W - bw * 5) / 4, y = 40;
  let svg = '';
  for (const b of boxes) {
    const x = b.x * (bw + gap);
    svg += `<a href="${b.page}.html">
      <rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="8" class="pl-box"/>
      <text x="${x + bw / 2}" y="${y + 26}" class="pl-t">${esc(b.label)}</text>
      <text x="${x + bw / 2}" y="${y + 46}" class="pl-s">${esc(b.sub)}</text>
    </a>`;
    if (b.x < 4) {
      const ax = x + bw, ax2 = x + bw + gap;
      svg += `<line x1="${ax + 4}" y1="${y + bh / 2}" x2="${ax2 - 10}" y2="${y + bh / 2}" class="pl-arrow"/>
        <polygon points="${ax2 - 10},${y + bh / 2 - 4} ${ax2 - 2},${y + bh / 2} ${ax2 - 10},${y + bh / 2 + 4}" class="pl-head"/>`;
    }
  }
  // Attempts that fail drop out downward, and the campaign starts another one.
  const dropX = [bw / 2 + (bw + gap), bw / 2 + 3 * (bw + gap)];
  for (const dx of dropX) {
    svg += `<line x1="${dx}" y1="${y + bh}" x2="${dx}" y2="${y + bh + 34}" class="pl-drop"/>
      <text x="${dx + 8}" y="${y + bh + 32}" class="pl-s drop">dropped</text>`;
  }
  // Both drops feed back into the design stages: the campaign simply starts another attempt.
  const design = bw / 2 + (bw + gap), last = dropX[1], lane = y + bh + 52;
  svg += `<line x1="${last}" y1="${y + bh + 34}" x2="${last}" y2="${lane}" class="pl-drop"/>
    <line x1="${last}" y1="${lane}" x2="${design + 10}" y2="${lane}" class="pl-drop"/>
    <line x1="${design}" y1="${lane}" x2="${design}" y2="${y + bh + 34}" class="pl-drop"/>
    <polygon points="${design + 10},${lane - 4} ${design + 2},${lane} ${design + 10},${lane + 4}" class="pl-dhead"/>
    <text x="${design + 20}" y="${lane + 15}" class="pl-s drop">the campaign starts another attempt</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" class="pipeline" role="img" aria-label="A campaign: settings, design stages, ProteinMPNN, AlphaFold2 again, ranked designs. Attempts can be dropped at the design stages and at the filters.">${svg}</svg>`;
}

function stages() {
  const total = STAGES.filter(s => s.steps).reduce((a, s) => a + s.steps, 0);
  const rows = STAGES.filter(s => s.steps).map(s => `
    <tr>
      <th scope="row" class="mono">${esc(s.key)}</th>
      <td class="mono">${s.steps}</td>
      <td class="mono">${s.plddt}</td>
      <td class="mono">${s.iptm ?? '-'}</td>
      <td>${T(STAGE_TEXT[s.key]).replace(/^[a-z_]+:\s*/, '')}</td>
    </tr>`).join('');
  const final = STAGES.find(s => s.key === 'final');
  return `<table class="grid">
    <thead><tr><th>stage</th><th>steps</th><th>pLDDT floor</th><th>i_pTM floor</th><th>what it does</th></tr></thead>
    <tbody>${rows}
      <tr class="final"><th scope="row" class="mono">final</th><td class="mono">-</td><td class="mono">${final.plddt}</td><td class="mono">${final.iptm}</td><td>The last check before the sequence is redesigned.</td></tr>
    </tbody>
    <caption>${total} optimisation steps in all, at BindCraft2's defaults. A campaign with autotune on adjusts the screen and refine lengths as it learns the target.</caption>
  </table>`;
}

function outputs() {
  return `<ul class="makes-list">${PHASES.map(p => `
    <li><b>${esc(p.key)}</b><ul class="makes">${p.makes.map(f => `<li class="mono">${esc(f)}</li>`).join('')}</ul></li>`).join('')}</ul>`;
}

(async () => {
  await setup('process');
  $('pipeline').innerHTML = pipeline()
    + `<div class="steps-text">
        <p data-t="process.stage1"></p><p data-t="process.stage2"></p>
        <p data-t="process.stage3"></p><p data-t="process.stage4"></p>
      </div>`;
  // The four paragraphs were inserted after setup ran, so fill them in now.
  for (const el of document.querySelectorAll('.steps-text [data-t]')) el.innerHTML = T(el.dataset.t);
  $('stages').innerHTML = stages();
  $('outputs').innerHTML = outputs();
})();
