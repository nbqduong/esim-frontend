import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { catalogManager } from "@/features/static-models/catalogManager";
import { resolveStaticAssetUrl } from "@/features/static-models/resolveStaticAssetUrl";

export interface LoadModelOptions {
  modelUrl: string;
  onNode?: (object: THREE.Object3D) => void;
}

export interface LoadModelResult {
  gltf: GLTF;
  model: THREE.Group;
}

const loader = new GLTFLoader();

export const logModelNode = (object: THREE.Object3D): void => {
  console.groupCollapsed(`GLB node: ${object.name || "(unnamed)"}`);
  console.log("type:", object.type);
  console.log("uuid:", object.uuid);
  console.log("name:", object.name);
  console.log("position:", object.position.toArray());
  console.log("rotation:", object.rotation.toArray());
  console.log("scale:", object.scale.toArray());
  console.log("visible:", object.visible);
  console.log("children:", object.children.length);
  console.log("userData:", object.userData);
  console.log("object:", object);

  if (
    object instanceof THREE.Mesh &&
    object.material &&
    !Array.isArray(object.material)
  ) {
    console.log("material name:", object.material.name);
  }

  console.groupEnd();
};

const prepareModelNode = (
  object: THREE.Object3D,
  onNode?: (object: THREE.Object3D) => void
): void => {
  onNode?.(object);

  if (object instanceof THREE.Mesh) {
    object.castShadow = true;
    object.receiveShadow = true;
  }
};

export const resolveModelUrl = (url: string): string => resolveStaticAssetUrl(url);

export const loadModel = ({
  modelUrl,
  onNode,
}: LoadModelOptions): Promise<LoadModelResult> => {
  const resolvedUrl = catalogManager.getValidModelUrl(modelUrl);
  
  if (!resolvedUrl) {
    return Promise.reject(new Error(`Model URL ${modelUrl} is not a valid public static asset.`));
  }
  
  return new Promise((resolve, reject) => {
    loader.load(
      resolvedUrl,
      (gltf: GLTF) => {
        const model = gltf.scene;

        model.traverse((object: THREE.Object3D) => {
          prepareModelNode(object, onNode);
        });

        resolve({
          gltf,
          model,
        });
      },
      undefined,
      reject
    );
  });
};
