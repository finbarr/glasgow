// Recognisable neighbours of Central Station that replace procedural lots.
import { buildRectBuilding } from '../city/buildings.js';
import { cornerTurret } from '../city/facade.js';

const near = (a, b, tol = 3) => Math.abs(a - b) < tol;

export function landmarkOverrides() {
  const used = new Set();
  return [
    {
      // Ca' d'Oro (1872): Venetian-style cast-iron palazzo on the corner of
      // Gordon Street and Union Street, facing the station across Union St.
      name: "Ca' d'Oro",
      test: (r, lot) => !used.has('cadoro') && lot.cornerAt && near(lot.cornerAt[0], 88) && near(lot.cornerAt[1], -129),
      build: (ctx, r, lot) => {
        used.add('cadoro');
        buildRectBuilding(ctx, r, lot.fronts, {
          style: 'warehouse', stone: 'ironCream', tint: [1, 0.97, 0.9], groundStone: 'granite',
          ground: 'arcade', arcadeW: 4.0, groundH: 5.6, floorH: 4.2, nUpper: 3, bayW: 2.4, winW: 1.7, winH: 0.7,
          frame: 'dark', roof: 'mansard', cornice: true, corniceScale: 1.3, parapet: 0.5,
        });
      },
    },
    {
      // Grosvenor Building, Gordon Street: blond sandstone with the
      // Edwardian domed upper storeys, opposite the station entrance.
      name: 'Grosvenor Building',
      test: (r, lot) => !used.has('grosvenor') && lot.fronts.s && !lot.cornerAt && near(r.z1, -151, 2) && (r.x0 + r.x1) / 2 > -5 && (r.x0 + r.x1) / 2 < 45,
      build: (ctx, r, lot) => {
        used.add('grosvenor');
        const res = buildRectBuilding(ctx, r, lot.fronts, {
          style: 'rich', stone: 'stoneBlond', tint: [1.08, 1.03, 0.95], ground: 'shops', groundH: 5.2, floorH: 3.9, nUpper: 6,
          bayW: 3.1, roof: 'mansard', surrounds: true, pediments: true, corniceScale: 1.4,
        });
        ctx.batch.setColor(1.08, 1.03, 0.95);
        for (const x of [r.x0 + 3, r.x1 - 3]) cornerTurret(ctx, x, r.z1 - 3, res.top - 3, res.top + 3.5, 2.6, 'stoneBlond', 'copper');
        ctx.batch.resetColor();
      },
    },
  ];
}
