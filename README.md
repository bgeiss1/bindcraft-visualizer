# BindCraft2 Visualizer (MIP 662)

A static website where students see what a BindCraft2 binder-design campaign actually does.
They read a settings file, type the command, press Run, and get the real screen output of a
campaign we ran on our own GPU server. They then watch one design attempt happen stage by
stage, and read the scores that decide which designs are worth making.

Separate from the Shell Lab practice site and from the GROMACS visualizer. Local only for now.

Targets: **3EVG** (dengue-2 NS5 methyltransferase, shipped both with and without its SAH
cofactor) and **Artibeus jamaicensis IL-15** (a predicted model, added when the structure is
ready). Human PD-L1 is kept as a warm-up because it ships with BindCraft2.

## Pages

| Page | What it covers | What the student changes |
| --- | --- | --- |
| `index.html` | the campaign end to end, with the funnel | links to each page |
| `process.html` | the five design stages, MPNN redesign, re-prediction, filters, ranking | steps through the stages |
| `target.html` | the target and the epitope | clicks residues to build the `hotspots` string |
| `settings.html` | the campaign JSON, as a form and as text | every setting worth editing, with the layer each value came from |
| `run.html` | the command line | the command itself, including `--modality` and `--set` |
| `trajectory.html` | one attempt playing back, with its loss curves | frames, which curves to plot |
| `mpnn.html` | sequence redesign | which candidate to look at |
| `scoring.html` | pLDDT, the PAE matrix, i_pAE, i_pDAE, the filters | the filter thresholds |
| `ranked.html` | the accepted designs | sorting, and comparing two designs |

A page whose data has not been captured yet says so, rather than showing made-up numbers.

## Run it

The pages load their data with `fetch`, so open them through the local server, not by
double-clicking a file.

```
node serve.mjs          # or: npm run serve
```

then open http://localhost:8003/ . Shell Lab uses 8000 and 8001 and the GROMACS visualizer
uses 8002, so all three can run at once. Without Node installed, use VS Code's bundled Node
the same way as for the other sites:

```
ELECTRON_RUN_AS_NODE=1 "/Applications/Visual Studio Code.app/Contents/MacOS/Code" serve.mjs
```

## The dashboard

http://localhost:8003/admin.html is the text dashboard, the same one as the GROMACS site.
Every string on every page lives in `data/text.json`, grouped by page. Edit a box, watch the
preview, press **Save**. The old file is copied into `data/backups/` first. **Publish** commits
the saved text and pushes it, once this folder is a git repo with a remote.

It keeps the same checks: curly-bracket placeholders have to survive an edit, HTML tags have to
balance, and it flags em dashes, semicolons and the words on the avoid list.

`data/targets.json` is the target registry: which targets the site ships, their chains and
default hotspots. A new target is added there, not in the page code.

Open any page with `?showtext` to outline every editable piece of text and see its key.

## Test it

```
npm test
```

179 checks over the parts that compute something: the command parser, the six settings layers,
BindCraft2's start-up refusals, hotspot and chain validation against the real structure, the
metric maths, and the GPU memory formula from BindCraft2's own documentation. The suite also
checks that `data/text.json` is valid and follows the course style rules.

## Capturing a campaign

Nothing on the data-driven pages is invented. To fill them, run a campaign and export it:

1. On the GPU server, run the campaign with these four flags set true, because BindCraft2
   defaults them to false and without them there are no frames to play back:
   `save_design_frames`, `save_design_animations`, `save_loss_plots`, `save_design_trajectory`.
2. Export what the pages need:

```
python3 workflow/export_playback.py \
    --campaign ~/bc2-visualizer-runs/results/3evg_apo \
    --name 3evg_apo \
    --target ~/bc2-visualizer-runs/structures/3evg_apo.pdb \
    --out site-data
```

3. Copy `site-data/3evg_apo/` into `data/3evg_apo/` here, and add the campaign to
   `data/campaigns.json`.

The export script reports anything it could not find, and the site then says that part is not
captured rather than guessing.

## What's where

| Path | What it is |
| --- | --- |
| `*.html`, `css/style.css` | one page per part of a campaign |
| `js/pages/*.js` | each page's logic |
| `js/site.js` | shared: the stages, the filters, the header, the terminal, the text |
| `js/settings.js` | the six settings layers, the defaults, and BindCraft2's start-up checks |
| `js/command.js` | parses a typed `bindcraft` command and complains the way BindCraft2 does |
| `js/funnel.js` | the campaign funnel drawing |
| `js/admin.js` | the text dashboard |
| `data/` | the page text, the target registry, and each captured campaign |
| `workflow/` | the scripts that turn a finished campaign into `data/` |
| `vendor/` | 3Dmol.js, kept locally |

## A note on the licence

BindCraft2 ships under a source-available licence that is not open source and restricts
offering the software, or a service derived from it, to third parties as a hosted or web
offering. This site runs no BindCraft2 code and only replays recorded output, which is a
different thing, but the licence text does not settle it. A public site using the BindCraft2
name wants a read from CSU's technology transfer office or a note to the Pacesa lab first.
Running it locally for a class is not in question.
