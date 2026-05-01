import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";

export interface CreateWiringEditorOptions {
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  domElement: HTMLCanvasElement;
  onInteractionMessage?: (message: string) => void;
  onRenderRequest: () => void;
  scene: THREE.Scene;
}

export interface WiringEditor {
  clear: () => void;
  dispose: () => void;
  prepareRender: () => void;
  registerObject: (id: string, object: THREE.Object3D) => void;
  updateSize: (width: number, height: number) => void;
}

interface ConnectionPointDefinition {
  direction: THREE.Vector3;
  name: string;
  position: THREE.Vector3;
}

interface ConnectionPoint extends ConnectionPointDefinition {
  marker: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
}

interface WiringObject {
  connectionPoints: ConnectionPoint[];
  id: string;
  object: THREE.Object3D;
  pickableMeshes: THREE.Mesh[];
}

interface WireRecord {
  controlPoints: THREE.Vector3[];
  endObjectId: string;
  endPortIndex: number;
  segmentCount: number;
  segmentOffset: number;
  startObjectId: string;
  startPortIndex: number;
}

type WiringSelection =
  | { objectId: string; type: "object" }
  | { objectId: string; portIndex: number; type: "connection-point" }
  | { type: "wire"; wireIndex: number }
  | { handleIndex: number; type: "wire-handle"; wireIndex: number };

interface PendingWireStart {
  objectId: string;
  portIndex: number;
}

interface WireSystem {
  activeWireIndex: number | null;
  dirtyWireIndices: Set<number>;
  geometry: LineSegmentsGeometry;
  handleMeshes: Array<THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>>;
  material: LineMaterial;
  objectWireMap: Map<string, Set<number>>;
  positionBuffer: Float32Array;
  segmentToWire: Int32Array;
  segments: LineSegments2;
  wires: WireRecord[];
}

const WIRE_CONFIG = {
  lineWidth: 0.045,
  maxControlPointsPerWire: 6,
  maxWires: 4096,
};

const MAX_SEGMENTS_PER_WIRE = WIRE_CONFIG.maxControlPointsPerWire + 1;
const CONNECTION_POINT_PATTERN = /^(wire[_-]?port|connection[_-]?point)[_-]?/i;

const pointer = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
(raycaster.params as { Line2?: { threshold: number } }).Line2 = {
  threshold: 0.05,
};

const tempDirection = new THREE.Vector3();
const tempEndAnchor = new THREE.Vector3();
const tempEndDirection = new THREE.Vector3();
const tempMidpoint = new THREE.Vector3();
const tempSegmentEnd = new THREE.Vector3();
const tempSegmentStart = new THREE.Vector3();
const tempSideways = new THREE.Vector3();
const tempStartAnchor = new THREE.Vector3();
const tempStartDirection = new THREE.Vector3();

const isConnectionPointNode = (object: THREE.Object3D): boolean =>
  CONNECTION_POINT_PATTERN.test(object.name);

const getConnectionPointName = (name: string): string =>
  name.replace(CONNECTION_POINT_PATTERN, "") || name;

const createMarkerMaterial = (): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({
    color: "#48bfe3",
    emissive: "#084c61",
    emissiveIntensity: 0.42,
    metalness: 0.08,
    roughness: 0.3,
  });

