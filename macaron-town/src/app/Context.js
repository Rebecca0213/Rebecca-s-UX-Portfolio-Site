import { TextureBakery } from '../textures/Bakery.js';
import { MaterialLibrary } from '../materials/library.js';
import { PhysicsWorld } from '../physics/World.js';

// What every asset builder receives: the material library (with baked textures), the physics world,
// and a deterministic seed so each placement can vary while staying reproducible.
export function createContext(renderer) {
  const bakery = new TextureBakery(renderer);
  return {
    renderer,
    bakery,
    materials: new MaterialLibrary(bakery),
    physics: new PhysicsWorld(),
    updaters: new Set(),
  };
}
