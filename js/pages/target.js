// The target page. Everything it shows comes from a recorded campaign, so until the capture
// scripts have run it says so rather than showing invented data.
import { setup, Tplain, $, loadJSON } from '../site.js';
import { pending } from '../pending.js';

(async () => {
  await setup('target');
  let campaigns = {};
  try { campaigns = await loadJSON('data/campaigns.json'); } catch { campaigns = {}; }
  const ready = Object.values(campaigns).some(c => c.target);
  if (!ready) { pending('target'); return; }
  const { render } = await import('./target.view.js');
  await render(campaigns);
})();
