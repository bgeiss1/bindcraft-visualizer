// BindCraft2 settings: the six resolution layers, the keys worth editing, and the checks
// BC2 makes at start-up. Defaults are from BC2 v1.0.4 settings/core/default.json and the
// modality presets; every recorded run also carries its own campaign_metadata.json, which
// is what the pages show when they are showing a real run.

// The order settings resolve in. Later layers win; nested objects merge, lists replace.
export const LAYERS = ['core', 'profile', 'modality', 'properties', 'target', 'campaign', 'cli'];

// Core defaults, only the keys this site exposes.
export const CORE = {
  modality: 'binder',
  binder_lengths: [60, 180],
  copies: 1,
  screen_steps: 50,
  refine_steps: 25,
  anneal_steps: 45,
  harden_steps: 5,
  mutate_steps: 15,
  autotune: true,
  design_models: 5,
  validation_model: 'monomer',
  design_recycles: 1,
  validation_recycles: 3,
  design_dropout: true,
  mpnn_model: 'v_48_020',
  mpnn_variant: 'negative',
  sequence_candidates: 10,
  enough_passing_sequences: 3,
  kept_sequences: 1,
  redesign_interface: false,
  min_plddt_screen: 0.6,
  min_plddt_refine: 0.6,
  min_plddt_anneal: 0.65,
  min_plddt_harden: 0.65,
  min_plddt_mutate: 0.6,
  min_plddt_final: 0.7,
  min_iptm_anneal: 0.5,
  min_iptm_harden: 0.5,
  min_iptm_mutate: 0.5,
  min_iptm_final: 0.7,
  target_flexibility: 0,
  forced_targeting: false,
  forced_targeting_shell: 10,
  number_of_final_designs: 1,
  campaign_seed: 0,
  resume: true,
  trajectory_only: false,
  desperation: true,
  desperation_trajectories: 750,
  save_design_frames: false,
  save_design_animations: false,
  save_loss_plots: false,
  save_design_trajectory: false,
  save_failed_trajectories: true,
  save_failed_refolds: true,
  save_binder_monomers: true,
  relax_accepted_designs: false
};

// The modality presets this site knows about. BC2 ships more keys per preset; these are
// the ones that change what a student sees.
export const MODALITIES = {
  binder: { binder_lengths: [60, 180], validation_model: 'monomer', min_monomer_plddt_final: 0.7 },
  large_binder: { binder_lengths: [300, 450], validation_model: 'monomer' },
  peptide: { binder_lengths: [8, 24], validation_model: 'multimer' },
  cyclic_peptide: { binder_lengths: [8, 24], validation_model: 'multimer' },
  homo_oligomer: { copies: 2, validation_model: 'multimer' },
  multidomain: { binder_lengths: [120, 300] },
  VHH: { binder_lengths: [120, 135] },
  ARP: { binder_lengths: [120, 180] },
  scFv: { binder_lengths: [230, 260] },
  Fab: { binder_lengths: [420, 460] }
};

// Modalities that combine with another one rather than standing alone.
export const COMBINING = ['induced_fit', 'fold_switch'];

// Scaffold-based modalities: BC2 refuses some combinations with these.
export const SCAFFOLD_MODALITIES = ['VHH', 'scFv', 'Fab', 'ARP'];

export const PROPERTIES = [
  'forced_targeting', 'humanize', 'protease_stable', 'disulfide_staple',
  'mixed_topology', 'termini_together', 'termini_accessible', 'initial_guess', 'bigbang'
];

