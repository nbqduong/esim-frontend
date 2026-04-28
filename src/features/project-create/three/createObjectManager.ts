import * as THREE from "three";

export type ObjectState = string;

export interface RegisterObjectOptions {
  id: string;
  object: THREE.Object3D;
  state: ObjectState;
}

export interface SetObjectStateOptions {
  notify?: boolean;
}

export interface ObjectRecord {
  id: string;
  object: THREE.Object3D;
  state: ObjectState;
}

export interface ObjectManager {
  clear: () => void;
  getObjectById: (id: string) => THREE.Object3D | undefined;
  getObjectRecord: (id: string) => ObjectRecord | undefined;
  getObjectState: (id: string) => ObjectState | undefined;
  hasObject: (id: string) => boolean;
  listObjects: () => ObjectRecord[];
  notifyChange: () => void;
  registerObject: (options: RegisterObjectOptions) => void;
  setObjectState: (
    id: string,
    state: ObjectState,
    options?: SetObjectStateOptions
  ) => boolean;
}

export interface CreateObjectManagerOptions {
  onChange?: () => void;
  onStateChange?: (object: THREE.Object3D, state: ObjectState) => void;
}

export const createObjectManager = ({
  onChange,
  onStateChange,
}: CreateObjectManagerOptions = {}): ObjectManager => {
  const objectsById = new Map<string, ObjectRecord>();

  const notifyChange = (): void => {
    onChange?.();
  };

  const applyStateChange = (
    object: THREE.Object3D,
    state: ObjectState
  ): void => {
    onStateChange?.(object, state);
  };

  const getObjectRecord = (id: string): ObjectRecord | undefined =>
    objectsById.get(id);

  const setObjectState = (
    id: string,
    state: ObjectState,
    { notify = true }: SetObjectStateOptions = {}
  ): boolean => {
    const record = objectsById.get(id);

    if (!record) {
      return false;
    }

    if (record.state === state) {
      return false;
    }

    record.state = state;
    record.object.userData = {
      ...record.object.userData,
      id,
      state,
    };
    applyStateChange(record.object, state);

    if (notify) {
      notifyChange();
    }

    return true;
  };

  return {
    clear: (): void => {
      objectsById.clear();
      notifyChange();
    },
    getObjectById: (id: string): THREE.Object3D | undefined =>
      objectsById.get(id)?.object,
    getObjectRecord,
    getObjectState: (id: string): ObjectState | undefined =>
      objectsById.get(id)?.state,
    hasObject: (id: string): boolean => objectsById.has(id),
    listObjects: (): ObjectRecord[] => Array.from(objectsById.values()),
    notifyChange,
    registerObject: ({
      id,
      object,
      state,
    }: RegisterObjectOptions): void => {
      if (objectsById.has(id)) {
        throw new Error(`Duplicate object id "${id}" in model catalog.`);
      }

      object.userData = {
        ...object.userData,
        id,
        state,
      };
      applyStateChange(object, state);

      objectsById.set(id, {
        id,
        object,
        state,
      });
    },
    setObjectState,
  };
};
