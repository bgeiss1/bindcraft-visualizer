// Tests for the parts of the site that compute something: the command parser, the six
// settings layers, the start-up checks, and the GPU memory formula. Run with: npm test
//
// These are the places a student's typing meets our code, so they are the places where a
// quiet mistake would teach the wrong thing.
import { parse, parseSet, words, cliLayer, rebuild } from '../js/command.js';
import { resolve, modalityLayer, check, residueNumbers, workerMemoryGB, cardMemoryGB, CORE, mergeLayer } from '../js/settings.js';
import { parseCSV, passes, FILTERS, toAngstrom, bfactorToPlddt } from '../js/site.js';
import { funnel } from '../js/funnel.js';
import { stageLines } from '../js/pages/trajectory.view.js';
import { positions, heldPositions } from '../js/pages/mpnn.view.js';
import { activeFilters, verdict } from '../js/pages/scoring.view.js';
import { checkHotspots } from '../js/pages/target.view.js';
import { atoms, contacts } from '../js/view3d.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

let pass = 0, fail = 0;
const eq = (got, want, what) => {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) { pass++; return; }
  fail++;
  console.error(`FAIL ${what}\n  got  ${a}\n  want ${b}`);
};
const ok = (cond, what) => eq(!!cond, true, what);
const near = (got, want, what, tol = 0.05) => {
  if (Math.abs(got - want) <= tol) { pass++; return; }
  fail++;
  console.error(`FAIL ${what}\n  got  ${got}\n  want ${want} (within ${tol})`);
};

// --- the command line -------------------------------------------------------
eq(words(`bindcraft design a.json --set 'binder_lengths=[70,90]'`),
  ['bindcraft', 'design', 'a.json', '--set', 'binder_lengths=[70,90]'], 'words() keeps a quoted --set together');

eq(parse('bindcraft design settings/3evg_apo.json').ok, true, 'the plain design command parses');
eq(parse('bindcraft design settings/3evg_apo.json').parsed.file, 'settings/3evg_apo.json', 'the campaign file is picked up');
eq(parse('bindcraft').ok, false, 'bindcraft alone is not a command');
eq(parse('bindcraft design').ok, false, 'design needs a campaign file');
ok(parse('bindcraft desgin a.json').errors[0].includes('design'), 'a misspelled subcommand suggests the real one');
ok(parse('gmx design a.json').errors[0].includes('bindcraft'), 'another program is rejected by name');
ok(parse('bindcraft design a.json -m VHH').errors[0].includes('long'), 'a short flag is explained, not just refused');
ok(parse('bindcraft design a.json b.json').errors[0].includes('one campaign file'), 'two campaign files is an error');
eq(parse('bindcraft design a.json --modality VHH').parsed.flags['--modality'], 'VHH', '--modality takes its value');
eq(parse('bindcraft design a.json --modality=VHH').parsed.flags['--modality'], 'VHH', '--modality=value works too');
eq(parse('bindcraft --list-modalities').parsed.list, '--list-modalities', 'a list flag is recognised on its own');
eq(parse('python3 bindcraft.py a.json').ok, true, 'the python form parses');
ok(parse('python3 bindcraft.pyc a.json').errors[0].includes('bindcraft.py'), 'the wrong script name is caught');

eq(parseSet('binder_lengths=[70,90]'), { key: 'binder_lengths', value: [70, 90] }, '--set parses a JSON list');
eq(parseSet('max_trajectories=40'), { key: 'max_trajectories', value: 40 }, '--set parses a number');
eq(parseSet('resume=false'), { key: 'resume', value: false }, '--set parses a boolean');
eq(parseSet('project_folder=results/x'), { key: 'project_folder', value: 'results/x' }, '--set keeps a path as text');
ok(parseSet('binder_lengths=[70,').error, '--set reports broken JSON');
ok(parseSet('nonsense').error, '--set without = is an error');

const p = parse(`bindcraft design a.json --modality VHH --humanize --set 'max_trajectories=40'`).parsed;
eq(cliLayer(p), { max_trajectories: 40, modality: 'VHH', humanize: true }, 'the command line becomes a settings layer');
ok(rebuild(p).includes("--set 'max_trajectories=40'"), 'a command rebuilds with its overrides');

// --- the settings layers ----------------------------------------------------
eq(resolve({}).settings.modality, 'binder', 'with no layers we get BindCraft2 defaults');
eq(resolve({}).from.min_iptm_final, 'core', 'and every value says it came from core');

const layered = resolve({
  modality: { binder_lengths: [60, 180] },
  target: { hotspots: '54,56' },
  campaign: { max_trajectories: 40, min_iptm_final: 0.6 },
  cli: { max_trajectories: 10 }
});
eq(layered.settings.max_trajectories, 10, 'the command line beats the campaign file');
eq(layered.from.max_trajectories, 'cli', 'and the layer is reported');
eq(layered.settings.min_iptm_final, 0.6, 'the campaign file beats core');
eq(layered.from.min_iptm_final, 'campaign', 'and that layer is reported too');
eq(layered.settings.screen_steps, CORE.screen_steps, 'a setting nobody touched keeps its default');

