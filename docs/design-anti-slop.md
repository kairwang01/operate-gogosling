# Anti–AI-slop design notes (Go!Gosling marketing site)

Reference: [Sailop — 7 dimensions of generic design](https://sailop.com/blog/what-is-ai-slop-7-dimensions-of-generic-design), [Developers Digest — 15 patterns](https://www.developersdigest.tech/blog/ai-design-slop-and-how-to-spot-it).

## What we avoid

- Purple/blue hero washes, gradient text, glassmorphism float cards
- Identical 3-column icon feature grids with hover lift
- Pill badges + pulse dots + uppercase tracked eyebrows
- Inter-weight-700 display type and glowing primary buttons
- Multiple unrelated section templates on one page

## What we use instead

- **One primitive:** bordered row groups (iOS Settings / product index lists)
- **Flat surfaces:** hairline borders, minimal shadow, 18px card radius
- **SF system stack**, display weight **600**, sentence-case labels
- **Mascot-led hero** without float animation or radial glow
- **Left-aligned** subpage section intros

## Files

- Tokens: `assets/css/tokens.css`
- Components: `assets/css/components.css`
- Layout: `assets/css/site.css`
