// The trajectory page, drawn from one captured campaign: the per-stage structures as a
// player, the losses table as curves under a shared cursor, and the contact grid.
import { T, esc, $, loadJSON, fmt } from '../site.js';
import { lineChart } from '../chart.js';
import { viewer, pick, campaignSelect, fetchText, atoms, contacts } from '../view3d.js';

// The loss columns worth plotting, with what to call them. BC2 prefixes each with the target.
const CURVES = [
  { key: 'iptm', label: 'i_pTM' },
  { key: 'plddt_loss', label: 'pLDDT loss' },
  { key: 'interface_pae', label: 'interface pAE' },
  { key: 'interface_contacts', label: 'interface contacts loss' }
];

// "=== trajectory 5 | design_x | ..." blocks in the screen log, one per attempt.
export function stageLines(log, design) {
  const out = [];
  let inside = false;
  for (const l of log.split('\n')) {
    if (l.startsWith('=== trajectory')) { inside = l.includes(`| ${design} |`); continue; }
    if (!inside) continue;
    const m = l.match(/(passed|rejected at) (\w+) design stage\s+i_pTM=([\d.]+)\s+pLDDT=([\d.]+)(?:\s+due to \[([^\]]*)\])?/);
    if (m) out.push({ passed: m[1] === 'passed', stage: m[2], iptm: +m[3], plddt: +m[4], why: m[5] ? m[5].split(/,\s*/) : [] });
  }
  return out;
}

const frameKey = name => {
  const m = name.match(/_(screen|refine|anneal|harden|mutate|final)_(\d+)_/);
  return m ? `${m[1]}:${+m[2]}` : null;
};

