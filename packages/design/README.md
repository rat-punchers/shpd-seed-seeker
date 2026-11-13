# Design system

`@seed-seeker/design`: Seed Seeker's shadcn/ui components and Tailwind CSS v4
tokens, with a React + Vite preview app that shows every rule in use. The
package exports raw TypeScript; `web-v2` imports it by name.

- [`DESIGN.md`](DESIGN.md): the spec (principles, color, type, shape, motion,
  components, voice, use in the app).
- [`src/theme/theme.css`](src/theme/theme.css): the tokens. Import it as
  `@seed-seeker/design/theme.css`.
- `src/components/ui/`: shadcn components (`radix-lyra`) restyled to the
  tokens. Import as `@seed-seeker/design/ui/<name>`.
- `src/components/spd/`: game pieces (sprite, item slot, floor banner,
  descent rail, floor report). Import as `@seed-seeker/design/spd/<name>`.
- `src/lib/utils.ts`: `cn()`, the one class merger, with the theme's custom
  scales registered. Import as `@seed-seeker/design/utils`.
- `src/preview/`: the preview page sections. Sample data only; the preview
  never runs the engine.

Files inside the package import each other by relative path, so a consumer's
own path aliases never apply to them.

## Run the preview

From the repository root:

```bash
bun install
bun run dev:design                          # http://localhost:46002
bun run --filter @seed-seeker/design build  # build to packages/design/dist
```

The theme switch in the top bar flips between Limestone (light) and Torchlit
(dark) and is remembered in `localStorage`.

## Assets

`public/sprites/`, `public/interfaces/` (`icons.png`, `chrome.png` from
v4.0.2) and `src/theme/fonts/pixel_font.ttf` are copies of Shattered Pixel
Dungeon assets (GPL-3.0 game, Apache-2.0 font). `public/textures/` holds
crops of the game's region tilesets: the floor strips, and
`alchemy_pots.png`, the raised alchemy pot (tile 232 over tile 120, rows
12–31) of the sewers, prison, caves, city and halls in that order.
`public/textures/` holds 128×32 floor strips cut from each region's
`tiles_*.png` (floor tile plus its two decorated variants).
