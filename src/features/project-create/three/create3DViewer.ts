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

export interface Create3DViewerOptions {
  container: HTMLElement;
  catalog: ModelCatalog;
  onInteractionMessage?: (message: string) => void;
}

export interface ThreeDViewer {
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

const cloneInstanceMaterials = (object: THREE.Object3D): void => {
  object.traverse((node: THREE.Object3D) => {
    if (!(node instanceof THREE.Mesh)) {
      return;
    }

    if (Array.isArray(node.material)) {
      node.material = node.material.map((material: THREE.Material) =>
        material.clone()
      );
      return;
    }

    if (node.material) {
      node.material = node.material.clone();
    }
  });
};

const applyObjectState = (
  object: THREE.Object3D,
  state: ObjectState
): void => {
  object.userData = {
    ...object.userData,
    state,
  };

  object.traverse((node: THREE.Object3D) => {
    if (!(node instanceof THREE.Mesh)) {
      return;
    }

    const materials = Array.isArray(node.material)
      ? node.material
      : [node.material];

    materials.forEach((material: THREE.Material) => {
      if (LED_STATE_MATERIALS.has(material.name)) {
        material.visible = material.name === state;
        material.needsUpdate = true;
        return;
      }

      material.visible = true;
    });
  });
};

export const create3DViewer = ({
  container,
  catalog,
  onInteractionMessage,
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
  let resolveReady!: () => void;
  let rejectReady!: (error: unknown) => void;

  const ready = new Promise<void>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });

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
    onChange: requestRenderIfNotRequested,
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

    objectGroup.clear();
    objectManager.clear();
    wiringEditor.clear();
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