// Groups for the settings form, in the order the page shows them.
export const GROUPS = [
  { key: 'target', keys: ['chains', 'hotspots', 'coldspots', 'objective', 'weight', 'target_flexibility', 'forced_targeting', 'forced_targeting_shell'] },
  { key: 'binder', keys: ['modality', 'binder_lengths', 'copies', 'aa_bias'] },
  { key: 'stages', keys: ['screen_steps', 'refine_steps', 'anneal_steps', 'harden_steps', 'mutate_steps', 'autotune'] },
  { key: 'models', keys: ['design_models', 'validation_model', 'design_recycles', 'validation_recycles'] },
  { key: 'mpnn', keys: ['sequence_candidates', 'enough_passing_sequences', 'kept_sequences', 'mpnn_variant', 'redesign_interface'] },
  { key: 'filters', keys: ['min_plddt_screen', 'min_plddt_refine', 'min_plddt_anneal', 'min_plddt_harden', 'min_plddt_mutate', 'min_plddt_final', 'min_iptm_anneal', 'min_iptm_harden', 'min_iptm_mutate', 'min_iptm_final', 'min_monomer_plddt_final', 'min_hotspot_contact_final'] },
  { key: 'campaign', keys: ['max_trajectories', 'number_of_final_designs', 'campaign_seed', 'project_folder', 'trajectory_only', 'resume'] },
  { key: 'output', keys: ['save_design_frames', 'save_design_animations', 'save_loss_plots', 'save_design_trajectory', 'relax_accepted_designs'] }
];

const isObj = v => v && typeof v === 'object' && !Array.isArray(v);

// Merge one layer onto another the way BC2 does: nested objects merge by key, lists replace.
export function mergeLayer(base, patch) {
  const out = { ...base };
  for (const [k, v] of Object.entries(patch ?? {})) {
    out[k] = isObj(v) && isObj(out[k]) ? mergeLayer(out[k], v) : v;
  }
  return out;
}

// Resolve a campaign: which layer each final value came from, so the page can show it.
// `layers` is {profile, modality, properties, target, campaign, cli} of partial settings.
export function resolve(layers = {}) {
  let merged = { ...CORE };
  const from = Object.fromEntries(Object.keys(CORE).map(k => [k, 'core']));
  for (const name of LAYERS.slice(1)) {
    const patch = layers[name];
    if (!patch) continue;
    for (const k of Object.keys(patch)) from[k] = name;
    merged = mergeLayer(merged, patch);
  }
  return { settings: merged, from };
}

// The modality layer for a `modality` value that may list several, e.g. "binder,induced_fit".
export function modalityLayer(modality) {
  const names = String(modality ?? 'binder').split(',').map(s => s.trim()).filter(Boolean);
  let patch = {};
  for (const n of names) if (MODALITIES[n]) patch = mergeLayer(patch, MODALITIES[n]);
  return { patch, names };
}

