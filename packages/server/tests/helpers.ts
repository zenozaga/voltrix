import type { CompiledPipeline } from '../src/hooks/pipeline-runner.js';

/** A no-op compiled pipeline for use in unit tests. */
export const EMPTY_PIPELINE: CompiledPipeline = () => Promise.resolve();