eq(mergeLayer({ a: { x: 1, y: 2 } }, { a: { y: 3 } }), { a: { x: 1, y: 3 } }, 'nested objects merge by key');
eq(mergeLayer({ a: [1, 2, 3] }, { a: [9] }), { a: [9] }, 'lists replace rather than merge');

eq(modalityLayer('peptide').names, ['peptide'], 'one modality');
eq(modalityLayer('binder,induced_fit').names, ['binder', 'induced_fit'], 'two modalities combine');
eq(modalityLayer('peptide').patch.validation_model, 'multimer', 'the peptide preset validates with multimer');

// --- the start-up checks ----------------------------------------------------
const target = t => ({ modality: 'binder', targets: [t] });
const codes = c => check(c).map(x => x.code);

eq(codes({ targets: [] }), ['no_target'], 'a campaign with no target is refused');
ok(codes(target({ name: 'x', target_path: 'x.fasta', coldspots: '10' })).includes('fasta_coldspots'),
  'coldspots on a sequence target are refused');
ok(codes({ ...target({ name: 'x', target_path: 'x.fasta' }), forced_targeting: true }).includes('fasta_forced'),
  'forced_targeting on a sequence target is refused');
ok(codes({ ...target({ name: 'x', target_path: 'x.pdb', objective: 'detarget' }), modality: 'binder,induced_fit' }).includes('induced_detarget'),
  'induced_fit with detargeting is refused');
ok(codes({ ...target({ name: 'x', target_path: 'x.pdb' }), modality: 'VHH,cyclic_peptide' }).includes('scaffold_combo'),
  'a scaffold modality with cyclic_peptide is refused');
ok(codes({ ...target({ name: 'x', target_path: 'x.pdb' }), binder_lengths: [10, 20] }).includes('length_range'),
  'a binder far shorter than the modality allows is refused');
ok(codes({ ...target({ name: 'x', target_path: 'x.pdb' }), design_models: 7 }).includes('model_overlap'),
  'using every model for design leaves none for validation');
eq(codes(target({ name: 'x', target_path: 'x.pdb' })), [], 'a plain structured target with no hotspots is fine');
ok(check({ targets: [{ name: 'a', target_path: 'a.pdb' }, { name: 'a', target_path: 'b.pdb' }] })
  .map(x => x.code).includes('dup_target_name'), 'two targets cannot share a name');

// A hotspot or chain that is not in the structure. This is the mistake the target page exists for.
const info = { '3evg_apo': { chains: ['A'], residues: [61, 62, 63] } };
const bad = check({ modality: 'binder', targets: [{ name: '3evg_apo', target_path: 'x.pdb', chains: 'Z', hotspots: 'A9999' }] }, info);
ok(bad.some(x => x.code === 'no_chain'), 'a chain that is not in the file is refused');
ok(bad.some(x => x.code === 'no_residue'), 'a hotspot that is not in the file is refused');
eq(check({ modality: 'binder', targets: [{ name: '3evg_apo', target_path: 'x.pdb', chains: 'A', hotspots: '61-63' }] }, info).length, 0,
  'hotspots that are in the file pass');

// --- residue specs ----------------------------------------------------------
eq(residueNumbers('A54,A56').map(r => `${r.chain}${r.number}`), ['A54', 'A56'], 'a plain hotspot list');
eq(residueNumbers('B12-16').map(r => r.number), [12, 13, 14, 15, 16], 'a hotspot range expands');
eq(residueNumbers('54,56', 'A').map(r => r.chain), ['A', 'A'], 'unprefixed numbers take the first chain');
ok(residueNumbers('bogus')[0].bad, 'nonsense in a hotspot list is flagged');

// --- metrics ----------------------------------------------------------------
near(toAngstrom(0.35), 10.85, 'the default i_pAE ceiling is about 10.85 angstroms');
eq(bfactorToPlddt(93), 0.93, 'pLDDT comes out of the B-factor column on a 0 to 100 scale');
eq(passes({ i_pTM: '0.81' }, FILTERS.find(f => f.key === 'i_pTM')), true, 'a good i_pTM passes');
eq(passes({ i_pTM: '0.68' }, FILTERS.find(f => f.key === 'i_pTM')), false, 'a low i_pTM fails');
eq(passes({ i_pAE: '0.2' }, FILTERS.find(f => f.key === 'i_pAE')), true, 'i_pAE is lower-is-better');
eq(passes({ i_pAE: '0.5' }, FILTERS.find(f => f.key === 'i_pAE')), false, 'a high i_pAE fails');
eq(passes({}, FILTERS[0]), null, 'a missing metric is not a pass or a fail');

eq(parseCSV('a,b\n1,2\n3,4').rows, [{ a: '1', b: '2' }, { a: '3', b: '4' }], 'a BC2 csv parses');
eq(parseCSV('').rows, [], 'an empty csv is empty, not an error');

