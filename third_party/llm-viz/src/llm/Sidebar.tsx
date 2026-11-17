// Adapted from bbycroft/llm-viz (MIT), pinned 9da9374. See third_party/llm-viz/README.md at the repository root.
import { createContext, useContext } from 'react';
import type { IProgramState } from './Program';
export const ProgramStateContext = createContext<IProgramState>(null!);
export function useProgramState() { return useContext(ProgramStateContext); }
