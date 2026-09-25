# Redirects

Redirects is an Obsidian plugin for stable, frontmatter-driven note redirects
and explicit disambiguation pages.

## Direction

Redirect stubs keep their own path and point at a canonical target:

```yaml
---
redirect_to: "[[Mathematics#Vector]]"
---
```

Canonical notes can declare the inverse relationship, so redirects are
verifiable rather than implicit aliases:

```yaml
---
redirects_from:
  - "[[Legacy/vector]]"
---
```

When a title legitimately has multiple targets, a note can instead be a
disambiguation page — an ordinary note whose `disambiguates` list is tracked
and health-checked (a broken or ambiguous candidate is flagged), but which
otherwise opens and navigates like any other note:

```yaml
---
disambiguates:
  - "[[Mathematics#Vector]]"
  - "[[Physics#Vector]]"
  - "[[Programming/Vector]]"
---
```

A canonical note can also proactively claim an unqualified term before
anyone links to it, so a bare `[[R package]]` gets path-qualified the moment
it's typed rather than resolving through a coincidental alias or becoming a
dead link:

```yaml
---
swallows:
  - "R package"
---
```

The plugin will never move, delete, or silently rewrite notes to follow a
redirect, and it never picks a destination on your behalf — every ambiguous
case (a duplicate `swallows` claim, a promotable unresolved link, a
heading/note collision) surfaces an explicit chooser or a health-report
diagnostic instead.

## What it does

- **Redirect navigation** — opening a `redirect_to` stub routes to its exact
  target (note, heading, or block); a cycle or broken target shows a warning
  and leaves you on the stub instead of guessing. The stub itself stays
  reachable via the file menu's "Open without following redirect" and the
  "Open original redirect stub" command.
- **Reciprocal auto-sync** — a stub's `redirect_to` is the only source of
  truth needed for its canonical note's `redirects_from` entry, so a missing
  one is added automatically after every save, with a summary Notice — no
  command to remember to run. Turn this off with the "Auto-sync missing
  reciprocal declarations" setting if you'd rather apply it yourself; either
  way, a missing (or stale) reciprocal also gets a one-click "Fix" button
  right in the health report — pressing it *is* the confirmation, since the
  report already showed what it claims and why. A *stale* reciprocal (one
  that no longer matches reality) is never auto-applied even with the
  setting on: removing text based on a guess at intent risks discarding a
  typo the user meant to fix, not delete, so it always takes the "Fix"
  button or the "Repair a reciprocal redirect declaration" command.
- **Authoring commands** — "Create redirect stub", "Add disambiguation
  candidate", "Insert path-qualified link…", and "Repair a reciprocal redirect
  declaration" all pick targets by full vault-relative path and preview every
  frontmatter change before writing it.
- **Promotable unresolved links** ("Show promotable unresolved links") —
  surfaces an unresolved link referenced by several distinct notes as a cue
  to create a note, a redirect, or a disambiguation page, or to dismiss it.
  Nothing is created automatically.
- **Heading/note collisions** ("Show heading / note collisions") — flags a
  heading whose text matches an existing note's title or alias, and lets you
  link it to that note, register it as an intentionally local section, or
  dismiss it.
- **Swallow-claim fix-on-save** — after every save, a note's unresolved links
  are checked against `swallows` claims (the same cache the promotable-links
  cue reads); an unambiguous, non-conflicting match is qualified immediately
  to `[[canonical|Term]]` with a one-line summary Notice, linter-autofix
  style — declaring the claim is itself the authorization, so there's no
  judgment call left once a match is unambiguous. A duplicate claim still
  opens a chooser, a term colliding with a real note's exact name is never
  overridden, and a term that's already an alias on some other, unrelated
  note still shows a consolidate/proceed/cancel dialog. Declaring a **new**
  claim is treated differently: since it can retroactively affect every
  existing matching link vault-wide, it previews every affected file and
  asks for confirmation before touching any of them, the same as every other
  mutation in this plugin — only a link created *after* that point is fixed
  silently.
