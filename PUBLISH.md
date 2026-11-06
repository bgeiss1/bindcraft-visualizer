# Putting this site on GitHub Pages

Same setup as the GROMACS and RFD4 visualizers: a repo, Pages served by GitHub Actions, and
only the student pages published. The dashboard stays on your machine.

## Read this first: the BindCraft2 licence

BindCraft2 is **not** MIT. It ships under the "BindCraft2 Source-Available License
(Hosting-Restricted)", which bars providing the software, a modified version, or *a service
whose material functionality is provided by or derived from it* to third parties as a hosted
or web application. That is why RFD4 was straightforward to publish and this one needs a
moment's thought.

My reading is that **this site is fine to publish**, for three reasons:

1. It ships no BindCraft2 code and no model weights. Checked: the only Python in the repo is
   `workflow/export_playback.py` and `workflow/register_campaign.py`, both written for this
   project, and the only vendored library is 3Dmol.
2. It does not run BindCraft2 or expose any of its functionality. A student cannot design a
   binder with it. It replays recordings of campaigns that were already run on UncleBen.
3. The licence names this case explicitly: "the provision of design outputs (for example
   designed binders, sequences, or structures) are not Hosted Services and require no
   commercial license." Sequences, structures, metrics and logs are exactly what `data/` holds.

Two cautions that follow from the licence's naming clause, which allows accurate statements
that a work is "based on, derived from, or compatible with BindCraft2" but not names that imply
equivalent functionality or official association:

- Keep the site clearly described as a teaching site that replays recorded runs, not as
  BindCraft2 or as a way to run it.
- Credit the authors and note the trademark. `index.html` should carry a line like:
  *Recordings of BindCraft2 v1.0.4 runs. BindCraft2 is © 2026 Martin Pacesa, University of
  Zurich and contributors, and is a trademark of the University of Zurich. This teaching site
  is unaffiliated and does not run or redistribute BindCraft2.*

I am not a lawyer and this is not legal advice. If you would rather not make the judgement
call, two safer options: keep the repo **private** and share the built site another way, or
publish only the derived JSON and drop the raw `run.log` files, which are BC2's own stdout.

## Publishing

The workflow file is already in place at `.github/workflows/pages.yml`, so there is no
by-hand step this time.

```bash
cd ~/Desktop/Code/MIP662_practice_tool/bindcraft-visualizer

# check it builds and passes before anything goes public
ELECTRON_RUN_AS_NODE=1 "/Applications/Visual Studio Code.app/Contents/MacOS/Code" tests/run.mjs
NOINDEX=1 bash tools/build_pages.sh _site

git init -b main
git config user.name "Brian Geiss"
git config user.email "128843394+bgeiss1@users.noreply.github.com"
git add -A
git commit -m "BindCraft2 Visualizer: teaching site replaying real binder design campaigns"
gh repo create bgeiss1/bindcraft-visualizer --public --source=. --remote=origin --push
gh api -X POST repos/bgeiss1/bindcraft-visualizer/pages -f build_type=workflow
```

For a private repo instead, swap `--public` for `--private`. Note that Pages from a private
repo needs a paid GitHub plan; on a free plan the site would not be served.

If the last line complains that Pages already exists, set it in the web interface instead:
**Settings, then Pages, then Source: GitHub Actions**.

The site then lands at <https://bgeiss1.github.io/bindcraft-visualizer/>, usually a minute or
two after the Actions run goes green.

## What gets published and what does not

`tools/build_pages.sh` copies the nine student pages, the CSS, the JavaScript, the vendored
3Dmol, every JSON in `data/`, and the folder of each campaign registered in
`data/campaigns.json`. It leaves out `admin.html`, `js/admin.js`, `serve.mjs`, the tests, the
capture scripts and the backups. Checked on the built output: `admin.html` and `js/admin.js`
are both absent.

The build is currently **98 MB** across 512 files, which is within Pages' limits but not
small. 69 MB of that is the `3evg_apo` campaign, which yielded one accepted design out of
forty and has been superseded by the IL-15 pair as teaching material. Dropping it from
`data/campaigns.json` would cut the site to about 29 MB.

Every page already carries `<meta name="robots" content="noindex">` in its source, and
`NOINDEX=1` adds a second `noindex, nofollow` at build time. So the site is reachable by link
but not listed by search engines, twice over. To have it indexed at launch, remove the meta
from the page sources *and* drop `NOINDEX=1` from the workflow.

## Afterwards

The dashboard's **Publish** button runs `git commit` and `git push` from this folder, so once
the remote exists, editing text in the dashboard and pressing Publish updates the live site.

## The Desktop app

`bash tools/make_app.sh` builds "BindCraft2 Dashboard.app" on the Desktop. Double clicking it
starts the local server on port 8003 if it is not already running and opens `admin.html`. Run
the script again after moving the site folder; the app stores the path it was built with and
says so plainly if the folder has moved rather than failing silently.
