/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module 'vuex' {
  export * from 'vuex/types/index.d.ts'
}

declare module '@/wasm/generated/simulator.js' {
  export interface SimulatorModule {
    HEAPU32: Uint32Array
    _destroy_simulator: () => void
    _free: (ptr: number) => void
    _get_pair_count: () => number
    _get_pairs_ptr: () => number
    _init_simulator: (componentCount: number, defaultStatePtr: number) => number
    _malloc: (size: number) => number
    _pause_loop: () => void
    _start_loop: () => void
  }

  const createSimulatorModule: () => Promise<SimulatorModule>
  export default createSimulatorModule
}

declare module '../wasm/generated/simulator.js' {
  export * from '@/wasm/generated/simulator.js'
  export { default } from '@/wasm/generated/simulator.js'
}

declare module '*simulator.js' {
  export interface SimulatorModule {
    HEAPU32: Uint32Array
    _destroy_simulator: () => void
    _free: (ptr: number) => void
    _get_pair_count: () => number
    _get_pairs_ptr: () => number
    _init_simulator: (componentCount: number, defaultStatePtr: number) => number
    _malloc: (size: number) => number
    _pause_loop: () => void
    _start_loop: () => void
  }

  const createSimulatorModule: () => Promise<SimulatorModule>
  export default createSimulatorModule
}
