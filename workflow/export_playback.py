#!/usr/bin/env python3
"""Pack what the visualizer pages need out of a finished BindCraft2 campaign.

Run this on the machine that holds the campaign, with BC2's own venv active or any
Python 3.9+, then copy site-data/<name>/ into the site's data/ folder.

    python3 export_playback.py --campaign ~/bc2-visualizer-runs/results/3evg_apo \\
        --name 3evg_apo --target ~/bc2-visualizer-runs/structures/3evg_apo.pdb \\
        --out site-data

What it writes, per campaign:
    campaign.json      the merged settings, the funnel counts, the timings
    trajectories.json  one row per attempt, with where it was dropped
    losses/<id>.json   the losses table of each chosen attempt, thinned
    frames/<id>.cif    the per-stage structures of each chosen attempt
    refolded.json      every candidate with its metrics and failed filters
    ranked.json        the accepted designs
    structure.json     the target's chains, residue numbers and exposure

It never writes anything a real run did not produce. Where a file is missing it says so
and carries on, so a half-finished campaign still gives a usable site.
"""
import argparse, csv, json, math, os, re, shutil, sys
from pathlib import Path

STAGES = ["screen", "refine", "anneal", "harden", "mutate", "final"]


def read_csv(path):
    if not path.exists():
        return []
    with path.open(newline="") as fh:
        return [dict(r) for r in csv.DictReader(fh)]


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def funnel(trajectories, refolded, ranked):
    """How many attempts entered each stage and how many were dropped there.

    BC2 records the stage an attempt ended at. Anything it does not record is left out
    rather than guessed at.
    """
    ended = {}
    for row in trajectories:
        stage = (row.get("terminated") or row.get("terminated_at") or "").strip().lower()
        ended[stage] = ended.get(stage, 0) + 1
    total = len(trajectories)
    out, alive = [], total
    for stage in STAGES:
        dropped = ended.get(stage, 0)
        out.append({"key": stage, "label": stage, "entered": alive, "dropped": dropped})
        alive -= dropped
    return {
        "stages": out,
        "attempts": total,
        "survived": alive,
        "candidates": len(refolded),
        "accepted": len(ranked),
    }


def frame_order(path):
    """Sort per-stage frames in run order: stage first, then step number."""
    m = re.search(r"_(screen|refine|anneal|harden|mutate|final)_(\d+)_", path.name)
    if not m:
        return (len(STAGES), 0, path.name)
    return (STAGES.index(m.group(1)), int(m.group(2)), path.name)


def thin(rows, limit=400):
    """Keep every row if there are few, otherwise keep an even spread."""
    if len(rows) <= limit:
        return rows
    step = len(rows) / limit
    return [rows[int(i * step)] for i in range(limit)]


def residue_table(pdb_path):
    """Chains and residue numbers from a PDB file, in file order.

    We read the file rather than trusting the settings, because a hotspot number that is
    not in the file is exactly the mistake the target page is there to catch.
    """
    chains, residues, seen = [], [], set()
    if not pdb_path or not Path(pdb_path).exists():
        return None
    with open(pdb_path) as fh:
        for line in fh:
            if not line.startswith("ATOM"):
                continue
            chain = line[21]
            resseq = line[22:27].strip()
            key = (chain, resseq)
            if key in seen:
                continue
            seen.add(key)
            if chain not in chains:
                chains.append(chain)
            residues.append({"chain": chain, "number": int(re.sub(r"\D", "", resseq) or 0),
                             "name": line[17:20].strip()})
    return {"chains": chains, "residues": [r["number"] for r in residues], "table": residues}


# Maximum solvent-accessible areas (Tien et al. 2013, theoretical), for relative exposure.
MAX_ASA = {"ALA": 129, "ARG": 274, "ASN": 195, "ASP": 193, "CYS": 167, "GLN": 225, "GLU": 223,
           "GLY": 104, "HIS": 224, "ILE": 197, "LEU": 201, "LYS": 236, "MET": 224, "PHE": 240,
           "PRO": 159, "SER": 155, "THR": 172, "TRP": 285, "TYR": 263, "VAL": 174}
RADIUS = {"C": 1.7, "N": 1.55, "O": 1.52, "S": 1.8}