// --- GPU memory, from BC2's own formula -------------------------------------
near(workerMemoryGB(64), 7.1, 'one worker at 64 residues', 0.2);
near(workerMemoryGB(128), 8.0, 'one worker at 128 residues', 0.2);
near(workerMemoryGB(256), 11.8, 'one worker at 256 residues', 0.2);
near(workerMemoryGB(384), 18.0, 'one worker at 384 residues', 0.2);
near(workerMemoryGB(512), 26.7, 'one worker at 512 residues', 0.2);
ok(cardMemoryGB(256, 4) > workerMemoryGB(256) * 4, 'a card also needs its headroom');

// --- the funnel -------------------------------------------------------------
const f = funnel({ stages: [{ key: 'screen', entered: 40, dropped: 22 }, { key: 'anneal', entered: 18, dropped: 7 }], candidates: 30, accepted: 2 });
ok(f.includes('<svg'), 'the funnel draws');
ok(f.includes('40'), 'and shows the number that went in');
ok(f.includes('2'), 'and the number that came out');
eq(funnel(null), '', 'with no campaign there is no funnel, not a broken one');

// --- reading a captured campaign -------------------------------------------
const log = `=== trajectory 5 | design_a | accepted 0/3 | worker 0 ===
  passed screen design stage  i_pTM=0.41    pLDDT=0.63
  rejected at anneal design stage  i_pTM=0.79    pLDDT=0.6    due to [pLDDT]
=== trajectory 6 | design_b | accepted 0/3 | worker 1 ===
  passed screen design stage  i_pTM=0.84    pLDDT=0.85`;
eq(stageLines(log, 'design_a').map(l => [l.stage, l.passed, l.why]), [['screen', true, []], ['anneal', false, ['pLDDT']]],
  'the screen log gives each stage and why an attempt was dropped');
eq(stageLines(log, 'design_b').length, 1, 'and keeps attempts apart');
eq([...positions('D69,I72,M73')], [69, 72, 73], 'interface residues come out as positions');
eq([...heldPositions('ACDE', ['ACDF', 'GCDE'])], [2, 3], 'a position is held when every candidate keeps it');
const filt = activeFilters({ filters: { i_pTM: { higher: true, threshold: 0.7 }, Binder_Mass_kDa: { higher: false, mandatory: false, threshold: 'Infinity' } } });
eq(filt.map(f => f.key), ['i_pTM'], 'only filters with a real threshold gate anything');
eq(verdict({ i_pTM: '0.6' }, filt), ['i_pTM'], 'a candidate under a floor is stopped by it');
eq(verdict({ i_pTM: '' }, filt), [], 'a missing metric stops nothing');
const tbl = [{ chain: 'A', number: 54, exposure: 0.5 }, { chain: 'A', number: 56, exposure: 0.05 }];
eq(checkHotspots('A54,56,A99', tbl, 'A').map(h => h.problem ?? 'ok'), ['ok', 'buried', 'not in the file'], 'hotspots are checked against the real file');
const cif = `loop_
_atom_site.group_PDB
_atom_site.label_atom_id
_atom_site.label_comp_id
_atom_site.auth_asym_id
_atom_site.auth_seq_id
_atom_site.B_iso_or_equiv
_atom_site.Cartn_x
_atom_site.Cartn_y
_atom_site.Cartn_z
ATOM CA ALA A 1 90.0 0 0 0
ATOM CA GLY B 1 50.0 3 0 0
ATOM CA GLY B 2 50.0 9 0 0`;
const at = atoms(cif);
eq(at.map(a => a.chain + a.resi), ['A1', 'B1', 'B2'], 'atoms are read from a BC2 cif');
eq(contacts(at, 'A', 'B', 4), [[1, 1]], 'only pairs within 4 angstroms count as contacts');

// --- the shipped data files are valid ---------------------------------------
const here = fileURLToPath(new URL('.', import.meta.url));
for (const file of ['data/text.json', 'data/targets.json']) {
  const raw = readFileSync(here + '../' + file, 'utf8');
  let parsed;
  try { parsed = JSON.parse(raw); ok(true, `${file} is valid JSON`); }
  catch (e) { fail++; console.error(`FAIL ${file} is not valid JSON: ${e.message}`); continue; }
  if (file === 'data/text.json') {
    const banned = /\b(importantly|notably|interestingly|indeed|crucially|moreover|furthermore|hence|consequently|nevertheless|groundbreaking|transformative|cutting-edge|remarkable)\b/i;
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v !== 'string') { fail++; console.error(`FAIL ${file} ${k} is not a string`); continue; }
      if (/[—–]/.test(v)) { fail++; console.error(`FAIL ${file} ${k} has an em or en dash`); continue; }
      const prose = v.replace(/&\w+;|&#\d+;/g, '');
      if (/;/.test(prose)) { fail++; console.error(`FAIL ${file} ${k} has a semicolon`); continue; }
      if (banned.test(v)) { fail++; console.error(`FAIL ${file} ${k} uses "${v.match(banned)[0]}"`); continue; }
      pass++;
    }
  }
}

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
