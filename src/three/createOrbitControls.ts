import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export interface CreateOrbitControlsOptions {
  camera: THREE.PerspectiveCamera;
  domElement: HTMLCanvasElement;
  onChange?: () => void;
}

export const createOrbitControls = ({
  camera,
  domElement,
  onChange,
}: CreateOrbitControlsOptions): OrbitControls => {
  const controls = new OrbitControls(camera, domElement);

  controls.enableDamping = false;
  controls.minDistance = 0.8;
  controls.maxDistance = 18;
  controls.target.set(0, 1, 0);

  if (onChange) {
    controls.addEventListener("change", onChange);
  }

  controls.update();

  return controls;
};