def exposure(pdb_path, probe=1.4, points=96):
    """Relative solvent exposure per residue, by Shrake-Rupley, in plain Python.

    Slow-ish but dependency-free, and a target is only a few thousand atoms.
    Returns {(chain, number): fraction} with fraction on a 0 to 1 scale.
    """
    atoms = []
    with open(pdb_path) as fh:
        for line in fh:
            if not line.startswith("ATOM"):
                continue
            el = (line[76:78].strip() or line[12:16].strip()[0]).upper()
            if el == "H":
                continue
            atoms.append((line[21], int(re.sub(r"[^-\d]", "", line[22:26]) or 0), line[17:20].strip(),
                          float(line[30:38]), float(line[38:46]), float(line[46:54]),
                          RADIUS.get(el, 1.8) + probe))
    golden = math.pi * (3 - math.sqrt(5))
    sphere = []
    for i in range(points):
        y = 1 - 2 * (i + 0.5) / points
        r = math.sqrt(1 - y * y)
        sphere.append((math.cos(golden * i) * r, y, math.sin(golden * i) * r))
    cell = 2 * (1.8 + probe)
    grid = {}
    for idx, a in enumerate(atoms):
        grid.setdefault((int(a[3] // cell), int(a[4] // cell), int(a[5] // cell)), []).append(idx)
    area = {}
    for idx, (ch, num, name, x, y, z, R) in enumerate(atoms):
        gx, gy, gz = int(x // cell), int(y // cell), int(z // cell)
        near = [j for dx in (-1, 0, 1) for dy in (-1, 0, 1) for dz in (-1, 0, 1)
                for j in grid.get((gx + dx, gy + dy, gz + dz), ()) if j != idx]
        near = [j for j in near if (atoms[j][3] - x) ** 2 + (atoms[j][4] - y) ** 2 + (atoms[j][5] - z) ** 2
                < (R + atoms[j][6]) ** 2]
        free = 0
        for sx, sy, sz in sphere:
            px, py, pz = x + R * sx, y + R * sy, z + R * sz
            if all((atoms[j][3] - px) ** 2 + (atoms[j][4] - py) ** 2 + (atoms[j][5] - pz) ** 2 >= atoms[j][6] ** 2
                   for j in near):
                free += 1
        key = (ch, num)
        area[key] = area.get(key, 0) + 4 * math.pi * R * R * free / points
        area.setdefault(("name", key), name)
    out = {}
    for key, a in area.items():
        if key[0] == "name":
            continue
        out[key] = round(min(1.0, a / MAX_ASA.get(area[("name", key)], 200)), 3)
    return out


def cif_sequences(path):
    """One-letter sequence of each chain in a BC2 .cif, from its atom records."""
    three = {"ALA": "A", "ARG": "R", "ASN": "N", "ASP": "D", "CYS": "C", "GLN": "Q", "GLU": "E",
             "GLY": "G", "HIS": "H", "ILE": "I", "LEU": "L", "LYS": "K", "MET": "M", "PHE": "F",
             "PRO": "P", "SER": "S", "THR": "T", "TRP": "W", "TYR": "Y", "VAL": "V"}
    seqs, seen = {}, set()
    if not path.exists():
        return seqs
    with path.open() as fh:
        for line in fh:
            if not line.startswith("ATOM"):
                continue
            f = line.split()
            key = (f[5], f[6])
            if key in seen:
                continue
            seen.add(key)
            seqs[f[5]] = seqs.get(f[5], "") + three.get(f[4], "X")
    return seqs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--campaign", required=True, help="a BC2 project_folder")
    ap.add_argument("--name", required=True, help="what to call it in the site's data/")
    ap.add_argument("--target", help="the prepared target structure the campaign used")
    ap.add_argument("--out", default="site-data")
    ap.add_argument("--log", help="the campaign's screen log, copied as run.log")
    ap.add_argument("--attempts", type=int, default=4,
                    help="how many attempts to export frames and losses for")
    args = ap.parse_args()

    root = Path(args.campaign).expanduser()
    out = Path(args.out).expanduser() / args.name
    (out / "losses").mkdir(parents=True, exist_ok=True)
    (out / "frames").mkdir(parents=True, exist_ok=True)

    missing = []
    trajectories = read_csv(root / "1_Trajectories" / "!_Trajectories.csv")
    refolded = read_csv(root / "2_Refolded" / "!_Refolded.csv")
    ranked = read_csv(root / "3_Ranked" / "!_Ranked.csv")
    for label, rows, path in (("trajectories", trajectories, "1_Trajectories/!_Trajectories.csv"),
                              ("refolded", refolded, "2_Refolded/!_Refolded.csv"),
                              ("ranked", ranked, "3_Ranked/!_Ranked.csv")):
        if not rows:
            missing.append(path)

    meta_path = root / "campaign_metadata.json"
    meta = json.loads(meta_path.read_text()) if meta_path.exists() else {}
    if not meta:
        missing.append("campaign_metadata.json")

    # Pick attempts worth showing: ones that finished, and ones that died at different stages.
    chosen, by_stage = [], {}
    # Show an accepted design as the "survived" example when there is one.
    accepted = {r.get("hash") for r in ranked if r.get("hash")}
    for row in trajectories:
        if row.get("hash") in accepted and not (row.get("terminated") or "").strip():
            by_stage["survived"] = row
            break
    for row in trajectories:
        stage = (row.get("terminated") or "").strip().lower() or "survived"
        if stage not in by_stage:
            by_stage[stage] = row
    for stage in ["survived"] + STAGES:
        if stage in by_stage and len(chosen) < args.attempts:
            chosen.append(by_stage[stage])

    exported = []
    for row in chosen:
        # BC2 v1.0.4: "trajectory" is a counter, "design" is the folder name.
        design = row.get("design") or row.get("hash")
        if not design:
            continue
        folder = root / "1_Trajectories" / design
        losses = read_csv(folder / f"{design}_losses.csv")
        if losses:
            (out / "losses" / f"{design}.json").write_text(json.dumps(thin(losses), separators=(",", ":")))
        else:
            missing.append(f"1_Trajectories/{design}/{design}_losses.csv")
        frames = sorted(folder.glob(f"{design}_*_*_*.cif"), key=frame_order)
        kept = []
        for f in thin(frames, 60):
            dest = out / "frames" / f"{design}__{f.name}"
            dest.write_bytes(f.read_bytes())
            kept.append(dest.name)
        plot = folder / f"{design}_losses.png"
        if plot.exists():
            (out / "plots").mkdir(exist_ok=True)
            (out / "plots" / plot.name).write_bytes(plot.read_bytes())
        if not frames:
            missing.append(f"1_Trajectories/{design}/ per-stage .cif files "
                           "(set save_design_frames and save_design_trajectory true)")
        exported.append({"design": design, "stage_ended": (row.get("terminated") or "").strip(),
                         "frames": kept, "has_losses": bool(losses),
                         "has_plot": plot.exists()})

    structure = residue_table(args.target) if args.target else None
    if args.target and not structure:
        missing.append(str(args.target))
    if structure:
        shutil.copyfile(Path(args.target).expanduser(), out / "target.pdb")
        exp = exposure(Path(args.target).expanduser())
        for r in structure["table"]:
            r["exposure"] = exp.get((r["chain"], r["number"]))

    # Sequence redesign: each finished attempt's own sequence against its MPNN candidates.
    by_design = {}
    for r in refolded:
        m = re.match(r"(.+)_candidate(\d+)$", r.get("design", ""))
        if m:
            by_design.setdefault(m.group(1), []).append(r)
    mpnn = []
    for design, cands in by_design.items():
        traj = root / "1_Trajectories" / design / f"{design}_trajectory.cif"
        seqs = cif_sequences(traj)
        binder = seqs.get("B") or (list(seqs.values())[-1] if seqs else "")
        if not binder:
            missing.append(f"1_Trajectories/{design}/{design}_trajectory.cif")
        mpnn.append({"design": design, "original": binder,
                     "candidates": sorted(cands, key=lambda r: int(re.search(r"(\d+)$", r["design"]).group(1)))})
    (out / "mpnn.json").write_text(json.dumps(mpnn, separators=(",", ":")))

    # Structures for the scoring page: every candidate that passed, plus a few that did not,
    # each as the complex and as the binder alone.
    picks = [r for r in refolded if r.get("outcome") == "passed"]
    picks += [r for r in refolded if r.get("outcome") != "passed"][:3]
    scored = []
    for r in picks:
        name = r["design"]
        got = {}
        for kind, sub, suffix in (("complex", "Complexes", ""), ("monomer", "BinderMonomer", "_monomer")):
            src = root / "2_Refolded" / sub / f"{name}{suffix}.cif"
            if src.exists():
                (out / "refolded").mkdir(exist_ok=True)
                shutil.copyfile(src, out / "refolded" / src.name)
                got[kind] = src.name
            else:
                missing.append(f"2_Refolded/{sub}/{src.name}")
        scored.append({"design": name, "outcome": r.get("outcome"), **got})
    (out / "scored.json").write_text(json.dumps(scored, separators=(",", ":")))

    # The accepted designs' structures.
    for src in sorted((root / "3_Ranked").glob("*.cif")):
        (out / "ranked").mkdir(exist_ok=True)
        shutil.copyfile(src, out / "ranked" / src.name)

    # The campaign file as written, for the run page's command line.
    sp = meta.get("settings_path")
    if sp and Path(sp).exists():
        shutil.copyfile(sp, out / "settings.json")
    else:
        missing.append(f"campaign settings file {sp}")

    if args.log:
        log = Path(args.log).expanduser()
        if log.exists():
            shutil.copyfile(log, out / "run.log")
        else:
            missing.append(str(log))

    (out / "trajectories.json").write_text(json.dumps(trajectories, separators=(",", ":")))
    (out / "refolded.json").write_text(json.dumps(refolded, separators=(",", ":")))
    (out / "ranked.json").write_text(json.dumps(ranked, separators=(",", ":")))
    if structure:
        (out / "structure.json").write_text(json.dumps(structure, separators=(",", ":")))

    (out / "campaign.json").write_text(json.dumps({
        "name": args.name,
        "settings": meta.get("settings", meta),
        "funnel": funnel(trajectories, refolded, ranked),
        "attempts_exported": exported,
        "missing": missing,
    }, indent=1))

    print(f"wrote {out}")
    if missing:
        print("missing, so the site will say those parts are not captured:", file=sys.stderr)
        for m in sorted(set(missing)):
            print("  " + m, file=sys.stderr)


if __name__ == "__main__":
    main()
