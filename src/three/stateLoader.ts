import type { ModelCatalog } from "./create3DViewer";
import type { ObjectManager, ObjectState } from "./createObjectManager";
import createSimulatorModule, {
  type SimulatorModule,
} from "../wasm/generated/simulator.js";
import { decodeObjectState, encodeObjectState } from "./stateCodec";

export interface CreateStateLoaderOptions {
  catalog: ModelCatalog;
  objectManager: ObjectManager;
}

export interface StateLoader {
  pause: () => void;
  start: () => Promise<void>;
  stop: () => void;
}

interface CatalogObjectRecord {
  defaultState: ObjectState;
  id: string;
}

export const TIME_INTERVAL = 100;

const buildCatalogObjectRecords = (
  catalog: ModelCatalog
): CatalogObjectRecord[] => {
  const objectRecords: CatalogObjectRecord[] = [];

  catalog.forEach((entry) => {
    entry.objects.forEach((object) => {
      objectRecords.push({
        defaultState: object.state,
        id: object.id,
      });
    });
  });

  return objectRecords;
};

const buildDefaultStateMap = (
  catalogObjectRecords: CatalogObjectRecord[]
): Map<string, ObjectState> => {
  const defaultStates = new Map<string, ObjectState>();

  catalogObjectRecords.forEach((record) => {
    defaultStates.set(record.id, record.defaultState);
  });

  return defaultStates;
};

const applyStates = (
  objectManager: ObjectManager,
  stateMap: Map<string, ObjectState>
): boolean => {
  let hasStateChange = false;

  stateMap.forEach((state, id) => {
    hasStateChange =
      objectManager.setObjectState(id, state, { notify: false }) || hasStateChange;
  });

  if (hasStateChange) {
    objectManager.notifyChange();
  }

  return hasStateChange;
};

export const createStateLoader = ({
  catalog,
  objectManager,
}: CreateStateLoaderOptions): StateLoader => {
  const catalogObjectRecords = buildCatalogObjectRecords(catalog);
  const defaultStates = buildDefaultStateMap(catalogObjectRecords);
  const defaultStateCodes = Uint32Array.from(
    catalogObjectRecords.map((record) => encodeObjectState(record.defaultState))
  );

  let simulatorModule: SimulatorModule | null = null;
  let pairCount = 0;
  let pairView: Uint32Array | null = null;
  let startPromise: Promise<void> | null = null;
  let timeoutId: number | null = null;
  let running = false;

  const clearTimer = (): void => {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  const resetToDefaultState = (): void => {
    applyStates(objectManager, defaultStates);
  };

  const destroySimulator = (): void => {
    if (!simulatorModule) {
      pairView = null;
      pairCount = 0;
      return;
    }

    simulatorModule._pause_loop();
    simulatorModule._destroy_simulator();
    simulatorModule = null;
    pairView = null;
    pairCount = 0;
  };

  const applyLatestSnapshot = (): boolean => {
    if (!pairView) {
      return false;
    }

    let hasStateChange = false;

    for (let index = 0; index < pairCount; index += 1) {
      const pairOffset = index * 2;
      const catalogIndex = pairView[pairOffset];
      const objectRecord = catalogObjectRecords[catalogIndex];

      if (!objectRecord) {
        continue;
      }

      const state = decodeObjectState(pairView[pairOffset + 1]);

      if (!state) {
        continue;
      }

      hasStateChange =
        objectManager.setObjectState(objectRecord.id, state, { notify: false }) ||
        hasStateChange;
    }

    if (hasStateChange) {
      objectManager.notifyChange();
    }

    return hasStateChange;
  };

  const scheduleNextPoll = (): void => {
    clearTimer();

    if (!running) {
      return;
    }

    timeoutId = window.setTimeout(() => {
      timeoutId = null;

      if (!running) {
        return;
      }

      applyLatestSnapshot();
      scheduleNextPoll();
    }, TIME_INTERVAL);
  };

  const initializeSimulator = async (): Promise<void> => {
    if (simulatorModule && pairView) {
      return;
    }

    const nextSimulatorModule = await createSimulatorModule();
    const defaultStatePtr = nextSimulatorModule._malloc(defaultStateCodes.byteLength);

    try {
      nextSimulatorModule.HEAPU32.set(
        defaultStateCodes,
        defaultStatePtr / Uint32Array.BYTES_PER_ELEMENT
      );

      const initResult = nextSimulatorModule._init_simulator(
        catalogObjectRecords.length,
        defaultStatePtr
      );

      if (initResult === 0) {
        throw new Error("Unable to initialize the WASM simulator.");
      }

      const nextPairCount = nextSimulatorModule._get_pair_count();
      const pairPtr = nextSimulatorModule._get_pairs_ptr();

      if (nextPairCount !== catalogObjectRecords.length || pairPtr === 0) {
        throw new Error("The WASM simulator returned an invalid state buffer.");
      }

      simulatorModule = nextSimulatorModule;
      pairCount = nextPairCount;
      pairView = new Uint32Array(
        nextSimulatorModule.HEAPU32.buffer,
        pairPtr,
        pairCount * 2
      );
    } catch (error) {
      nextSimulatorModule._destroy_simulator();
      throw error;
    } finally {
      nextSimulatorModule._free(defaultStatePtr);
    }
  };

  return {
    pause: (): void => {
      if (!running) {
        return;
      }

      running = false;
      clearTimer();
      simulatorModule?._pause_loop();
    },
    start: async (): Promise<void> => {
      if (running) {
        return;
      }

      if (startPromise) {
        return startPromise;
      }

      startPromise = (async () => {
        await initializeSimulator();

        simulatorModule?._start_loop();
        running = true;
        scheduleNextPoll();
      })();

      try {
        await startPromise;
      } catch (error) {
        running = false;
        clearTimer();
        destroySimulator();
        throw error;
      } finally {
        startPromise = null;
      }
    },
    stop: (): void => {
      running = false;
      clearTimer();
      destroySimulator();
      resetToDefaultState();
    },
  };
};
