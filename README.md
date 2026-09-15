# Redirects

Redirects is an Obsidian plugin for stable, frontmatter-driven note redirects
and explicit disambiguation pages.

## Direction

Redirect stubs keep their own path and point at a canonical target:

```yaml
---
redirect_to: "Mathematics#Vector"
---
```

Canonical notes can declare the inverse relationship, so redirects are
verifiable rather than implicit aliases:

```yaml
---
redirects_from:
  - "Legacy/vector"
---
```

When a title legitimately has multiple targets, a note can instead be a
disambiguation page:

```yaml
---
disambiguates:
  - "Mathematics#Vector"
  - "Physics#Vector"
  - "Programming/Vector"
---
```

The plugin will never move, delete, or silently rewrite notes to follow a
redirect.

## Development

```sh
npm install
npm run dev
```

Run `npm run build` and `npm run lint` before release.