// ---------------------------------------------------------------------------
// Start-up checks. BC2 refuses a bad campaign before it spends any GPU time and
// prints every reason at once with exit status 2, so this returns a list.
//
// Each entry has a `code` (used to look up the real recorded error text) and a
// `reason` written the way BC2 words it. Where the site has captured BC2's own
// output for that code, the page prints the captured text instead of this one.
// ---------------------------------------------------------------------------
export function check(campaign, targetInfo = {}) {
  const out = [];
  const s = campaign ?? {};
  const targets = Array.isArray(s.targets) ? s.targets : [];
  const { names: modalities } = modalityLayer(s.modality);
  const has = n => modalities.includes(n);
  const scaffold = modalities.find(n => SCAFFOLD_MODALITIES.includes(n));

  if (!targets.length) out.push({ code: 'no_target', reason: 'no target: a campaign needs at least one entry in targets.' });

  const names = targets.map(t => t.name).filter(Boolean);
  if (new Set(names).size !== names.length) out.push({ code: 'dup_target_name', reason: 'target names must be distinct.' });

  for (const t of targets) {
    const isFasta = /\.(fa|fasta|faa)$/i.test(t.target_path ?? '') || t.sequence;
    if (isFasta && t.coldspots) out.push({ code: 'fasta_coldspots', reason: `coldspots need a resolved backbone, and ${t.name ?? 'a target'} is a sequence.` });
    if (isFasta && s.forced_targeting) out.push({ code: 'fasta_forced', reason: `forced_targeting needs a structured target, and ${t.name ?? 'a target'} is a sequence.` });
    if (t.objective === 'detarget' && has('induced_fit')) out.push({ code: 'induced_detarget', reason: 'induced_fit cannot be combined with a detargeting objective.' });

    // Chain and residue numbering, when the site knows the structure.
    const info = targetInfo[t.name] ?? targetInfo[t.target_path];
    if (info) {
      for (const c of String(t.chains ?? '').split(',').map(x => x.trim()).filter(Boolean)) {
        if (info.chains && !info.chains.includes(c)) out.push({ code: 'no_chain', reason: `chain ${c} is not in ${t.target_path}.`, detail: { chain: c, available: info.chains } });
      }
      for (const r of residueNumbers(t.hotspots)) {
        if (info.residues && !info.residues.includes(r.number)) out.push({ code: 'no_residue', reason: `hotspot ${r.raw} is not a residue in ${t.target_path}.`, detail: r });
      }
    }
  }

  if (scaffold) {
    for (const bad of ['cyclic_peptide', 'homo_oligomer', 'fold_switch', 'mixed_topology']) {
      if (has(bad) || (bad === 'mixed_topology' && s.mixed_topology)) {
        out.push({ code: 'scaffold_combo', reason: `${scaffold} cannot be combined with ${bad}.` });
      }
    }
  }

  const { patch } = modalityLayer(s.modality);
  const lengths = s.binder_lengths ?? patch.binder_lengths ?? CORE.binder_lengths;
  const lo = Math.min(...[].concat(lengths)), hi = Math.max(...[].concat(lengths));
  const preset = patch.binder_lengths;
  if (preset && (hi < preset[0] || lo > preset[1])) {
    out.push({ code: 'length_range', reason: `binder_lengths ${JSON.stringify(lengths)} is outside what ${modalities.join(',')} supports (${preset[0]}-${preset[1]}).` });
  }
  if (lo < 1) out.push({ code: 'length_zero', reason: 'binder_lengths must be positive.' });

  const design = Number(s.design_models ?? CORE.design_models);
  const pool = String(s.validation_model ?? CORE.validation_model) === 'multimer' ? 5 : 7;
  if (design >= pool) out.push({ code: 'model_overlap', reason: `design_models ${design} leaves no models for validation; design and validation models must not overlap.` });

  if (s.resume === false && s.project_folder_populated) {
    out.push({ code: 'folder_populated', reason: `${s.project_folder} already holds campaign output, and resume is false.` });
  }

  return out;
}

// "A54,A56,B12-16" or "54,56,66-70" -> a flat list of {chain, number, raw}
export function residueNumbers(spec, defaultChain = null) {
  const out = [];
  for (const part of String(spec ?? '').split(',').map(s => s.trim()).filter(Boolean)) {
    // The chain prefix is letters only, so "B12-16" splits as chain B, residues 12 to 16.
    // A greedier prefix would read "B1" as the chain and start the range at 2.
    const m = /^([A-Za-z]+)?(\d+)(?:-(\d+))?$/.exec(part);
    if (!m) { out.push({ chain: defaultChain, number: NaN, raw: part, bad: true }); continue; }
    const chain = m[1] ?? defaultChain;
    const from = Number(m[2]), to = m[3] ? Number(m[3]) : from;
    for (let n = from; n <= to; n++) out.push({ chain, number: n, raw: part });
  }
  return out;
}

// The GPU memory one worker needs, from BC2's own formula in docs/installation.md:
// 2.0 x (3.4 GB + 38 kB x N^2) for a padded complex of N residues.
export const workerMemoryGB = n => 2.0 * (3.4 + 38e-6 * n * n);
export const cardMemoryGB = (n, workers) => workerMemoryGB(n) * workers + 4;
