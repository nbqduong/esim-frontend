import * as THREE from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { createOrbitControls } from "./createOrbitControls";
import {
  createObjectManager,
  type ObjectManager,
  type ObjectState,
} from "./createObjectManager";
import { createWiringEditor } from "./createWiringEditor";
import { loadModel, logModelNode } from "./loadModel";
import { createSpawnController } from "./spawnController";
import Stats from "three/examples/jsm/libs/stats.module.js";

export interface CatalogObject {
  id: string;
  name: string;
  description: string;
  state: ObjectState;
}

export interface CatalogEntry {
  modelUrl: string;
  objects: CatalogObject[];
}

export type ModelCatalog = CatalogEntry[];

export interface SelectedObjectDetails {
  description: string;
  id: string;
  modelUrl: string;
  name: string;
  spawned: boolean;
  state: ObjectState;
}

export interface Create3DViewerOptions {
  container: HTMLElement;
  catalog: ModelCatalog;
  onInteractionMessage?: (message: string) => void;
  onSelectedObjectChange?: (details: SelectedObjectDetails | null) => void;
}

export interface ThreeDViewer {
  deleteObject: (id: string) => boolean;
  destroy: () => void;
  objectManager: ObjectManager;
  ready: Promise<void>;
  spawnAsset: (modelUrl: string) => Promise<void>;
}

interface LoadedTemplate {
  animations: THREE.AnimationClip[];
  model: THREE.Group;
  size: THREE.Vector3;
}

const MAX_OBJECTS_PER_ROW = 10;
const LED_STATE_MATERIALS = new Set(["LED_On", "LED_Off"]);

const disposeMaterial = (material: THREE.Material): void => {
  const materialValues: unknown[] = Object.values(
    material as unknown as Record<string, unknown>
  );

  materialValues.forEach((value: unknown) => {
    if (value instanceof THREE.Texture) {
      value.dispose();
    }
  });

  material.dispose();
};

const normalizeTemplateModel = (template: THREE.Group): THREE.Vector3 => {
  const bounds = new THREE.Box3().setFromObject(template);

  if (bounds.isEmpty()) {
    return new THREE.Vector3(1, 1, 1);
  }

  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  template.position.sub(center);

  return size;
};

const collectStateMaterials = (
  object: THREE.Object3D
): Map<string, THREE.Material> => {
  const stateMaterials = new Map<string, THREE.Material>();

  object.traverse((node: THREE.Object3D) => {
    if (!(node instanceof THREE.Mesh)) {
      return;
    }

    const materials = Array.isArray(node.material)
      ? node.material
      : [node.material];

    materials.forEach((material: THREE.Material) => {
      if (LED_STATE_MATERIALS.has(material.name)) {
        stateMaterials.set(material.name, material);
      }
    });
  });

  return stateMaterials;
};

const cloneInstanceMaterials = (object: THREE.Object3D): void => {
  const materialMap = new Map<THREE.Material, THREE.Material>();

  object.traverse((node: THREE.Object3D) => {
    if (!(node instanceof THREE.Mesh)) {
      return;
    }

    if (Array.isArray(node.material)) {
      node.material = node.material.map((material: THREE.Material) => {
        let cloned = materialMap.get(material);
        if (!cloned) {
          cloned = material.clone();
          materialMap.set(material, cloned);
        }
        return cloned;
      });
      return;
    }

    if (node.material) {
      let cloned = materialMap.get(node.material as THREE.Material);
      if (!cloned) {
        cloned = (node.material as THREE.Material).clone();
        materialMap.set(node.material as THREE.Material, cloned);
      }
      node.material = cloned;
    }
  });

  object.userData = {
    ...object.userData,
    stateMaterials: collectStateMaterials(object),
  };
};