const getObjectConnectionPointDefinitions = (
  object: THREE.Object3D
): ConnectionPointDefinition[] => {
  object.updateMatrixWorld(true);

  const rootInverse = new THREE.Matrix4().copy(object.matrixWorld).invert();
  const definitions: ConnectionPointDefinition[] = [];

  object.traverse((child: THREE.Object3D) => {
    if (!isConnectionPointNode(child)) {
      return;
    }

    const relativeMatrix = new THREE.Matrix4()
      .copy(rootInverse)
      .multiply(child.matrixWorld);
    const rotation = new THREE.Quaternion().setFromRotationMatrix(
      relativeMatrix
    );

    definitions.push({
      direction: new THREE.Vector3(0, 0, 1).applyQuaternion(rotation).normalize(),
      name: getConnectionPointName(child.name),
      position: new THREE.Vector3().setFromMatrixPosition(relativeMatrix),
    });
  });

  if (definitions.length > 0) {
    return definitions
      .sort((left, right) => left.name.localeCompare(right.name))
      .slice(0, 8);
  }

  const bounds = new THREE.Box3().setFromObject(object);
  if (bounds.isEmpty()) {
    return [
      {
        direction: new THREE.Vector3(1, 0, 0),
        name: "A",
        position: new THREE.Vector3(0.5, 0, 0),
      },
      {
        direction: new THREE.Vector3(-1, 0, 0),
        name: "B",
        position: new THREE.Vector3(-0.5, 0, 0),
      },
    ];
  }

  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const y = bounds.min.y + Math.max(size.y * 0.58, 0.12);
  const worldPoints = [
    {
      direction: new THREE.Vector3(1, 0, 0),
      name: "A",
      position: new THREE.Vector3(bounds.max.x, y, center.z),
    },
    {
      direction: new THREE.Vector3(-1, 0, 0),
      name: "B",
      position: new THREE.Vector3(bounds.min.x, y, center.z),
    },
    {
      direction: new THREE.Vector3(0, 0, 1),
      name: "C",
      position: new THREE.Vector3(center.x, y, bounds.max.z),
    },
  ];

  const inverseWorldQuaternion = object
    .getWorldQuaternion(new THREE.Quaternion())
    .invert();

  return worldPoints.map((point) => ({
    direction: point.direction.clone().applyQuaternion(inverseWorldQuaternion),
    name: point.name,
    position: object.worldToLocal(point.position.clone()),
  }));
};

