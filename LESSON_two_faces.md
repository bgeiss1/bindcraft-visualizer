# Why one face of IL-15 can be designed against and the other cannot

For the MIP662 BindCraft2 visualizer. All three campaigns are finished and every
number below is measured.

Audience: a student who has never chosen a hotspot before.

---

## The setup

IL-15 from the Jamaican fruit bat, 117 residues. We asked BindCraft2 for binders
three times against the same structure, changing only where we pointed it.

| campaign | where we pointed it | designs |
|---|---|---|
| `il15_lesson_unguided` | nowhere, BindCraft2 chose | **41** |
| `il15_lesson_faceA` | Face A | **27** |
| `il15_lesson_faceB` | Face B | **0** |

Each campaign got exactly 200 attempts and the same settings otherwise, so those
three numbers are comparable.

The unguided campaign is the one to look at first. Nobody told it where to bind.
All 41 of its designs landed on Face A, and not one of them touched a single Face B
residue. On average each design contacted 8.8 of the 9 Face A residues and 0.0 of
the 8 Face B residues. Before we ran a single directed campaign, the method had
already chosen.

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

Face B did not produce a poor binder. It produced nothing at all, and where it
stopped is the most informative part of the whole series.

BindCraft2 works in two halves. First it hallucinates a complex: it pushes a
backbone around against the target until the structure prediction says the two
things are bound. Only if that works does it hand the backbone to ProteinMPNN to be
given a real sequence, refold it, and test it against the filters.

| | unguided | Face A | Face B |
|---|---|---|---|
| attempts | 200 | 200 | 200 |
| hallucination succeeded | 61 | 46 | **0** |
| reached ProteinMPNN | 61 | 46 | **0** |
| refolded candidates | 459 | 346 | **0** |
| designs accepted | 41 | 27 | **0** |

Face B never got out of the first half. Not one of its 200 attempts reached
sequence design, which means **not one of our filters ever ran on a Face B
design**. There was nothing to filter.

Where it stopped, and on what:

| Face B attempts dropped at | |
|---|---|
| anneal stage | 151 |
| screen stage | 26 |
| refine stage | 12 |
| harden stage | 3 |
| mutate stage | 3 |

The metric named in the rejection is almost always `i_pTM`, the model's own
confidence that the two chains are actually in contact. Compare the medians:

| median design-stage i_pTM | unguided | Face A | Face B |
|---|---|---|---|
| at the screen stage | 0.80 | 0.77 | **0.11** |
| at the anneal stage | 0.83 | 0.81 | **0.14** |

Face B's whole range is 0.06 to 0.23. That is worth sitting with. It is not a near
miss against a bar we set too high. An i_pTM of 0.1 is the model saying there is no
interface here at all. The optimiser spent 200 attempts and fifty design steps each
and never once built something the predictor would call a complex.

This is why the physical measurements matter more than the filter settings. You
could lower every threshold in the campaign file to zero and Face B would still
give you nothing, because the failure happens before any threshold is consulted.

One more number from the same series, because it is a useful surprise. The unguided
campaign got **41** designs and the Face A campaign got **27**, on the same face.
Naming hotspots cost us a third of the yield. The unguided run was free to settle on
whichever corner of Face A came easiest, while the Face A run also had to contact at
least half the named residues and stay off the eight Face B coldspots. A hotspot set
is a constraint, and it costs something even when you have picked the right face.

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

One last thing, once you have chosen. Name as few hotspots as will do the job.
Every residue you name is a constraint the optimiser has to satisfy, and our two
Face A campaigns show the price: pointed at the face, it found 27 designs, and left
alone on the same protein it found 41. If you already know the face, consider
running unguided and reading off where it goes.
