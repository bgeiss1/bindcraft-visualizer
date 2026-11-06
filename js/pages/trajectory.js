// The trajectory page. Everything it shows comes from a recorded campaign, so until the capture
// scripts have run it says so rather than showing invented data.
import { setup, Tplain, $, loadJSON } from '../site.js';
import { pending } from '../pending.js';

(async () => {
  await setup('trajectory');
  let campaigns = {};
  try { campaigns = await loadJSON('data/campaigns.json'); } catch { campaigns = {}; }
  const ready = Object.values(campaigns).some(c => c.trajectory);
  if (!ready) { pending('trajectory'); return; }
  const { render } = await import('./trajectory.view.js');
  await render(campaigns);
})();
