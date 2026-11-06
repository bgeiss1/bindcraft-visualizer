# Why one face of IL-15 can be designed against and the other cannot

Draft for the MIP662 BindCraft2 visualizer. Structural numbers are final.
Anything marked `[PENDING]` waits on the three `il15_lesson_*` campaigns.

Audience: a student who has never chosen a hotspot before.

---

## The setup

IL-15 from the Jamaican fruit bat, 117 residues. We asked BindCraft2 for binders
three times against the same structure, changing only where we pointed it.

| campaign | where we pointed it | designs |
|---|---|---|
| `il15_lesson_unguided` | nowhere, BindCraft2 chose | `[PENDING]` |
| `il15_lesson_faceA` | Face A | `[PENDING]` |
| `il15_lesson_faceB` | Face B | `[PENDING]` |

Face A is `Tyr43 Lys58 Leu62 Glu63 His65 Val66 Lys88 Glu104 Glu106`.
Face B is `Asp21 Ser24 Asp25 Lys27 Ala28 His122 Gln125 Ile128`.

Both are on the surface. Both are the same size. One works and one does not.

## The short answer

A binder needs something to grip. Face A gives it a greasy patch sitting in a
dip. Face B is a smooth, wet bulge. That is the whole lesson, and everything
below is the measurement behind it.

### 1. Grease, and especially a ring

Count only the genuinely water-hating residues, which are Leu, Ile, Val, Phe,
Met, Trp, Tyr, Ala and Pro. Then measure how much of their surface is actually
exposed.

| | Face A | Face B |
|---|---|---|
| exposed water-hating area per hotspot | **28.2 A2** | **12.5 A2** |
| which residues | Tyr43, Leu62, Val66 | Ala28, Ile128 |
| aromatic rings | Tyr43 | **none** |
| biggest connected greasy patch | 189 A2 | 138 A2 |

Face A has more than twice the greasy area per residue, and it has a tyrosine.
A flat aromatic ring is the single most useful thing a designed binder can pack
against, because it is large, rigid and gives up no entropy when it is covered.
Face B has no ring at all. Its two water-hating residues are an alanine, which
is barely more than a bump, and one isoleucine.

A warning about measuring this. If you simply add up the non-polar surface, you
will get the wrong answer, because the long arms of Lys, Arg and Glu are
non-polar for most of their length. By that bad measure Face B looks *better*
than Face A. Count whole residues by identity instead.

### 2. Shape, which is to say somewhere to sit

Fit a sphere to each surface patch and ask which way it curves.

| | Face A | Face B |
|---|---|---|
| curvature | **concave, a dip** | **convex, a bulge** |
| fitted radius | 9.7 A | 9.6 A |

The radius is nearly the same. The sign is not. A dip wraps part way around
whatever lands in it, so a binder gets contact on several sides at once. A bulge
is the opposite: a binder can only lie on top of it and touch it in one plane.

Why they differ is worth seeing in the structure. Face A spans three different
pieces of the fold, a strand edge at Tyr43, then a helix, then a turn. Wherever
secondary structure elements meet, the surface has relief, and relief is what
makes a groove. Face B is the exposed stripe of two helices lying side by side.
Residues 21, 24, 25, 27 and 28 are one helical face, and 122, 125 and 128 are
another. A helix surface is a smooth cylinder, and two of them together is still
smooth. There is nothing to grip.

## Three answers that sound right and are wrong

Students reliably guess these, so it is worth knowing they are not the problem
here. Each one is measured on the same two faces.

**"The hotspots are scattered, so no binder can reach them all."**
This is a real failure mode, and it is worth checking first, but it is not what
happened. It is in fact backwards. Face B is one connected patch. Face A comes
in **two pieces**, `43 58 62 63 65 66 88` and `104 106`, as much as 18.9 A
apart, and Face A is the one that works. BindCraft2 was only asked to touch half
the named hotspots, which a binder can manage across a split set.

**"Face B is too charged."**
Both faces carry a net charge of exactly **-1**. If anything Face A is the more
charged surface, with 55 percent of its area on charged residues against 36
percent for Face B. Net charge did not decide this.

There is a subtler charge story, though. On Face B the opposite charges sit
**5.1 A** apart, against 10.5 A on Face A. Face B's acids and bases are already
paired with each other. A charge that has found a partner has nothing left to
offer a binder.

**"Face B is a floppy loop."**
The opposite. By DSSP, Face B is **100 percent helix**. Face A is 67 percent
helix, 11 percent strand and 22 percent turn. The face that failed is the more
rigid and the more regular of the two.

## What BindCraft2 itself showed

`[PENDING: the funnel. Which stage Face B designs died at, the filter named in
the rejection, and the i_pTM and interface residue counts at that stage, set
against the same numbers for Face A. Fill from the 1_Trajectories logs and
2_Refolded tables once all three campaigns reach 200 trajectories.]`

## What to look for next time

Before you commit a campaign to a face, in this order:

1. **Is every residue exposed?** A buried residue cannot be touched. The
   exposure bars on the target page answer this.
2. **Can one binder reach them?** Check the spread. A split set is survivable,
   a set spread over opposite ends of the protein is not.
3. **Is there exposed grease, and is there a ring?** This is the measurement
   that predicted both outcomes here. Above about 20 A2 per residue is
   workable, around 10 is marginal, below 8 is not worth the GPU time. A Tyr,
   Trp or Phe in the set is worth more than its area suggests.
4. **Does the surface curve inward anywhere?** Prefer a dip, a groove or the
   seam where two secondary structure elements meet. Avoid the open face of a
   lone helix or a pair of them.
5. **Only then look at charge**, and look at the pattern rather than the total.
   Unpaired charges are an opportunity, self-paired ones are not.

The honest summary is that points 3 and 4 did the work here, and points 1, 2 and
5 would all have told you Face B was fine.
