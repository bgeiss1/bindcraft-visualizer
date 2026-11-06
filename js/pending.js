// Shown on a page whose data has not been captured yet. It names what is missing, so a
// half-built site is honest about being half-built rather than looking broken.
import { Tplain } from './site.js';

const NEEDS = {
  target: 'the prepared target structure and its per-residue solvent exposure',
  trajectory: 'one campaign\'s per-stage structures and its losses table',
  mpnn: 'the candidate sequences from a recorded attempt',
  scoring: 'a refolded candidate table and one predicted aligned error matrix',
  ranked: 'a finished campaign\'s ranked table'
};

export function pending(page) {
  for (const el of document.querySelectorAll('.page > section.card, .page > .work')) el.remove();
  const s = document.createElement('section');
  s.className = 'card';
  s.innerHTML = `<p class="note warn">${Tplain('common.notCapturedYet')}</p>
    <p class="small muted">This page needs ${NEEDS[page]}. The capture scripts in <span class="mono">workflow/</span> make it.</p>`;
  document.querySelector('.page').append(s);
}
