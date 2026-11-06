// The campaign funnel, drawn as inline SVG: how many attempts entered, where they were
// dropped, and how many designs came out. Every number comes from a real campaign's
// !_Trajectories.csv and !_Refolded.csv, never from a guess.

const W = 760, ROW = 46, PAD = 16, LABEL = 150;

// stages: [{ key, label, entered, dropped }], then { refolded, candidates, accepted }
export function funnel(f) {
  if (!f || !Array.isArray(f.stages) || !f.stages.length) return '';
  const rows = f.stages;
  const top = rows[0].entered || 1;
  const h = PAD * 2 + ROW * (rows.length + 2);
  const barW = W - LABEL - 90;

  const bar = (n, y, cls) => {
    const w = Math.max(2, (n / top) * barW);
    return `<rect x="${LABEL}" y="${y}" width="${w.toFixed(1)}" height="22" rx="4" class="${cls}"/>`;
  };

  let y = PAD;
  let svg = '';
  for (const s of rows) {
    const kept = s.entered - (s.dropped || 0);
    svg += `<text x="0" y="${y + 16}" class="fl">${esc(s.label || s.key)}</text>`;
    svg += bar(s.entered, y, 'f-in');
    svg += bar(kept, y, 'f-kept');
    svg += `<text x="${LABEL + Math.max(2, (s.entered / top) * barW) + 8}" y="${y + 16}" class="fn">${s.entered}${s.dropped ? ` in, ${s.dropped} dropped` : ' in'}</text>`;
    y += ROW;
  }
  svg += `<text x="0" y="${y + 16}" class="fl">candidates refolded</text>` + bar(f.candidates ?? 0, y, 'f-cand')
    + `<text x="${LABEL + Math.max(2, ((f.candidates ?? 0) / top) * barW) + 8}" y="${y + 16}" class="fn">${f.candidates ?? 0}</text>`;
  y += ROW;
  svg += `<text x="0" y="${y + 16}" class="fl">designs accepted</text>` + bar(f.accepted ?? 0, y, 'f-ok')
    + `<text x="${LABEL + Math.max(2, ((f.accepted ?? 0) / top) * barW) + 8}" y="${y + 16}" class="fn">${f.accepted ?? 0}</text>`;

  return `<svg viewBox="0 0 ${W} ${h}" class="funnel-svg" role="img" aria-label="Campaign funnel: ${top} attempts, ${f.accepted ?? 0} designs accepted">${svg}</svg>`;
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
