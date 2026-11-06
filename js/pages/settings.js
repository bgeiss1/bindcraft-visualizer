// The settings page: the campaign JSON as a form and as text, with the layer each value
// came from. Nothing here needs a GPU, so this page works before any campaign is captured.
import { setup, T, esc, $, loadJSON } from '../site.js';
import { CORE, GROUPS, PROPERTIES, MODALITIES, COMBINING, resolve, modalityLayer, check } from '../settings.js';

let campaigns = {}, current = null;

const layerName = {
  core: 'BindCraft2 default', profile: 'core profile', modality: 'modality preset',
  properties: 'a property you switched on', target: 'the target preset', campaign: 'this campaign file', cli: '--set on the command line'
};

function valueField(key, value, from) {
  const id = 'f_' + key;
  const t = typeof value;
  const input = t === 'boolean'
    ? `<input type="checkbox" id="${id}" data-key="${esc(key)}"${value ? ' checked' : ''}>`
    : `<input type="text" id="${id}" data-key="${esc(key)}" value="${esc(Array.isArray(value) ? JSON.stringify(value) : value ?? '')}" spellcheck="false">`;
  return `<div class="setting" data-from="${esc(from)}">
    <label for="${id}" class="mono">${esc(key)}</label>
    ${input}
    <span class="from" title="${esc(layerName[from] ?? from)}">${esc(from)}</span>
  </div>`;
}

function draw() {
  const { settings, from } = current;
  $('form').innerHTML = GROUPS.map(g => `
    <section class="sgroup">
      <h3>${esc(g.key)}</h3>
      ${g.keys.filter(k => k in settings).map(k => valueField(k, settings[k], from[k] ?? 'core')).join('')}
    </section>`).join('') + `
    <section class="sgroup">
      <h3>properties</h3>
      ${PROPERTIES.map(p => valueField(p, settings[p] ?? false, from[p] ?? 'core')).join('')}
    </section>`;

  const shown = Object.fromEntries(Object.entries(settings).filter(([k]) => from[k] && from[k] !== 'core'));
  $('json').innerHTML = `<h3>What this campaign file says</h3>
    <pre class="code">${esc(JSON.stringify(shown, null, 2))}</pre>
    <h3>The merged settings BindCraft2 runs with</h3>
    <pre class="code small">${esc(JSON.stringify(settings, null, 2))}</pre>`;

  const problems = check({ ...settings, targets: current.targets });
  if (problems.length) {
    $('json').insertAdjacentHTML('afterbegin',
      `<p class="note bad">BindCraft2 would refuse this campaign:</p><ul class="small">${problems.map(p => `<li>${esc(p.reason)}</li>`).join('')}</ul>`);
  }
}

function rebuildFrom(form) {
  const patch = {};
  for (const el of form.querySelectorAll('[data-key]')) {
    const key = el.dataset.key;
    if (el.type === 'checkbox') { patch[key] = el.checked; continue; }
    const raw = el.value.trim();
    if (raw === '') continue;
    patch[key] = /^(true|false)$/i.test(raw) ? raw.toLowerCase() === 'true'
      : /^[[{]/.test(raw) ? safeJSON(raw)
      : Number.isNaN(Number(raw)) ? raw : Number(raw);
  }
  return patch;
}
const safeJSON = s => { try { return JSON.parse(s); } catch { return s; } };

(async () => {
  await setup('settings');
  try { campaigns = await loadJSON('data/campaigns.json'); } catch { campaigns = {}; }
  const first = Object.values(campaigns)[0] ?? null;
  const campaignJSON = first?.json ?? { modality: 'binder', targets: [] };
  const { patch: modality } = modalityLayer(campaignJSON.modality);
  const r = resolve({ modality, target: first?.target_layer, campaign: campaignJSON });
  current = { ...r, targets: campaignJSON.targets ?? [] };
  draw();
  $('form').addEventListener('change', () => {
    const patch = rebuildFrom($('form'));
    const { patch: mod } = modalityLayer(patch.modality);
    const r2 = resolve({ modality: mod, target: first?.target_layer, campaign: campaignJSON, cli: patch });
    current = { ...r2, targets: campaignJSON.targets ?? [] };
    draw();
  });
})();