const applyObjectState = (
  object: THREE.Object3D,
  state: ObjectState
): void => {
  object.userData = {
    ...object.userData,
    state,
  };

  const stateMaterials =
    object.userData.stateMaterials instanceof Map
      ? (object.userData.stateMaterials as Map<string, THREE.Material>)
      : collectStateMaterials(object);
  const targetMaterial = stateMaterials.get(state);

  if (!targetMaterial) {
    return;
  }

  targetMaterial.visible = true;
  targetMaterial.needsUpdate = true;

  object.traverse((node: THREE.Object3D) => {
    if (
      node instanceof THREE.Mesh &&
      typeof node.userData.selectionType !== "string"
    ) {
      node.material = targetMaterial;
    }
  });
};

export const create3DViewer = ({
  container,
  catalog,
  onInteractionMessage,
  onSelectedObjectChange,
}: Create3DViewerOptions): ThreeDViewer => {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#f3efe4");

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(2.8, 1.6, 4.6);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.append(renderer.domElement);

  const stats = new Stats();
  stats.dom.style.position = "absolute";
  stats.dom.style.top = "0px";
  stats.dom.style.left = "0px";
  container.appendChild(stats.dom);

  const objectGroup = new THREE.Group();
  scene.add(objectGroup);

  let destroyed = false;
  let renderLoopFrameId: number | null = null;
  let renderRequested = false;
  let mixers: THREE.AnimationMixer[] = [];
  let readySettled = false;
  let selectedObjectId: string | null = null;
  let resolveReady!: () => void;
  let rejectReady!: (error: unknown) => void;

  const metadataById = new Map<
    string,
    {
      description: string;
      modelUrl: string;
      name: string;
      spawned: boolean;
    }
  >();

  const ready = new Promise<void>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });

  const emitSelectedObjectChange = (): void => {
    if (!selectedObjectId) {
      onSelectedObjectChange?.(null);
      return;
    }

    const record = objectManager.getObjectRecord(selectedObjectId);
    const metadata = metadataById.get(selectedObjectId);

    if (!record || !metadata) {
      onSelectedObjectChange?.(null);
      return;
    }

    onSelectedObjectChange?.({
      description: metadata.description,
      id: selectedObjectId,
      modelUrl: metadata.modelUrl,
      name: metadata.name,
      spawned: metadata.spawned,
      state: record.state,
    });
  };

  const render = (): void => {
    renderRequested = false;

    if (destroyed) {
      return;
    }

    wiringEditor.prepareRender();
    stats.update();
    renderer.render(scene, camera);
  };

  const requestRenderIfNotRequested = (): void => {
    if (destroyed || renderLoopFrameId !== null || renderRequested) {
      return;
    }

    renderRequested = true;
    window.requestAnimationFrame(render);
  };

  const objectManager = createObjectManager({
    onChange: () => {
      requestRenderIfNotRequested();
      emitSelectedObjectChange();
    },
    onStateChange: applyObjectState,
  });

  const controls = createOrbitControls({
    camera,
    domElement: renderer.domElement,
    onChange: requestRenderIfNotRequested,
  });

  const wiringEditor = createWiringEditor({
    camera,
    controls,
    domElement: renderer.domElement,
    onInteractionMessage,
    onObjectSelectionChange: (objectId) => {
      selectedObjectId = objectId;
      emitSelectedObjectChange();
    },
    onRenderRequest: requestRenderIfNotRequested,
    scene,
  });

  const ambientLight = new THREE.HemisphereLight("#fff8e8", "#a58f7d", 1.3);
  scene.add(ambientLight);

  const keyLight = new THREE.DirectionalLight("#ffffff", 1.8);
  keyLight.position.set(5, 8, 3);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.near = 0.5;
  keyLight.shadow.camera.far = 30;
  keyLight.shadow.camera.left = -6;
  keyLight.shadow.camera.right = 6;
  keyLight.shadow.camera.top = 6;
  keyLight.shadow.camera.bottom = -6;
  keyLight.target.position.set(0, 0.4, 0);
  scene.add(keyLight);
  scene.add(keyLight.target);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(20, 64),
    new THREE.ShadowMaterial({ color: "#8a7864", opacity: 0.18 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.8;
  floor.receiveShadow = true;
  scene.add(floor);

  const clock = new THREE.Clock(false);
  const templateCache = new Map<string, Promise<LoadedTemplate>>();

  const stopRenderLoop = (): void => {
    if (renderLoopFrameId !== null) {
      window.cancelAnimationFrame(renderLoopFrameId);
      renderLoopFrameId = null;
    }
  };

  const fitCameraToObject = (object: THREE.Object3D): void => {
    const bounds = new THREE.Box3().setFromObject(object);

    if (bounds.isEmpty()) {
      return;
    }

    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const maxDimension = Math.max(size.x, size.y, size.z) || 1;
    const fov = THREE.MathUtils.degToRad(camera.fov);
    const cameraDistance = maxDimension / (2 * Math.tan(fov / 2));

    floor.position.y = bounds.min.y - 0.08;

    camera.near = Math.max(cameraDistance / 100, 0.1);
    camera.far = cameraDistance * 100;
    camera.position.set(
      center.x + maxDimension * 0.55,
      center.y + Math.max(size.y * 0.35, maxDimension * 0.2),
      center.z + cameraDistance * 1.7
    );
    controls.target.set(center.x, center.y + size.y * 0.05, center.z);
    camera.lookAt(controls.target);
    camera.updateProjectionMatrix();
    controls.update();
    requestRenderIfNotRequested();
  };

  const startRenderLoop = (): void => {
    if (renderLoopFrameId !== null) {
      return;
    }

    clock.start();

    const animate = (): void => {
      if (destroyed) {
        renderLoopFrameId = null;
        return;
      }

      const delta = clock.getDelta();
      mixers.forEach((activeMixer) => {
        activeMixer.update(delta);
      });
      render();
      renderLoopFrameId = window.requestAnimationFrame(animate);
    };

    animate();
  };

  const handleResize = (): void => {
    const width = container.clientWidth;
    const height = container.clientHeight;

    if (!width || !height) {
      return;
    }

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    wiringEditor.updateSize(width, height);
    controls.update();
    requestRenderIfNotRequested();
  };

  const loadTemplate = (modelUrl: string): Promise<LoadedTemplate> => {
    const cachedTemplate = templateCache.get(modelUrl);
    if (cachedTemplate) {
      return cachedTemplate;
    }

    const templatePromise = loadModel({
      modelUrl,
      onNode: logModelNode,
    }).then(({ gltf, model }) => ({
      animations: gltf.animations,
      model,
      size: normalizeTemplateModel(model),
    }));

    templateCache.set(modelUrl, templatePromise);
    return templatePromise;
  };

  const populateObjectGrid = (
    catalogEntries: Array<{
      entry: CatalogEntry;
      template: LoadedTemplate;
    }>
  ): void => {
    const spacingX =
      Math.max(1, ...catalogEntries.map(({ template }) => template.size.x)) + 0.6;
    const spacingZ =
      Math.max(1, ...catalogEntries.map(({ template }) => template.size.z)) + 0.6;

    selectedObjectId = null;
    objectGroup.clear();
    objectManager.clear();
    wiringEditor.clear();
    metadataById.clear();
    mixers = [];

    let objectIndex = 0;

    catalogEntries.forEach(({ entry, template }) => {
      entry.objects.forEach((item) => {
        const instance = clone(template.model) as THREE.Group;
        const column = objectIndex % MAX_OBJECTS_PER_ROW;
        const row = Math.floor(objectIndex / MAX_OBJECTS_PER_ROW);

        cloneInstanceMaterials(instance);
        instance.name = item.name;
        instance.position.set(column * spacingX, 0, row * spacingZ);
        instance.userData = {
          ...instance.userData,
          description: item.description,
          id: item.id,
          modelUrl: entry.modelUrl,
          name: item.name,
          state: item.state,
        };
        metadataById.set(item.id, {
          description: item.description,
          modelUrl: entry.modelUrl,
          name: item.name,
          spawned: false,
        });

        objectGroup.add(instance);
        objectManager.registerObject({
          id: item.id,
          object: instance,
          state: item.state,
        });
        wiringEditor.registerObject(item.id, instance);

        if (template.animations.length > 0) {
          const mixer = new THREE.AnimationMixer(instance);
          template.animations.forEach((clip: THREE.AnimationClip) => {
            mixer.clipAction(clip).play();
          });
          mixers.push(mixer);
        }

        objectIndex += 1;
      });
    });
  };

  void Promise.all(
    catalog.map(async (entry) => ({
      entry,
      template: await loadTemplate(entry.modelUrl),
    }))
  )
    .then((catalogEntries) => {
      if (destroyed || catalogEntries.length === 0) {
        if (!readySettled) {
          resolveReady();
          readySettled = true;
        }
        return;
      }

      populateObjectGrid(catalogEntries);
      fitCameraToObject(objectGroup);
      emitSelectedObjectChange();

      if (mixers.length > 0) {
        startRenderLoop();
        if (!readySettled) {
          resolveReady();
          readySettled = true;
        }
        return;
      }

      requestRenderIfNotRequested();
      if (!readySettled) {
        resolveReady();
        readySettled = true;
      }
    })
    .catch((error) => {
      console.error("Unable to load model catalog", error);
      if (!readySettled) {
        rejectReady(error);
        readySettled = true;
      }
    });

  handleResize();
  requestRenderIfNotRequested();
  window.addEventListener("resize", handleResize);

  const spawnController = createSpawnController({
    scene,
    objectManager,
    onObjectSpawned: (id, object) => {
      metadataById.set(id, {
        description:
          typeof object.userData.description === "string"
            ? object.userData.description
            : "Spawned object",
        modelUrl:
          typeof object.userData.modelUrl === "string"
            ? object.userData.modelUrl
            : "",
        name: typeof object.userData.name === "string" ? object.userData.name : object.name || id,
        spawned: true,
      });
      wiringEditor.registerObject(id, object);
    },
    onRenderRequest: requestRenderIfNotRequested,
    onMixerAdded: (mixer) => {
      mixers.push(mixer);
      // Ensure the render loop is running when animations are added dynamically
      startRenderLoop();
    },
  });

  return {
    deleteObject: (id: string): boolean => {
      const object = objectManager.getObjectById(id);
      if (!object) {
        return false;
      }

      if (selectedObjectId === id) {
        selectedObjectId = null;
      }

      wiringEditor.removeObject(id);
      object.removeFromParent();
      metadataById.delete(id);
      objectManager.removeObject(id);
      mixers = mixers.filter((activeMixer) => {
        if (activeMixer.getRoot() === object) {
          activeMixer.stopAllAction();
          return false;
        }

        return true;
      });
      emitSelectedObjectChange();
      requestRenderIfNotRequested();
      return true;
    },
    destroy: (): void => {
      destroyed = true;
      if (!readySettled) {
        resolveReady();
        readySettled = true;
      }
      stopRenderLoop();
      window.removeEventListener("resize", handleResize);

      controls.dispose();
      wiringEditor.dispose();

      mixers.forEach((activeMixer) => {
        activeMixer.stopAllAction();
      });
      mixers = [];

      renderer.dispose();

      const canvas = renderer.domElement;
      if (canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }

      if (stats.dom.parentNode) {
        stats.dom.parentNode.removeChild(stats.dom);
      }

      scene.traverse((object: THREE.Object3D) => {
        if (object.userData && object.userData.stateMaterials) {
          const stateMaterials = object.userData.stateMaterials as Map<string, THREE.Material>;
          stateMaterials.forEach(disposeMaterial);
        }

        if (!(object instanceof THREE.Mesh)) {
          return;
        }

        object.geometry.dispose();

        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];

        materials.forEach(disposeMaterial);
      });
    },
    objectManager,
    ready,
    spawnAsset: spawnController.spawnAsset,
  };
};