- **Health report** ("Show redirect health report") — broken targets,
  redirect cycles/chains, missing or stale reciprocal declarations (a missing
  one is normally transient, since it's auto-synced shortly after the save
  that caused it), and invalid/duplicate/stale `swallows` claims (including a
  claim that conflicts with an existing alias elsewhere), all in one
  read-only view.

*A `disambiguates` note doesn't need an active chooser to be an explicit
choice — it already is one, the same way any hand-written landing page with
a few links is. An interactive chooser (fuzzy search over its candidates on
open) is fully implemented in `src/navigation/` but intentionally not wired
into the plugin; re-enabling it is a two-line change in `src/main.ts` if
that judgment call changes.*

## Settings

- **Auto-sync missing reciprocal declarations** — add a missing
  `redirects_from` entry automatically after every save (default on). Off
  just means applying it yourself, via the health report's "Fix" button or
  the "Repair a reciprocal redirect declaration" command — the check itself
  always runs either way.
- **Promotable link threshold** — minimum distinct source notes before an
  unresolved link is surfaced (default 2).
- **Ignored folders** — vault-relative folders excluded from the
  promotable-links and swallow-claim scans (e.g. templates).

## Privacy and compatibility

Redirects is fully offline: it never makes a network request and never sends
vault content anywhere. All state is derived from Obsidian's own metadata
cache at read time (plus a small local settings file for dismissed cues), and
it is rebuilt from scratch on every relevant vault change — nothing is
cached to disk beyond that.

It coexists with Obsidian's own link resolver and with alias- or
filename-uniqueness plugins: `swallows` only intercepts a genuinely bare,
unqualified `[[Term]]` as it's typed, takes precedence over an alias but
never overrides an existing note's exact filename, and every other resolution
path (headings, blocks, ambiguous names) still goes through Obsidian's normal
behavior. Redirects does not replace aliases and never rewrites existing
links in bulk — every mutation is a single, explicit, previewed action.

## Manual test matrix

Automated coverage lives in `src/**/*.test.ts` (`npm test`), including a
fixture-vault scenario (`src/registry/fixture-vault.test.ts`) exercising
aliases, a duplicate title, a redirect chain and cycle, a broken fragment, a
promotion candidate, and a swallow claim together. Before a release, also
check by hand, on both desktop and mobile:

| Scenario | Desktop | Mobile |
| --- | --- | --- |
| Open a `redirect_to` stub → lands on the exact heading/block | ☐ | ☐ |
| Open a stub that cycles → warning, stays on the stub | ☐ | ☐ |
| "Open without following redirect" from the file menu | ☐ | ☐ |
| "Create redirect stub" end-to-end, then verify the reciprocal | ☐ | ☐ |
| Manually add `redirect_to` to a note (no reciprocal yet), save → the target note gets `redirects_from` automatically | ☐ | ☐ |
| Turn off "Auto-sync missing reciprocal declarations", repeat → no auto-add, but the health report shows the issue with a "Fix" button that applies it on click | ☐ | ☐ |
| A stale reciprocal's "Fix" button in the health report removes exactly that entry | ☐ | ☐ |
| Save a note with a bare `[[Term]]` matching an already-established `swallows` claim → qualified silently, no dialog | ☐ | ☐ |
| Add a *new* `swallows` claim to a note that already has other notes linking to that term → preview/confirm dialog listing every affected file, then applied on confirm | ☐ | ☐ |
| Decline that new-claim dialog, then save the same claim-owning file again → dialog does not reappear | ☐ | ☐ |
| Save a note with a bare `[[Term]]` matching two `swallows` claims → chooser; cancel it, save again → chooser does not reappear | ☐ | ☐ |
| Save a note with a bare `[[Term]]` matching a claim that's also an alias elsewhere → consolidate/proceed/cancel dialog | ☐ | ☐ |
| Rename/move a canonical note → `redirect_to`/`redirects_from` still resolve | ☐ | ☐ |
| "Show redirect health report" reflects a freshly broken target | ☐ | ☐ |

## Development

```sh
npm install
npm run dev
```

Run `npm run build`, `npm run lint`, and `npm test` before release.
