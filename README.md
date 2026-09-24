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
disambiguation page:

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
case (a disambiguation choice, a duplicate `swallows` claim, a promotable
unresolved link, a heading/note collision) surfaces an explicit chooser or a
health-report diagnostic instead.

## What it does

- **Redirect navigation** — opening a `redirect_to` stub routes to its exact
  target (note, heading, or block); a cycle or broken target shows a warning
  and leaves you on the stub instead of guessing. The stub itself stays
  reachable via the file menu's "Open without following redirect" and the
  "Open original redirect stub" command.
- **Disambiguation chooser** — opening a `disambiguates` note shows a
  fuzzy-searchable chooser over its candidates; dismissing it just leaves you
  on the disambiguation page.
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
- **Swallow-claim enforcement** — a bare `[[Term]]` link is checked the
  instant it's closed; an unambiguous `swallows` claim rewrites it in place to
  a path-qualified `[[canonical|Term]]` (one undo step reverts it), a
  duplicate claim opens a chooser, and a term that collides with a real
  note's exact name is never overridden. If the term is already an alias on
  some other, unrelated note, a dialog asks whether to consolidate (remove
  that alias) before proceeding, proceed without touching it, or cancel —
  the claim never silently competes with an existing alias.
- **Health report** ("Show redirect health report") — broken targets,
  redirect cycles/chains, missing or stale reciprocal declarations, and
  invalid/duplicate/stale `swallows` claims (including a claim that
  conflicts with an existing alias elsewhere), all in one read-only view.

## Settings

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
| Open a `disambiguates` note → chooser appears; Escape leaves it open | ☐ | ☐ |
| "Create redirect stub" end-to-end, then verify the reciprocal | ☐ | ☐ |
| Type a bare `[[Term]]` matching one `swallows` claim → auto-qualified | ☐ | ☐ |
| Type a bare `[[Term]]` matching two `swallows` claims → chooser | ☐ | ☐ |
| Type a bare `[[Term]]` matching a claim that's also an alias elsewhere → consolidate/proceed/cancel dialog | ☐ | ☐ |
| Rename/move a canonical note → `redirect_to`/`redirects_from` still resolve | ☐ | ☐ |
| "Show redirect health report" reflects a freshly broken target | ☐ | ☐ |

## Development

```sh
npm install
npm run dev
```

Run `npm run build`, `npm run lint`, and `npm test` before release.
