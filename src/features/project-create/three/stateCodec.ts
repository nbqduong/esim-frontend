import type { ObjectState } from "./createObjectManager";

export const LED_OFF_STATE = "LED_Off";
export const LED_ON_STATE = "LED_On";

export const LED_OFF_CODE = 0;
export const LED_ON_CODE = 1;

const STATE_TO_CODE = new Map<ObjectState, number>([
  [LED_OFF_STATE, LED_OFF_CODE],
  [LED_ON_STATE, LED_ON_CODE],
]);

const CODE_TO_STATE = new Map<number, ObjectState>([
  [LED_OFF_CODE, LED_OFF_STATE],
  [LED_ON_CODE, LED_ON_STATE],
]);

export const encodeObjectState = (state: ObjectState): number => {
  const code = STATE_TO_CODE.get(state);

  if (code === undefined) {
    throw new Error(`Unsupported object state "${state}".`);
  }

  return code;
};

export const decodeObjectState = (
  stateCode: number
): ObjectState | undefined => CODE_TO_STATE.get(stateCode);
