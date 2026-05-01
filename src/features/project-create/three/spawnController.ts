import * as THREE from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { loadModel } from "./loadModel";
import type { ObjectManager } from "./createObjectManager";

export interface SpawnControllerOptions {
  scene: THREE.Scene;
  objectManager: ObjectManager;
  onRenderRequest: () => void;
  onMixerAdded: (mixer: THREE.AnimationMixer) => void;
}

export interface SpawnController {
  spawnAsset: (modelUrl: string) => Promise<void>;
}

const cloneMaterials = (object: THREE.Object3D): void => {
  object.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;

    if (Array.isArray(node.material)) {
      node.material = node.material.map((m: THREE.Material) => m.clone());
    } else if (node.material) {
      node.material = node.material.clone();
    }
  });
};

const normalizePivot = (group: THREE.Group): void => {
  const box = new THREE.Box3().setFromObject(group);
  if (box.isEmpty()) return;
  const center = box.getCenter(new THREE.Vector3());
  group.position.sub(center);
};

export const createSpawnController = ({
  scene,
  objectManager,
  onRenderRequest,
  onMixerAdded,
}: SpawnControllerOptions): SpawnController => {
  // Simple cache: url → loaded template (model + animations)
  const templateCache = new Map<
    string,
    Promise<{ model: THREE.Group; animations: THREE.AnimationClip[] }>
  >();

  const getTemplate = (
    modelUrl: string
  ): Promise<{ model: THREE.Group; animations: THREE.AnimationClip[] }> => {
    const cached = templateCache.get(modelUrl);
    if (cached) return cached;

    const promise = loadModel({ modelUrl }).then(({ gltf, model }) => {
      normalizePivot(model);
      return { model, animations: gltf.animations };
    });

    templateCache.set(modelUrl, promise);
    return promise;
  };

  return {
    spawnAsset: async (modelUrl: string): Promise<void> => {
      const { model: template, animations } = await getTemplate(modelUrl);

      const instance = clone(template) as THREE.Group;
      cloneMaterials(instance);

      // Spawn at world origin
      instance.position.set(0, 0, 0);

      const instanceId = crypto.randomUUID();
      instance.name = `spawned-${instanceId}`;
      instance.userData = {
        ...instance.userData,
        id: instanceId,
        modelUrl,
        spawned: true,
      };

      scene.add(instance);

      objectManager.registerObject({
        id: instanceId,
        object: instance,
        state: "LED_Off",
      });

      if (animations.length > 0) {
        const mixer = new THREE.AnimationMixer(instance);
        animations.forEach((clip) => mixer.clipAction(clip).play());
        onMixerAdded(mixer);
      }

      onRenderRequest();
    },
  };
};
