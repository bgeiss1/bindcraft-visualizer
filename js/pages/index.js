// The overview page: the campaign funnel, the phases, and the targets we ship.
import { setup, T, Tplain, esc, $, PHASES, loadTargets, loadJSON } from '../site.js';
import { funnel } from '../funnel.js';

const PHASE_TITLES = {
  settings: 'You write the settings file',
  trajectory: 'BindCraft2 designs a binder, in five stages',
  mpnn: 'ProteinMPNN rewrites the sequence',
  refold: 'AlphaFold2 predicts each candidate again, from scratch',
  rank: 'What passed is ranked, best first'
};

function drawPhases() {
  $('phases').innerHTML = PHASES.map(p => `
    <li class="phase">
      <div class="phase-head">
        <a href="${p.page}.html">${esc(PHASE_TITLES[p.key])}</a>
      </div>
      <ul class="makes">${p.makes.map(f => `<li class="mono">${esc(f)}</li>`).join('')}</ul>
    </li>`).join('');
}

async function drawTargets() {
  const targets = await loadTargets();
  $('targets').innerHTML = Object.entries(targets).map(([key, t]) => `
    <article class="target-card${t.ready ? '' : ' pending'}">
      <h3>${esc(t.name)}</h3>
      <p class="muted">${T(t.note)}</p>
      <p class="mono small">chains ${esc(t.chains || '-')}${t.hotspots ? ` · hotspots ${esc(t.hotspots)}` : ' · no hotspots'}</p>
      ${t.ready ? `<a href="target.html?target=${encodeURIComponent(key)}">Look at it</a>` : `<p class="small muted">${Tplain('common.notCapturedYet')}</p>`}
    </article>`).join('');
}

async function drawFunnel() {
  // Real campaign counts, written by the capture scripts. Until a campaign is captured the
  // panel says so rather than showing invented numbers.
  let data = null;
  try { data = await loadJSON('data/campaigns.json'); } catch { data = null; }
  const el = $('funnel');
  if (!data || !Object.keys(data).length) {
    el.innerHTML = `<p class="small muted">${Tplain('common.notCapturedYet')}</p>`;
    return;
  }
  const first = Object.values(data)[0];
  el.innerHTML = funnel(first.funnel);
}

(async () => {
  await setup('index');
  drawPhases();
  await drawTargets();
  await drawFunnel();
})();
