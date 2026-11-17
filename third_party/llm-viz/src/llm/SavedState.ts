// Adapted from bbycroft/llm-viz (MIT), pinned 9da9374. See third_party/llm-viz/README.md at the repository root.
import { ICamera } from "./Camera";

export interface ISavedState {
    phase: number;
    phaseTime: number;
    camera: ICamera;
}

export let SavedState = {
    state: null as ISavedState | null,
};
