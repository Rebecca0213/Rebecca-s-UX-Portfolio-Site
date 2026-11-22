// Every asset is its own module, loaded on demand: `buildings/MaisonMacaron` -> ./buildings/MaisonMacaron.js.
// Each module's default export is `build(ctx, options) -> THREE.Object3D`.
const MODULES = {
  './buildings/BlueBookshop.js': () => import('./buildings/BlueBookshop.js'),
  './buildings/ButterHouse.js': () => import('./buildings/ButterHouse.js'),
  './buildings/GrandSalon.js': () => import('./buildings/GrandSalon.js'),
  './buildings/LaDouceur.js': () => import('./buildings/LaDouceur.js'),
  './buildings/MacaronKiosk.js': () => import('./buildings/MacaronKiosk.js'),
  './buildings/MaisonMacaron.js': () => import('./buildings/MaisonMacaron.js'),
  './buildings/PeachHouse.js': () => import('./buildings/PeachHouse.js'),
  './buildings/RabbitCake.js': () => import('./buildings/RabbitCake.js'),
  './buildings/RoseTurretHouse.js': () => import('./buildings/RoseTurretHouse.js'),
  './buildings/SageDutchHouse.js': () => import('./buildings/SageDutchHouse.js'),
  './buildings/SweetTreatsKiosk.js': () => import('./buildings/SweetTreatsKiosk.js'),
  './buildings/WisteriaHouse.js': () => import('./buildings/WisteriaHouse.js'),
  './dev/BedSet.js': () => import('./dev/BedSet.js'),
  './dev/HorseStudy.js': () => import('./dev/HorseStudy.js'),
  './dev/KitTest.js': () => import('./dev/KitTest.js'),
  './dev/MaterialSwatches.js': () => import('./dev/MaterialSwatches.js'),
  './dev/TopiarySet.js': () => import('./dev/TopiarySet.js'),
  './landmarks/Carousel.js': () => import('./landmarks/Carousel.js'),
  './landmarks/FerrisWheel.js': () => import('./landmarks/FerrisWheel.js?v=spokes1'),
  './landmarks/Fountain.js': () => import('./landmarks/Fountain.js'),
  './landmarks/Gazebo.js': () => import('./landmarks/Gazebo.js'),
  './landmarks/MacaronTower.js': () => import('./landmarks/MacaronTower.js'),
  './landmarks/PinkCastle.js': () => import('./landmarks/PinkCastle.js'),
  './nature/CherryBlossomTree.js': () => import('./nature/CherryBlossomTree.js'),
  './nature/Cloud.js': () => import('./nature/Cloud.js'),
  './nature/Cypress.js': () => import('./nature/Cypress.js'),
  './nature/DriftingPetals.js': () => import('./nature/DriftingPetals.js'),
  './nature/FlowerBed.js': () => import('./nature/FlowerBed.js'),
  './nature/FloweringBush.js': () => import('./nature/FloweringBush.js'),
  './nature/GoldenTree.js': () => import('./nature/GoldenTree.js'),
  './nature/Pond.js': () => import('./nature/Pond.js'),
  './nature/Topiary.js': () => import('./nature/Topiary.js'),
  './street/BalloonBunch.js': () => import('./street/BalloonBunch.js'),
  './street/Bench.js': () => import('./street/Bench.js'),
  './street/Bicycle.js': () => import('./street/Bicycle.js'),
  './street/Bunting.js': () => import('./street/Bunting.js'),
  './street/LampPost.js': () => import('./street/LampPost.js'),
  './street/SignEasel.js': () => import('./street/SignEasel.js'),
  './street/UrnPlanter.js': () => import('./street/UrnPlanter.js'),
  './terrain/CloudCreamIsland.js': () => import('./terrain/CloudCreamIsland.js'),
  './terrain/Lawn.js': () => import('./terrain/Lawn.js'),
  './terrain/PlazaPaving.js': () => import('./terrain/PlazaPaving.js'),
  './terrain/Street.js': () => import('./terrain/Street.js'),
};

// A busy dev server or main thread can time a module fetch out; try again before giving up.
export async function loadAsset(path, attempts = 3) {
  const loader = MODULES[`./${path}.js`];
  if (!loader) throw new Error(`Unknown asset "${path}"`);
  let module;
  for (let i = 1; ; i++) {
    try {
      module = await loader();
      break;
    } catch (error) {
      if (i >= attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, 400 * i));
    }
  }
  if (typeof module.default !== 'function') throw new Error(`Asset "${path}" has no default build function`);
  return module.default;
}

export const ASSET_PATHS = Object.keys(MODULES).map((key) => key.slice(2, -3));
