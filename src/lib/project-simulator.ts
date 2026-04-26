import createSimulatorModule, { type SimulatorModule } from "@/wasm/generated/simulator.js";
import type { ModelCatalog } from "@/three/create3DViewer";
import type { ObjectState } from "@/three/createObjectManager";
import { decodeObjectState, encodeObjectState } from "@/three/stateCodec";

const POLL_INTERVAL_MS = 100;

interface CatalogObjectRecord {
  defaultState: ObjectState;
  description: string;
  id: string;
  modelUrl: string;
  name: string;
}

export interface ProjectSimulator {
  destroy: () => void;
  start: () => Promise<void>;
  stop: () => void;
}

function flattenCatalog(catalog: ModelCatalog): CatalogObjectRecord[] {
  const records: CatalogObjectRecord[] = [];

  catalog.forEach((entry) => {
    entry.objects.forEach((object) => {
      records.push({
        defaultState: object.state,
        description: object.description,
        id: object.id,
        modelUrl: entry.modelUrl,
        name: object.name,
      });
    });
  });

  return records;
}

function buildDefaultStateMap(records: CatalogObjectRecord[]): Map<string, ObjectState> {
  const stateMap = new Map<string, ObjectState>();

  records.forEach((record) => {
    stateMap.set(record.id, record.defaultState);
  });

  return stateMap;
}

function renderCatalog(
  catalog: ModelCatalog,
  stateMap: Map<string, ObjectState>,
): string {
  return JSON.stringify(
    catalog.map((entry) => ({
      modelUrl: entry.modelUrl,
      objects: entry.objects.map((object) => ({
        ...object,
        state: stateMap.get(object.id) ?? object.state,
      })),
    })),
    null,
    2,
  );
}

export function createProjectSimulator(
  catalog: ModelCatalog,
  onSnapshot: (content: string) => void,
): ProjectSimulator {
  const catalogObjectRecords = flattenCatalog(catalog);
  const defaultStates = buildDefaultStateMap(catalogObjectRecords);
  const defaultStateCodes = Uint32Array.from(
    catalogObjectRecords.map((record) => encodeObjectState(record.defaultState)),
  );

  let simulatorModule: SimulatorModule | null = null;
  let pairCount = 0;
  let pairView: Uint32Array | null = null;
  let pollTimer: number | null = null;
  let running = false;
  let startPromise: Promise<void> | null = null;

  function clearPollTimer(): void {
    if (pollTimer !== null) {
      window.clearTimeout(pollTimer);
      pollTimer = null;
    }
  }

  function emitDefaultSnapshot(): void {
    onSnapshot(renderCatalog(catalog, defaultStates));
  }

  function buildSnapshotStateMap(): Map<string, ObjectState> {
    const nextStateMap = new Map(defaultStates);

    if (!pairView) {
      return nextStateMap;
    }

    for (let index = 0; index < pairCount; index += 1) {
      const pairOffset = index * 2;
      const catalogIndex = pairView[pairOffset];
      const objectRecord = catalogObjectRecords[catalogIndex];
      const state = decodeObjectState(pairView[pairOffset + 1]);

      if (!objectRecord || !state) {
        continue;
      }

      nextStateMap.set(objectRecord.id, state);
    }

    return nextStateMap;
  }

  function emitLiveSnapshot(): void {
    onSnapshot(renderCatalog(catalog, buildSnapshotStateMap()));
  }

  function schedulePoll(): void {
    clearPollTimer();

    if (!running) {
      return;
    }

    pollTimer = window.setTimeout(() => {
      pollTimer = null;

      if (!running) {
        return;
      }

      emitLiveSnapshot();
      schedulePoll();
    }, POLL_INTERVAL_MS);
  }

  async function initialize(): Promise<void> {
    if (simulatorModule && pairView) {
      return;
    }

    if (startPromise) {
      return startPromise;
    }

    startPromise = (async () => {
      const nextSimulatorModule = await createSimulatorModule();
      const defaultStatePtr = nextSimulatorModule._malloc(defaultStateCodes.byteLength);

      try {
        nextSimulatorModule.HEAPU32.set(
          defaultStateCodes,
          defaultStatePtr / Uint32Array.BYTES_PER_ELEMENT,
        );

        const initResult = nextSimulatorModule._init_simulator(
          catalogObjectRecords.length,
          defaultStatePtr,
        );

        if (initResult === 0) {
          throw new Error("The simulator could not be initialized.");
        }

        const nextPairCount = nextSimulatorModule._get_pair_count();
        const pairPtr = nextSimulatorModule._get_pairs_ptr();

        if (nextPairCount !== catalogObjectRecords.length || pairPtr === 0) {
          throw new Error("The simulator returned an invalid state buffer.");
        }

        simulatorModule = nextSimulatorModule;
        pairCount = nextPairCount;
        pairView = new Uint32Array(
          nextSimulatorModule.HEAPU32.buffer,
          pairPtr,
          pairCount * 2,
        );
      } catch (error) {
        nextSimulatorModule._destroy_simulator();
        throw error;
      } finally {
        nextSimulatorModule._free(defaultStatePtr);
        startPromise = null;
      }
    })();

    return startPromise;
  }

  return {
    destroy: (): void => {
      running = false;
      clearPollTimer();
      if (simulatorModule) {
        simulatorModule._pause_loop();
        simulatorModule._destroy_simulator();
      }
      simulatorModule = null;
      pairCount = 0;
      pairView = null;
    },
    start: async (): Promise<void> => {
      await initialize();

      if (!simulatorModule) {
        throw new Error("The simulator module is not available.");
      }

      simulatorModule._start_loop();
      running = true;
      emitLiveSnapshot();
      schedulePoll();
    },
    stop: (): void => {
      running = false;
      clearPollTimer();
      if (simulatorModule) {
        simulatorModule._pause_loop();
      }
      emitDefaultSnapshot();
    },
  };
}
