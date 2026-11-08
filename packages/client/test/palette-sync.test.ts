import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { palette } from '../src/palette.ts';

// Palette key -> the Role cell text of its row in the ART_STYLE.md Palette table.
const roles: Record<keyof typeof palette, string> = {
  space: 'Space background',
  starDim: 'Dim star',
  starBright: 'Bright star / UI text',
  probe: 'Probe (player core)',
  probeGlow: 'Probe glow',
  asteroid: 'Asteroid rock',
  asteroidOre: 'Ore / resources / routes',
  ship: 'Player ships',
  mob: 'Mobs',
  mobGlow: 'Mob glow',
  route: 'Route line',
  bloom: 'Bloom body (alive)',
  bloomHi: 'Bloom highlight / core',
  bloomGlow: 'Bloom glow',
  withered: 'Withered Bloom rock (captured)',
  witheredDark: 'Withered Bloom outline (outline only, low contrast)',
  thorn: 'Thorn',
  thornCore: 'Thorn core',
  routeBackedUp: 'Backed-up route',
  flash: 'Hit flash',
  rootRock: 'Root rock fill (low contrast; always drawn with an edge)',
  rootRockEdge: 'Root rock edge (5:1)',
  vine: 'Vine (alive)',
  vinePulse: 'Vine pulse',
  spore: 'Spore',
  sporeGlow: 'Spore glow',
  ice: 'Ice icon',
  crystal: 'Crystal icon',
  plating: 'Plating icon',
};

function tableRows(): Map<string, string> {
  const md = readFileSync(new URL('../../../ART_STYLE.md', import.meta.url), 'utf8');
  const lines = md.split(/\r?\n/);
  const start = lines.findIndex((l) => /^##\s+Palette\s*$/.test(l));
  expect(start, 'ART_STYLE.md has no "## Palette" heading').toBeGreaterThanOrEqual(0);
  const rows = new Map<string, string>();
  for (const line of lines.slice(start + 1)) {
    if (/^##\s/.test(line)) break;
    const m = /^\|\s*(.+?)\s*\|\s*`(.+?)`\s*\|\s*$/.exec(line);
    if (m) rows.set(m[1]!, m[2]!);
  }
  return rows;
}

describe('ART_STYLE.md palette table matches palette.ts', () => {
  const rows = tableRows();
  for (const [key, value] of Object.entries(palette)) {
    it(key, () => {
      const role = roles[key as keyof typeof palette];
      expect(role, `palette key "${key}" has no role mapped in palette-sync.test.ts`).toBeDefined();
      const cell = rows.get(role);
      expect(cell, `palette key "${key}" (${value}): no row "${role}" in the ART_STYLE.md Palette table`).toBeDefined();
      expect(cell, `palette key "${key}": palette.ts has ${value} but ART_STYLE.md row "${role}" has ${cell}`).toBe(value);
    });
  }
});

function lum(hex: string): number {
  const ch = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

describe('palette contrast against space', () => {
  // Documented in ART_STYLE.md as low contrast: drawn only as outline or beside a high-contrast edge.
  const lowContrastAllowed = new Set(['starDim', 'witheredDark', 'rootRock']);
  for (const [key, value] of Object.entries(palette)) {
    if (!value.startsWith('#') || key === 'space' || lowContrastAllowed.has(key)) continue;
    it(`${key} reaches 4.5:1`, () => {
      expect(contrast(value, palette.space), `${key} ${value}`).toBeGreaterThanOrEqual(4.5);
    });
  }
});