export const createWiringEditor = ({
  camera,
  controls,
  domElement,
  onInteractionMessage,
  onRenderRequest,
  scene,
}: CreateWiringEditorOptions): WiringEditor => {
  const objects = new Map<string, WiringObject>();
  let currentSelection: WiringSelection | null = null;
  let pendingWireStart: PendingWireStart | null = null;
  let pickableMeshes: THREE.Object3D[] = [];

  const markerGeometry = new THREE.SphereGeometry(0.075, 14, 14);
  const editorGroup = new THREE.Group();
  editorGroup.name = "wiring-editor";
  scene.add(editorGroup);

  const transformControls = new TransformControls(camera, domElement);
  transformControls.setMode("translate");
  transformControls.size = 1.05;
  editorGroup.add(transformControls.getHelper());

  const createWireSystem = (): WireSystem => {
    const segmentCapacity = WIRE_CONFIG.maxWires * MAX_SEGMENTS_PER_WIRE;
    const positionBuffer = new Float32Array(segmentCapacity * 6);
    const segmentToWire = new Int32Array(segmentCapacity).fill(-1);

    const geometry = new LineSegmentsGeometry();
    geometry.setPositions(positionBuffer);
    geometry.instanceCount = 0;

    const material = new LineMaterial({
      alphaToCoverage: true,
      color: "#2f3544",
      linewidth: WIRE_CONFIG.lineWidth,
      opacity: 0.92,
      transparent: true,
      worldUnits: true,
    });

    const segments = new LineSegments2(geometry, material);
    segments.frustumCulled = false;
    segments.renderOrder = 2;
    editorGroup.add(segments);

    const handleGeometry = new THREE.SphereGeometry(0.085, 16, 16);
    const handleMaterial = new THREE.MeshStandardMaterial({
      color: "#ffb24c",
      emissive: "#8a4200",
      emissiveIntensity: 0.24,
      metalness: 0.12,
      roughness: 0.32,
    });

    const handleMeshes = Array.from(
      { length: WIRE_CONFIG.maxControlPointsPerWire },
      (_unused, handleIndex) => {
        const mesh = new THREE.Mesh(handleGeometry, handleMaterial);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.visible = false;
        mesh.userData = {
          handleIndex,
          selectionType: "wire-handle",
        };
        editorGroup.add(mesh);
        return mesh;
      }
    );

    return {
      activeWireIndex: null,
      dirtyWireIndices: new Set(),
      geometry,
      handleMeshes,
      material,
      objectWireMap: new Map(),
      positionBuffer,
      segmentToWire,
      segments,
      wires: [],
    };
  };

  const wireSystem = createWireSystem();

  const emitInteractionMessage = (message?: string): void => {
    if (message) {
      onInteractionMessage?.(message);
      return;
    }

    if (pendingWireStart) {
      const wiringObject = objects.get(pendingWireStart.objectId);
      const connectionPoint =
        wiringObject?.connectionPoints[pendingWireStart.portIndex];

      onInteractionMessage?.(
        connectionPoint
          ? `Wire start: ${wiringObject.object.name || wiringObject.id} port ${connectionPoint.name}. Click another port to connect.`
          : "Click another connection point to finish the wire."
      );
      return;
    }

    if (currentSelection?.type === "wire" || currentSelection?.type === "wire-handle") {
      onInteractionMessage?.("Wire selected. Drag bend handles, or press +/- to add or remove bends.");
      return;
    }

    if (currentSelection?.type === "object") {
      onInteractionMessage?.("Object selected. Drag the transform handle to move it.");
      return;
    }

    onInteractionMessage?.("Click a connection point to start wiring, or click an object to move it.");
  };

  const refreshConnectionPointVisuals = (): void => {
    objects.forEach((wiringObject) => {
      wiringObject.connectionPoints.forEach((connectionPoint, portIndex) => {
        const isPending =
          pendingWireStart?.objectId === wiringObject.id &&
          pendingWireStart.portIndex === portIndex;
        const isSelected =
          currentSelection?.type === "connection-point" &&
          currentSelection.objectId === wiringObject.id &&
          currentSelection.portIndex === portIndex;

        connectionPoint.marker.material.color.set(
          isPending ? "#ff9159" : isSelected ? "#ffe082" : "#48bfe3"
        );
        connectionPoint.marker.material.emissive.set(
          isPending ? "#912800" : isSelected ? "#7f5600" : "#084c61"
        );
        connectionPoint.marker.scale.setScalar(isPending ? 1.38 : isSelected ? 1.2 : 1);
      });
    });
  };

  const refreshPickableMeshes = (): void => {
    pickableMeshes = [];

    objects.forEach((wiringObject) => {
      pickableMeshes.push(
        ...wiringObject.connectionPoints.map(
          (connectionPoint) => connectionPoint.marker
        ),
        ...wiringObject.pickableMeshes
      );
    });

    if (wireSystem.wires.length > 0) {
      pickableMeshes.push(wireSystem.segments);
      wireSystem.handleMeshes.forEach((handleMesh) => {
        if (handleMesh.visible) {
          pickableMeshes.push(handleMesh);
        }
      });
    }
  };

  const showWireHandles = (wireIndex: number | null): void => {
    wireSystem.activeWireIndex = wireIndex;
    const wire = wireIndex === null ? null : wireSystem.wires[wireIndex];

    wireSystem.handleMeshes.forEach((handleMesh, handleIndex) => {
      if (!wire || handleIndex >= wire.controlPoints.length) {
        handleMesh.visible = false;
        return;
      }

      handleMesh.visible = true;
      handleMesh.position.copy(wire.controlPoints[handleIndex]);
      handleMesh.userData = {
        handleIndex,
        selectionType: "wire-handle",
        wireIndex,
      };
    });

    refreshPickableMeshes();
  };

  const clearPendingWireStart = (): void => {
    if (!pendingWireStart) {
      return;
    }

    pendingWireStart = null;
    refreshConnectionPointVisuals();
  };

  const getConnectionPointWorldData = (
    wiringObject: WiringObject | undefined,
    portIndex: number,
    positionTarget: THREE.Vector3,
    directionTarget?: THREE.Vector3
  ): boolean => {
    const connectionPoint =
      wiringObject?.connectionPoints[portIndex] ??
      wiringObject?.connectionPoints[0];

    if (!wiringObject || !connectionPoint) {
      positionTarget.set(0, 0, 0);
      directionTarget?.set(0, 0, 1);
      return false;
    }

    connectionPoint.marker.getWorldPosition(positionTarget);
    directionTarget
      ?.copy(connectionPoint.direction)
      .transformDirection(wiringObject.object.matrixWorld)
      .normalize();

    return true;
  };

  const getWireAnchors = (
    wire: WireRecord,
    startTarget = new THREE.Vector3(),
    endTarget = new THREE.Vector3(),
    startDirectionTarget?: THREE.Vector3,
    endDirectionTarget?: THREE.Vector3
  ): { endAnchor: THREE.Vector3; startAnchor: THREE.Vector3 } => {
    getConnectionPointWorldData(
      objects.get(wire.startObjectId),
      wire.startPortIndex,
      startTarget,
      startDirectionTarget
    );
    getConnectionPointWorldData(
      objects.get(wire.endObjectId),
      wire.endPortIndex,
      endTarget,
      endDirectionTarget
    );

    return {
      endAnchor: endTarget,
      startAnchor: startTarget,
    };
  };

  const markWireDirty = (wireIndex: number): void => {
    if (wireSystem.wires[wireIndex]) {
      wireSystem.dirtyWireIndices.add(wireIndex);
    }
  };

  const markWiresForObjectDirty = (objectId: string): void => {
    wireSystem.objectWireMap.get(objectId)?.forEach(markWireDirty);
  };

  const createDefaultWireControlPoints = (
    startAnchor: THREE.Vector3,
    endAnchor: THREE.Vector3,
    startDirection: THREE.Vector3,
    endDirection: THREE.Vector3
  ): THREE.Vector3[] => {
    tempDirection.copy(endAnchor).sub(startAnchor);
    const span = tempDirection.length() || 1;
    const tangentLength = THREE.MathUtils.clamp(span * 0.22, 0.18, 0.95);
    const lift = THREE.MathUtils.clamp(span * 0.08, 0.12, 0.34);
    const firstPoint = startAnchor.clone();
    const secondPoint = endAnchor.clone();

    if (startDirection.lengthSq()) {
      firstPoint.addScaledVector(startDirection, tangentLength);
    } else {
      firstPoint.lerp(endAnchor, 0.35);
    }

    if (endDirection.lengthSq()) {
      secondPoint.addScaledVector(endDirection, tangentLength);
    } else {
      secondPoint.lerp(startAnchor, 0.35);
    }

    firstPoint.y += lift;
    secondPoint.y += lift;

    return [firstPoint, secondPoint];
  };

  const registerWireObjectLink = (objectId: string, wireIndex: number): void => {
    if (!wireSystem.objectWireMap.has(objectId)) {
      wireSystem.objectWireMap.set(objectId, new Set());
    }

    wireSystem.objectWireMap.get(objectId)?.add(wireIndex);
  };

  const addConnectionWire = (
    startObjectId: string,
    startPortIndex: number,
    endObjectId: string,
    endPortIndex: number
  ): number | null => {
    if (wireSystem.wires.length >= WIRE_CONFIG.maxWires) {
      return null;
    }

    const anchors = getWireAnchors(
      {
        controlPoints: [],
        endObjectId,
        endPortIndex,
        segmentCount: 0,
        segmentOffset: 0,
        startObjectId,
        startPortIndex,
      },
      tempStartAnchor,
      tempEndAnchor,
      tempStartDirection,
      tempEndDirection
    );

    const wireIndex = wireSystem.wires.length;
    wireSystem.wires.push({
      controlPoints: createDefaultWireControlPoints(
        anchors.startAnchor,
        anchors.endAnchor,
        tempStartDirection,
        tempEndDirection
      ),
      endObjectId,
      endPortIndex,
      segmentCount: 0,
      segmentOffset: wireIndex * MAX_SEGMENTS_PER_WIRE,
      startObjectId,
      startPortIndex,
    });

    registerWireObjectLink(startObjectId, wireIndex);
    registerWireObjectLink(endObjectId, wireIndex);
    markWireDirty(wireIndex);
    refreshPickableMeshes();
    return wireIndex;
  };

  const writeWireSegment = (
    segmentIndex: number,
    startPoint: THREE.Vector3,
    endPoint: THREE.Vector3,
    wireIndex: number
  ): void => {
    const offset = segmentIndex * 6;
    wireSystem.positionBuffer[offset] = startPoint.x;
    wireSystem.positionBuffer[offset + 1] = startPoint.y;
    wireSystem.positionBuffer[offset + 2] = startPoint.z;
    wireSystem.positionBuffer[offset + 3] = endPoint.x;
    wireSystem.positionBuffer[offset + 4] = endPoint.y;
    wireSystem.positionBuffer[offset + 5] = endPoint.z;
    wireSystem.segmentToWire[segmentIndex] = wireIndex;
  };

  const syncWireGeometrySlice = (wireIndex: number): void => {
    const wire = wireSystem.wires[wireIndex];
    if (!wire) {
      return;
    }

    getWireAnchors(wire, tempStartAnchor, tempEndAnchor);

    let previousPoint = tempStartAnchor;
    let segmentCount = 0;

    wire.controlPoints.forEach((controlPoint) => {
      writeWireSegment(
        wire.segmentOffset + segmentCount,
        previousPoint,
        controlPoint,
        wireIndex
      );
      previousPoint = controlPoint;
      segmentCount += 1;
    });

    writeWireSegment(
      wire.segmentOffset + segmentCount,
      previousPoint,
      tempEndAnchor,
      wireIndex
    );
    segmentCount += 1;

    for (let index = segmentCount; index < MAX_SEGMENTS_PER_WIRE; index += 1) {
      writeWireSegment(wire.segmentOffset + index, tempEndAnchor, tempEndAnchor, -1);
    }

    wire.segmentCount = segmentCount;
  };

  const flushWireSystem = (): void => {
    if (!wireSystem.dirtyWireIndices.size) {
      return;
    }

    wireSystem.dirtyWireIndices.forEach(syncWireGeometrySlice);
    wireSystem.geometry.instanceCount =
      wireSystem.wires.length * MAX_SEGMENTS_PER_WIRE;

    const instanceStart = wireSystem.geometry.attributes.instanceStart as
      | THREE.InterleavedBufferAttribute
      | undefined;
    const instanceEnd = wireSystem.geometry.attributes.instanceEnd as
      | THREE.InterleavedBufferAttribute
      | undefined;

    if (instanceStart) {
      instanceStart.data.needsUpdate = true;
    }
    if (instanceEnd) {
      instanceEnd.data.needsUpdate = true;
    }

    if (wireSystem.geometry.instanceCount > 0) {
      wireSystem.geometry.computeBoundingBox();
      wireSystem.geometry.computeBoundingSphere();
    }

    wireSystem.dirtyWireIndices.clear();
  };

  const selectObject = (objectId: string): void => {
    const wiringObject = objects.get(objectId);
    if (!wiringObject) {
      return;
    }

    clearPendingWireStart();
    currentSelection = { objectId, type: "object" };
    showWireHandles(null);
    transformControls.attach(wiringObject.object);
    refreshConnectionPointVisuals();
    emitInteractionMessage();
    onRenderRequest();
  };

  const selectWire = (wireIndex: number): void => {
    if (!wireSystem.wires[wireIndex]) {
      return;
    }

    clearPendingWireStart();
    currentSelection = { type: "wire", wireIndex };
    showWireHandles(wireIndex);
    transformControls.detach();
    refreshConnectionPointVisuals();
    emitInteractionMessage();
    onRenderRequest();
  };

  const selectWireHandle = (wireIndex: number, handleIndex: number): void => {
    const handleMesh = wireSystem.handleMeshes[handleIndex];
    if (!wireSystem.wires[wireIndex] || !handleMesh) {
      return;
    }

    clearPendingWireStart();
    showWireHandles(wireIndex);
    currentSelection = { handleIndex, type: "wire-handle", wireIndex };
    transformControls.attach(handleMesh);
    refreshConnectionPointVisuals();
    emitInteractionMessage();
    onRenderRequest();
  };

  const clearSelection = (): void => {
    clearPendingWireStart();
    currentSelection = null;
    showWireHandles(null);
    transformControls.detach();
    refreshConnectionPointVisuals();
    emitInteractionMessage();
    onRenderRequest();
  };

  const selectConnectionPoint = (objectId: string, portIndex: number): void => {
    if (!objects.get(objectId)?.connectionPoints[portIndex]) {
      return;
    }

    currentSelection = { objectId, portIndex, type: "connection-point" };
    showWireHandles(null);
    transformControls.detach();
    refreshConnectionPointVisuals();
    emitInteractionMessage();
    onRenderRequest();
  };

  const handleConnectionPointSelection = (
    objectId: string,
    portIndex: number
  ): void => {
    const wiringObject = objects.get(objectId);
    const connectionPoint = wiringObject?.connectionPoints[portIndex];
    if (!wiringObject || !connectionPoint) {
      return;
    }

    if (!pendingWireStart) {
      pendingWireStart = { objectId, portIndex };
      selectConnectionPoint(objectId, portIndex);
      emitInteractionMessage(
        `Wire start set to ${wiringObject.object.name || objectId} port ${connectionPoint.name}.`
      );
      return;
    }

    if (
      pendingWireStart.objectId === objectId &&
      pendingWireStart.portIndex === portIndex
    ) {
      clearSelection();
      emitInteractionMessage("Cancelled wire creation.");
      return;
    }

    const start = pendingWireStart;
    pendingWireStart = null;
    const wireIndex = addConnectionWire(
      start.objectId,
      start.portIndex,
      objectId,
      portIndex
    );

    if (wireIndex === null) {
      emitInteractionMessage("Wire capacity reached.");
      onRenderRequest();
      return;
    }

    selectWire(wireIndex);
  };

  const getWireIndexFromSegment = (
    segmentIndex: number | null | undefined
  ): number | null => {
    if (segmentIndex === null || segmentIndex === undefined || segmentIndex < 0) {
      return null;
    }

    const wireIndex = wireSystem.segmentToWire[segmentIndex];
    return wireIndex >= 0 ? wireIndex : null;
  };

  const updatePointer = (event: PointerEvent): void => {
    const bounds = domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
  };

  const handleSceneSelection = (event: PointerEvent): void => {
    if (
      event.button !== 0 ||
      transformControls.dragging ||
      transformControls.axis !== null ||
      pickableMeshes.length === 0
    ) {
      return;
    }

    updatePointer(event);
    raycaster.setFromCamera(pointer, camera);

    const intersections = raycaster.intersectObjects(pickableMeshes, false);
    const hit = intersections.find((intersection) => {
      if (intersection.object !== wireSystem.segments) {
        return true;
      }

      return getWireIndexFromSegment(intersection.faceIndex) !== null;
    });

    if (!hit) {
      clearSelection();
      return;
    }

    if (hit.object.userData.selectionType === "wire-handle") {
      selectWireHandle(hit.object.userData.wireIndex, hit.object.userData.handleIndex);
      return;
    }

    if (hit.object.userData.selectionType === "connection-point") {
      handleConnectionPointSelection(
        hit.object.userData.objectId,
        hit.object.userData.portIndex
      );
      return;
    }

    if (hit.object === wireSystem.segments) {
      const wireIndex = getWireIndexFromSegment(hit.faceIndex);
      if (wireIndex !== null) {
        selectWire(wireIndex);
        return;
      }
    }

    if (typeof hit.object.userData.wiringObjectId === "string") {
      selectObject(hit.object.userData.wiringObjectId);
      return;
    }

    clearSelection();
  };

  const addWireControlPoint = (wireIndex: number): number | null => {
    const wire = wireSystem.wires[wireIndex];
    if (
      !wire ||
      wire.controlPoints.length >= WIRE_CONFIG.maxControlPointsPerWire
    ) {
      return null;
    }

    getWireAnchors(wire, tempStartAnchor, tempEndAnchor);

    let previousPoint = tempStartAnchor;
    let insertIndex = wire.controlPoints.length;
    let longestDistanceSq = -1;
    tempSegmentStart.copy(tempStartAnchor);
    tempSegmentEnd.copy(tempEndAnchor);

    wire.controlPoints.forEach((controlPoint, controlPointIndex) => {
      const distanceSq = previousPoint.distanceToSquared(controlPoint);
      if (distanceSq > longestDistanceSq) {
        longestDistanceSq = distanceSq;
        insertIndex = controlPointIndex;
        tempMidpoint.copy(previousPoint).lerp(controlPoint, 0.5);
        tempSegmentStart.copy(previousPoint);
        tempSegmentEnd.copy(controlPoint);
      }

      previousPoint = controlPoint;
    });

    const endDistanceSq = previousPoint.distanceToSquared(tempEndAnchor);
    if (endDistanceSq > longestDistanceSq) {
      insertIndex = wire.controlPoints.length;
      tempMidpoint.copy(previousPoint).lerp(tempEndAnchor, 0.5);
      tempSegmentStart.copy(previousPoint);
      tempSegmentEnd.copy(tempEndAnchor);
    }

    tempDirection.copy(tempSegmentEnd).sub(tempSegmentStart);
    tempSideways.set(-tempDirection.z, 0, tempDirection.x);
    if (tempSideways.lengthSq() > 1e-6) {
      tempSideways
        .normalize()
        .multiplyScalar(
          ((insertIndex % 2 === 0 ? 1 : -1) * tempDirection.length()) / 10
        );
      tempMidpoint.add(tempSideways);
    }
    tempMidpoint.y += THREE.MathUtils.clamp(tempDirection.length() * 0.08, 0.08, 0.22);

    wire.controlPoints.splice(insertIndex, 0, tempMidpoint.clone());
    markWireDirty(wireIndex);
    showWireHandles(wireIndex);
    onRenderRequest();
    return insertIndex;
  };

  const removeWireControlPoint = (
    wireIndex: number,
    handleIndex: number | null = null
  ): number | null => {
    const wire = wireSystem.wires[wireIndex];
    if (!wire || wire.controlPoints.length === 0) {
      return null;
    }

    const targetIndex =
      handleIndex === null
        ? wire.controlPoints.length - 1
        : THREE.MathUtils.clamp(handleIndex, 0, wire.controlPoints.length - 1);

    wire.controlPoints.splice(targetIndex, 1);
    markWireDirty(wireIndex);
    showWireHandles(wireIndex);
    onRenderRequest();
    return targetIndex;
  };

  const syncSelectedHandleToWire = (): void => {
    if (currentSelection?.type !== "wire-handle") {
      return;
    }

    const wire = wireSystem.wires[currentSelection.wireIndex];
    const handleMesh = wireSystem.handleMeshes[currentSelection.handleIndex];
    if (!wire || !handleMesh) {
      return;
    }

    wire.controlPoints[currentSelection.handleIndex].copy(handleMesh.position);
    markWireDirty(currentSelection.wireIndex);
  };

  const handleSceneKeydown = (event: KeyboardEvent): void => {
    const target = event.target;
    if (
      target instanceof HTMLElement &&
      (target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT")
    ) {
      return;
    }

    if (event.key === "Escape" && (pendingWireStart || currentSelection)) {
      clearSelection();
      event.preventDefault();
      return;
    }

    if (
      event.key !== "+" &&
      event.key !== "=" &&
      event.key !== "-" &&
      event.key !== "_"
    ) {
      return;
    }

    const wireIndex =
      currentSelection?.type === "wire" ||
      currentSelection?.type === "wire-handle"
        ? currentSelection.wireIndex
        : null;

    if (wireIndex === null) {
      return;
    }

    if (event.key === "+" || event.key === "=") {
      const handleIndex = addWireControlPoint(wireIndex);
      if (handleIndex !== null) {
        selectWireHandle(wireIndex, handleIndex);
      } else {
        emitInteractionMessage(`Wire ${wireIndex + 1} already has the maximum number of bends.`);
      }
      event.preventDefault();
      return;
    }

    const removedHandleIndex = removeWireControlPoint(
      wireIndex,
      currentSelection?.type === "wire-handle"
        ? currentSelection.handleIndex
        : null
    );

    if (removedHandleIndex === null) {
      emitInteractionMessage(`Wire ${wireIndex + 1} has no bends left to remove.`);
      event.preventDefault();
      return;
    }

    const remainingHandles = wireSystem.wires[wireIndex].controlPoints.length;
    if (remainingHandles === 0) {
      selectWire(wireIndex);
    } else {
      selectWireHandle(wireIndex, Math.min(removedHandleIndex, remainingHandles - 1));
    }

    event.preventDefault();
  };

  transformControls.addEventListener("change", () => {
    if (currentSelection?.type === "object") {
      markWiresForObjectDirty(currentSelection.objectId);
    } else if (currentSelection?.type === "wire-handle") {
      syncSelectedHandleToWire();
    }

    flushWireSystem();
    onRenderRequest();
  });

  transformControls.addEventListener("dragging-changed", (event) => {
    controls.enabled = !Boolean((event as { value?: unknown }).value);
    onRenderRequest();
  });

  domElement.addEventListener("pointerdown", handleSceneSelection);
  window.addEventListener("keydown", handleSceneKeydown);
  emitInteractionMessage();

  return {
    clear: (): void => {
      transformControls.detach();
      pendingWireStart = null;
      currentSelection = null;

      objects.forEach((wiringObject) => {
        wiringObject.connectionPoints.forEach((connectionPoint) => {
          connectionPoint.marker.removeFromParent();
          connectionPoint.marker.material.dispose();
        });
      });
      objects.clear();

      wireSystem.wires = [];
      wireSystem.objectWireMap.clear();
      wireSystem.dirtyWireIndices.clear();
      wireSystem.segmentToWire.fill(-1);
      wireSystem.positionBuffer.fill(0);
      wireSystem.geometry.instanceCount = 0;
      wireSystem.handleMeshes.forEach((handleMesh) => {
        handleMesh.visible = false;
      });
      refreshPickableMeshes();
      emitInteractionMessage();
      onRenderRequest();
    },
    dispose: (): void => {
      domElement.removeEventListener("pointerdown", handleSceneSelection);
      window.removeEventListener("keydown", handleSceneKeydown);
      transformControls.detach();
      transformControls.dispose();

      objects.forEach((wiringObject) => {
        wiringObject.connectionPoints.forEach((connectionPoint) => {
          connectionPoint.marker.removeFromParent();
          connectionPoint.marker.material.dispose();
        });
      });
      objects.clear();

      markerGeometry.dispose();
      wireSystem.geometry.dispose();
      wireSystem.material.dispose();
      wireSystem.handleMeshes.forEach((handleMesh) => {
        handleMesh.geometry.dispose();
        handleMesh.material.dispose();
      });
      editorGroup.removeFromParent();
    },
    prepareRender: (): void => {
      flushWireSystem();
    },
    registerObject: (id: string, object: THREE.Object3D): void => {
      const pickableObjectMeshes: THREE.Mesh[] = [];

      object.traverse((child: THREE.Object3D) => {
        if (!(child instanceof THREE.Mesh)) {
          return;
        }

        child.userData = {
          ...child.userData,
          wiringObjectId: id,
        };
        pickableObjectMeshes.push(child);
      });

      const connectionPoints = getObjectConnectionPointDefinitions(object).map(
        (connectionPoint, portIndex) => {
          const marker = new THREE.Mesh(markerGeometry, createMarkerMaterial());
          marker.castShadow = true;
          marker.receiveShadow = true;
          marker.position.copy(connectionPoint.position);
          marker.userData = {
            objectId: id,
            portIndex,
            selectionType: "connection-point",
          };
          object.add(marker);

          return {
            direction: connectionPoint.direction.clone().normalize(),
            marker,
            name: connectionPoint.name,
            position: connectionPoint.position.clone(),
          };
        }
      );

      objects.set(id, {
        connectionPoints,
        id,
        object,
        pickableMeshes: pickableObjectMeshes,
      });
      refreshConnectionPointVisuals();
      refreshPickableMeshes();
      onRenderRequest();
    },
    updateSize: (width: number, height: number): void => {
      wireSystem.material.resolution.set(width, height);
      flushWireSystem();
      onRenderRequest();
    },
  };
};