export async function render(campaigns) {
  const { keys, key } = pick(campaigns, 'trajectory');
  let c = campaigns[key];
  const v = await viewer($('viewer'));
  let state = null, timer = null;

  async function loadCampaign(k) {
    c = campaigns[k];
    const meta = await loadJSON(`${c.dir}/campaign.json`);
    let log = '';
    try { log = await fetchText(`${c.dir}/run.log`); } catch { log = ''; }
    const attempts = meta.attempts_exported.filter(a => a.frames.length);
    $('traj').innerHTML = attempts.map((a, i) => `<option value="${i}">${esc(a.design)} · ${a.stage_ended ? `dropped at ${esc(a.stage_ended)}` : 'passed every stage'}</option>`).join('');
    $('traj').onchange = () => loadAttempt(attempts[+$('traj').value], meta.settings, log);
    $('traj').closest('.card').querySelector('#campaign-pick')?.remove();
    $('traj').closest('label').insertAdjacentHTML('beforebegin', campaignSelect(keys, k, loadCampaign));
    await loadAttempt(attempts[0], meta.settings, log);
  }

  async function loadAttempt(a, settings, log) {
    clearInterval(timer); timer = null;
    const losses = a.has_losses ? await loadJSON(`${c.dir}/losses/${a.design}.json`) : [];
    const row = Object.fromEntries(losses.map((r, i) => [`${r.phase}:${+r.round}`, i]));
    state = { a, losses, row, i: 0, cache: new Map() };

    // Why it stopped, from the screen log and the campaign's own floors.
    const lines = stageLines(log, a.design);
    const last = lines[lines.length - 1];
    if (!a.stage_ended) {
      $('traj-note').innerHTML = T('trajectory.survived');
    } else if (last && !last.passed && last.why.length) {
      const metric = last.why[0];
      const value = metric === 'i_pTM' ? last.iptm : last.plddt;
      const floor = settings[`min_${metric === 'i_pTM' ? 'iptm' : 'plddt'}_${last.stage}`];
      $('traj-note').innerHTML = T('trajectory.killed', { stage: esc(last.stage), metric: esc(metric), value: fmt(value), floor: fmt(floor) });
    } else {
      $('traj-note').textContent = `This attempt was dropped at the ${a.stage_ended} stage.`;
    }

    // The curves, one chart per loss, all sharing the frame cursor.
    const prefix = Object.keys(losses[0] ?? {}).find(k => k.endsWith('.iptm'))?.replace(/iptm$/, '') ?? '';
    const x = losses.map((_, i) => i + 1);
    $('curves').innerHTML = losses.length
      ? `<h2>Losses</h2>${CURVES.filter(cv => (prefix + cv.key) in losses[0]).map(cv => `<div class="chart-card"><h3>${cv.label}</h3><div data-curve="${cv.key}"></div></div>`).join('')}
         ${a.has_plot ? `<p class="small"><a href="${c.dir}/plots/${esc(a.design)}_losses.png" target="_blank" rel="noopener">BindCraft2's own loss plot</a></p>` : ''}`
      : `<p class="small muted">The losses table for this attempt was not captured.</p>`;
    state.charts = [...$('curves').querySelectorAll('[data-curve]')].map(el => lineChart(el, {
      x, y: losses.map(r => Number(r[prefix + el.dataset.curve])), xlabel: 'design step', ylabel: '',
      onPick: xv => seekStep(Math.round(xv))
    }));

    // The player.
    $('frames').innerHTML = `<div class="player">
        <button type="button" id="play">Play</button>
        <input type="range" id="scrub" min="0" max="${a.frames.length - 1}" value="0" aria-label="Frame">
        <span class="t" id="frame-t"></span>
      </div>`;
    $('scrub').oninput = () => show(+$('scrub').value);
    $('play').onclick = () => {
      if (timer) { clearInterval(timer); timer = null; $('play').textContent = 'Play'; return; }
      $('play').textContent = 'Pause';
      timer = setInterval(() => {
        if (state.i >= a.frames.length - 1) { clearInterval(timer); timer = null; $('play').textContent = 'Play'; return; }
        show(state.i + 1);
      }, 350);
    };
    $('legend').innerHTML = '<span>grey: target, chain A</span><span>teal: binder, chain B</span>';
    await show(0, true);
  }

  function seekStep(step) {
    // The nearest captured frame to a step on the loss curves.
    let best = 0, gap = Infinity;
    state.a.frames.forEach((f, i) => {
      const r = state.row[frameKey(f)];
      if (r !== undefined && Math.abs(r + 1 - step) < gap) { gap = Math.abs(r + 1 - step); best = i; }
    });
    show(best);
  }

  async function show(i, fit = false) {
    state.i = i;
    $('scrub').value = i;
    const name = state.a.frames[i];
    let text = state.cache.get(name);
    if (!text) { text = await fetchText(`${c.dir}/frames/${name}`); state.cache.set(name, text); }
    if (state.a.frames[state.i] !== name) return;
    v.removeAllModels();
    const m = v.addModel(text, 'cif');
    m.setStyle({ chain: 'A' }, { cartoon: { color: '#8ea4b5', opacity: 0.85 } });
    m.setStyle({ chain: 'B' }, { cartoon: { color: '#5fd4c9' } });
    if (fit) v.zoomTo();
    v.render();
    const k = frameKey(name);
    const r = state.row[k];
    $('frame-t').textContent = k ? k.replace(':', ' step ') : name;
    if (r !== undefined) state.charts.forEach(ch => ch.at(r + 1));
    drawContacts(text);
  }

  function drawContacts(text) {
    const list = atoms(text).filter(x => !x.atom.startsWith('H'));
    const pairs = contacts(list, 'A', 'B', 4);
    const binderN = Math.max(...list.filter(x => x.chain === 'B').map(x => x.resi));
    const targetRes = [...new Set(list.filter(x => x.chain === 'A').map(x => x.resi))].sort((p, q) => p - q);
    const tIndex = new Map(targetRes.map((r, i) => [r, i]));
    const W = 760, H = 220, cw = W / targetRes.length, ch = H / binderN;
    const cells = pairs.map(([b, t]) => `<rect x="${(tIndex.get(t) * cw).toFixed(1)}" y="${((b - 1) * ch).toFixed(1)}" width="${Math.max(cw, 1.5).toFixed(1)}" height="${Math.max(ch, 1.5).toFixed(1)}" fill="var(--accent)"/>`).join('');
    $('contacts').innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="${pairs.length} binder and target residue pairs in contact">
        <rect x="0" y="0" width="${W}" height="${H}" fill="var(--bg)"/>${cells}</svg>
      <p class="small muted">Across: target residues ${targetRes[0]} to ${targetRes[targetRes.length - 1]}. Down: binder residues 1 to ${binderN}. ${pairs.length} pairs within 4 angstroms in this frame.</p>`;
  }

  await loadCampaign(key);
}
