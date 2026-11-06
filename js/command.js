// Parses what a student types on the command line, the way BC2's own CLI reads it, and
// reports the same kinds of complaint. BC2 has one command that matters for designing
// (`bindcraft design <campaign.json>`), plus subcommands that work on finished results.

export const SUBCOMMANDS = ['design', 'rank', 'filter', 'score', 'campaign_output', 'archive', 'unarchive', 'fetch-weights', 'selfcheck'];

export const LIST_FLAGS = ['--list-targets', '--list-modalities', '--list-properties', '--list-core', '--list-settings'];

// Flags the design subcommand takes. value: true means it consumes the next word.
export const FLAGS = {
  '--modality': { value: true },
  '--set': { value: true, repeat: true },
  '--metadata': { value: false },
  '--core': { value: true },
  '--humanize': { value: false },
  '--mixed-topology': { value: false },
  '--help': { value: false }
};

// Split a command line into words, honouring single and double quotes.
export function words(line) {
  const out = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(line))) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

// `--set 'binder_lengths=[70,90]'` -> { key: 'binder_lengths', value: [70, 90] }
export function parseSet(s) {
  const i = String(s).indexOf('=');
  if (i < 0) return { error: `--set needs key=value, not "${s}".` };
  const key = s.slice(0, i).trim();
  const raw = s.slice(i + 1).trim();
  if (!key) return { error: `--set needs a key before the "=".` };
  let value = raw;
  if (/^(true|false)$/i.test(raw)) value = raw.toLowerCase() === 'true';
  else if (raw !== '' && !Number.isNaN(Number(raw))) value = Number(raw);
  else if (/^[[{]/.test(raw)) {
    try { value = JSON.parse(raw); } catch { return { error: `--set ${key}=${raw} is not valid JSON.` }; }
  }
  return { key, value };
}

// Parse a whole command line. Returns { ok, errors, parsed } where parsed holds the
// subcommand, the campaign file and the overrides, ready to feed the settings layers.
export function parse(line) {
  const errors = [];
  const w = words(line);
  const parsed = { program: w[0], subcommand: null, file: null, sets: {}, flags: {}, list: null };

  if (!w.length) return { ok: false, errors: ['Type a command.'], parsed };

  if (w[0] !== 'bindcraft' && w[0] !== 'python3' && w[0] !== 'sbatch') {
    errors.push(`"${w[0]}" is not a command on this machine. The campaign command is "bindcraft".`);
    return { ok: false, errors, parsed };
  }

  let i = 1;
  // python3 bindcraft.py <campaign.json> and sbatch bindcraft.slurm <campaign.json>
  if (w[0] === 'python3' || w[0] === 'sbatch') {
    const script = w[1] ?? '';
    const want = w[0] === 'python3' ? 'bindcraft.py' : 'bindcraft.slurm';
    if (script !== want) errors.push(`${w[0]} runs ${want}, not "${script}".`);
    parsed.subcommand = 'design';
    i = 2;
  } else {
    const sub = w[1];
    if (sub && LIST_FLAGS.includes(sub)) { parsed.list = sub; return { ok: true, errors, parsed }; }
    if (!sub) { errors.push('bindcraft needs a subcommand, for example "bindcraft design campaign.json".'); return { ok: false, errors, parsed }; }
    if (!SUBCOMMANDS.includes(sub)) {
      const near = SUBCOMMANDS.find(s => s.startsWith(sub.slice(0, 3)));
      errors.push(`"${sub}" is not a bindcraft subcommand.${near ? ` Did you mean "${near}"?` : ''}`);
      return { ok: false, errors, parsed };
    }
    parsed.subcommand = sub;
    i = 2;
  }

  for (; i < w.length; i++) {
    const tok = w[i];
    if (LIST_FLAGS.includes(tok)) { parsed.list = tok; continue; }
    if (tok.startsWith('--')) {
      const eq = tok.indexOf('=');
      const name = eq > 0 ? tok.slice(0, eq) : tok;
      const spec = FLAGS[name];
      if (!spec) { errors.push(`"${name}" is not a flag bindcraft knows.`); continue; }
      let value = null;
      if (spec.value) {
        value = eq > 0 ? tok.slice(eq + 1) : w[++i];
        if (value === undefined) { errors.push(`${name} needs a value after it.`); continue; }
      }
      if (name === '--set') {
        const r = parseSet(value);
        if (r.error) errors.push(r.error);
        else parsed.sets[r.key] = r.value;
      } else {
        parsed.flags[name] = spec.value ? value : true;
      }
      continue;
    }
    if (tok.startsWith('-')) { errors.push(`"${tok}" is not a flag bindcraft knows. Its flags are long, like --modality.`); continue; }
    if (parsed.file) errors.push(`bindcraft design takes one campaign file, and you gave two ("${parsed.file}" and "${tok}").`);
    else parsed.file = tok;
  }

  if (parsed.subcommand === 'design' && !parsed.file && !parsed.list) {
    errors.push('bindcraft design needs a campaign file, for example "bindcraft design settings/3evg.json".');
  }

  return { ok: !errors.length, errors, parsed };
}

// The overrides a parsed command contributes, as the `cli` settings layer.
export function cliLayer(parsed) {
  const layer = { ...parsed.sets };
  if (parsed.flags['--modality']) layer.modality = parsed.flags['--modality'];
  if (parsed.flags['--humanize']) layer.humanize = true;
  if (parsed.flags['--mixed-topology']) layer.mixed_topology = true;
  return layer;
}

// Rebuild a command from its parts, so the site can check it round-trips.
export function rebuild(parsed) {
  const out = ['bindcraft', parsed.subcommand];
  if (parsed.file) out.push(parsed.file);
  for (const [k, v] of Object.entries(parsed.flags)) out.push(v === true ? k : `${k} ${v}`);
  for (const [k, v] of Object.entries(parsed.sets)) out.push(`--set '${k}=${typeof v === 'object' ? JSON.stringify(v) : v}'`);
  return out.join(' ');
}
