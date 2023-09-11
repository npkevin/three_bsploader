# BSPLoader (Source) for THREE

**_Highly experimental_** Three.js loader for source engine `.bsp` maps. Loads geometry aswell as materials. Support for static props (studio models, aka. mdl) coming soon.

## Quick Guide

```
npm i
npm run build
```

```typescript
import { Scene } from "three";
import { BSPLoader } from "./dist/loaders/BSPLoader";
// ... your Three.js code
const scene = new Scene();

const loader = new BSPLoader();
loader.load("de_vertigo.bsp", (group) => {
    scene.add(group);
});
// ... your Three.js code
```

## Loaders

| Loader | Exports        | Status  |
| ------ | -------------- | ------- |
| BSP    | THREE.Group    | V21\*   |
| VMT    | THREE.Material | Working |
| VTF    | THREE.Texture  | Working |
| MDL    | THREE.Group    | WIP     |
| VTX    | WIP            | WIP     |
| VVD    | WIP            | WIP     |

**_\* only tested with csgo files (v21)_**

<img src="https://github.com/npkevin/three_bsploader/blob/master/screenshots/overpass_1.png?raw=true" width=400></img>
<img src="https://github.com/npkevin/three_bsploader/blob/master/screenshots/nuke_1.png?raw=true" width=400></img>
<img src="https://github.com/npkevin/three_bsploader/blob/master/screenshots/inferno_1.png?raw=true" width=400></img>
<img src="https://github.com/npkevin/three_bsploader/blob/master/screenshots/mirage_1.png?raw=true" width=400></img>
