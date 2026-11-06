#!/usr/bin/env python3
"""Add a copied campaign export to data/campaigns.json, so the pages pick it up.

    python3 workflow/register_campaign.py 3evg_apo

Run it from the site folder after copying site-data/<name>/ into data/<name>/. Each page
part is switched on only when the files it needs are really there.
"""
import json, sys
from pathlib import Path

site = Path(__file__).resolve().parent.parent
for name in sys.argv[1:]:
    d = site / "data" / name
    meta = json.loads((d / "campaign.json").read_text())
    settings = meta.get("settings", {})
    has = lambda p: (d / p).exists() and (not (d / p).is_dir() or any((d / p).iterdir()))
    ranked = json.loads((d / "ranked.json").read_text()) if has("ranked.json") else []
    entry = {
        "name": name,
        "dir": f"data/{name}",
        "file": f"settings/{name}.json",
        "target": name,
        "funnel": meta.get("funnel"),
        "settings": settings,
        "target_residues": len(json.loads((d / "structure.json").read_text())["table"]) if has("structure.json") else None,
        "trajectory": any(a.get("frames") for a in meta.get("attempts_exported", [])),
        "mpnn": has("mpnn.json") and bool(json.loads((d / "mpnn.json").read_text())),
        "scoring": has("scored.json") and has("refolded"),
        "ranked": has("ranked.json"),
        "accepted": len(ranked),
        "target_ready": has("target.pdb") and has("structure.json"),
    }
    entry["target"] = name if entry.pop("target_ready") else None
    if has("settings.json"):
        entry["json"] = json.loads((d / "settings.json").read_text())

    # The real screen output, so the run page can replay it for this exact command.
    if has("run.log"):
        lines = (d / "run.log").read_text().rstrip("\n").split("\n")
        if len(lines) > 90:
            lines = lines[:60] + [f"  ... {len(lines) - 90} lines cut here ..."] + lines[-30:]
        rpath = site / "data" / "recorded.json"
        rec = json.loads(rpath.read_text()) if rpath.exists() else {}
        rec[name] = {"file": f"settings/{name}.json", "overrides": {}, "campaign": name,
                     "command": f"bindcraft design settings/{name}.json",
                     "what": "the full campaign, as we ran it", "log": lines}
        rpath.write_text(json.dumps(rec, indent=1) + "\n")

    path = site / "data" / "campaigns.json"
    all_ = json.loads(path.read_text()) if path.exists() else {}
    all_[name] = entry
    path.write_text(json.dumps(all_, indent=1) + "\n")

    # The target registry says which targets have a structure to show.
    tpath = site / "data" / "targets.json"
    targets = json.loads(tpath.read_text())
    if name in targets and entry["target"]:
        targets[name]["ready"] = True
        tpath.write_text(json.dumps(targets, indent=1) + "\n")
    print(f"{name}: " + ", ".join(k for k in ("target", "trajectory", "mpnn", "scoring", "ranked") if entry[k]))
