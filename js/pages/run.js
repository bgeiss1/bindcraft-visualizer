// The command line. A student types a bindcraft command, presses Run, and gets one of
// three answers: the real output of a campaign we recorded, the effects we can work out
// in the browser, or the refusal BindCraft2 prints before it starts.
import { setup, T, Tplain, esc, $, term, hasRun, markRun, loadJSON, note } from '../site.js';
import { parse, cliLayer, rebuild } from '../command.js';
import { resolve, modalityLayer, check, workerMemoryGB, cardMemoryGB } from '../settings.js';

// Measured on our own server: 2.6 minutes per trajectory with four workers on one card.
const MINUTES_PER_TRAJECTORY = 2.6;

let recorded = {}, campaigns = {}, refusals = {}, targetInfo = {};

const sameSettings = (a, b) => JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));
const sortKeys = o => (o && typeof o === 'object' && !Array.isArray(o)
  ? Object.fromEntries(Object.keys(o).sort().map(k => [k, sortKeys(o[k])]))
  : o);

// Does this command match a campaign we actually ran?
function findRecorded(parsed, merged) {
  for (const [key, r] of Object.entries(recorded)) {
    if (r.file && parsed.file && r.file.endsWith(parsed.file.replace(/^.*\//, ''))
      && sameSettings(r.overrides ?? {}, { ...parsed.sets })) return { key, ...r };
  }
  // Fall back on the campaign whose merged settings match on the keys we vary.
  for (const [key, c] of Object.entries(campaigns)) {
    if (!c.settings) continue;
    const keys = Object.keys(c.varies ?? {});
    if (keys.length && keys.every(k => JSON.stringify(merged[k]) === JSON.stringify(c.settings[k]))) return { key, ...c };
  }
  return null;
}

function campaignFor(parsed) {
  // The campaign JSON a file name refers to, as the capture scripts recorded it.
  const name = (parsed.file ?? '').replace(/^.*\//, '');
  for (const c of Object.values(campaigns)) if (c.file && c.file.endsWith(name)) return c;
  return null;
}

function refusalText(codes) {
  // Where we captured BindCraft2's own words for a code, print those. Otherwise print ours.
  const lines = [];
  for (const r of codes) {
    const real = refusals[r.code];
    lines.push(real ? real.trimEnd() : `  ${r.reason}`);
  }
  return lines;
}

function estimate(merged, campaign) {
  const targetResidues = campaign?.target_residues ?? targetInfo.residues ?? null;
  const lengths = [].concat(merged.binder_lengths ?? []);
  const binder = Math.max(...lengths);
  const n = targetResidues ? targetResidues + binder : null;
  const trajectories = merged.max_trajectories ?? null;
  const rows = [];
  rows.push(['modality', String(merged.modality)]);
  rows.push(['binder length', lengths.length === 1 ? `${lengths[0]}` : `${Math.min(...lengths)} to ${binder}`]);
  rows.push(['design steps', String(merged.screen_steps + merged.refine_steps + merged.anneal_steps + merged.harden_steps + merged.mutate_steps)]);
  rows.push(['sequences per attempt', String(merged.sequence_candidates)]);
  rows.push(['final i_pTM floor', String(merged.min_iptm_final)]);
  if (n) {
    rows.push(['padded complex', `${n} residues`]);
    rows.push(['GPU memory, one worker', `${workerMemoryGB(n).toFixed(1)} GB`]);
    rows.push(['GPU memory, four workers on a card', `${cardMemoryGB(n, 4).toFixed(1)} GB`]);
  }
  if (trajectories) {
    const mins = trajectories * MINUTES_PER_TRAJECTORY;
    rows.push(['attempts', String(trajectories)]);
    rows.push(['rough walltime', mins < 90 ? `${Math.round(mins)} minutes` : `${(mins / 60).toFixed(1)} hours`]);
  }
  return `<table class="grid small"><tbody>${rows.map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td class="mono">${esc(v)}</td></tr>`).join('')}</tbody></table>`;
}

function show(line) {
  const el = $('result');
  const { ok, errors, parsed } = parse(line);

  if (!ok) {
    term(el, errors.map(e => '  ' + e), { cmd: line });
    el.insertAdjacentHTML('beforeend', note('bad', 'The command itself is wrong, so BindCraft2 never starts.'));
    return;
  }

  if (parsed.list) {
    const listed = recorded[parsed.list];
    term(el, listed ? listed : [`  ${Tplain('common.notCapturedYet')}`], { cmd: line });
    return;
  }

  if (parsed.subcommand !== 'design') {
    term(el, [`  ${parsed.subcommand} works on a campaign that has already finished.`], { cmd: line });
    el.insertAdjacentHTML('beforeend', note('note', T('run.subcommands')));
    return;
  }

  const campaign = campaignFor(parsed);
  if (!campaign) {
    // Two different situations, and they deserve different answers. Before any campaign is
    // captured we cannot tell a typo from a file we simply do not have, so we say that.
    const haveAny = Object.keys(campaigns).length > 0;
    if (!haveAny) {
      term(el, [`  ${Tplain('common.notCapturedYet')}`], { cmd: line });
      el.insertAdjacentHTML('beforeend', note('warn', T('common.computed'))
        + estimate(resolve({ cli: cliLayer(parsed) }).settings, null));
      return;
    }
    term(el, ['  campaign refused:', `    ${parsed.file} does not exist.`], { cmd: line });
    el.insertAdjacentHTML('beforeend', note('bad', `The campaign files this site ships are ${Object.values(campaigns).map(c => `<code>${esc(c.file)}</code>`).join(', ')}.`));
    return;
  }

  const cli = cliLayer(parsed);
  const { patch: modality } = modalityLayer(cli.modality ?? campaign.json?.modality);
  const { settings: merged } = resolve({
    modality,
    target: campaign.target_layer,
    campaign: campaign.json,
    cli
  });

  const problems = check({ ...merged, targets: campaign.json?.targets }, { [campaign.target]: targetInfo[campaign.target] });
  if (problems.length) {
    term(el, ['  campaign refused:', ...refusalText(problems)], { cmd: line });
    el.insertAdjacentHTML('beforeend', note('warn', T('common.refused')) + `<p class="small muted">Exit status 2. BindCraft2 lists every reason at once, so one run tells you everything that is wrong.</p>`);
    return;
  }

  const hit = findRecorded(parsed, merged);
  if (hit && hit.log) {
    term(el, hit.log, { cmd: line });
    el.insertAdjacentHTML('beforeend', note('ok', T('common.recorded'))
      + (hit.campaign ? `<p class="small"><a href="trajectory.html?campaign=${encodeURIComponent(hit.campaign)}">Watch an attempt from this campaign</a></p>` : ''));
    return;
  }

  term(el, [`  ${Tplain('common.notCapturedYet')}`], { cmd: line });
  el.insertAdjacentHTML('beforeend', note('warn', T('common.computed')) + estimate(merged, campaign));
}

function drawVariants() {
  const el = $('variants');
  const keys = Object.entries(recorded).filter(([, r]) => r.log);
  if (!keys.length) { el.innerHTML = `<p class="small muted">${Tplain('common.notCapturedYet')}</p>`; return; }
  el.innerHTML = `<ul class="variants">${keys.map(([k, r]) => `
    <li><button type="button" class="link" data-cmd="${esc(r.command)}">${esc(r.command)}</button>
    <span class="muted small">${esc(r.what ?? '')}</span></li>`).join('')}</ul>`;
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-cmd]');
    if (!b) return;
    $('cmd').value = b.dataset.cmd;
    markRun();
    show(b.dataset.cmd);
  });
}

(async () => {
  await setup('run');
  try { recorded = await loadJSON('data/recorded.json'); } catch { recorded = {}; }
  try { campaigns = await loadJSON('data/campaigns.json'); } catch { campaigns = {}; }
  try { refusals = await loadJSON('data/refusals.json'); } catch { refusals = {}; }
  try { targetInfo = await loadJSON('data/structures.json'); } catch { targetInfo = {}; }

  const start = Tplain('run.default');
  $('cmd').value = start;
  $('result').innerHTML = `<p class="muted">${Tplain('common.pressRun')}</p>`;

  const go = () => { markRun(); show($('cmd').value.trim()); };
  $('go').addEventListener('click', go);
  $('cmd').addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  $('reset').addEventListener('click', () => {
    $('cmd').value = start;
    if (hasRun()) show(start);
  });
  drawVariants();
})();
