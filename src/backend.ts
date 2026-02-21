import type {
  CommitPhase,
  EffectQueue,
  Layout,
  Part,
  Primitive,
  RequestCallbackOptions,
  Template,
  TemplateMode,
} from './internal.js';

export interface Backend {
  flushEffects(effects: EffectQueue, phase: CommitPhase): void;
  getExecutionModes(): ExecutionModes;
  getUpdatePriority(): TaskPriority;
  parseTemplate(
    strings: readonly string[],
    values: readonly unknown[],
    markerIdentifier: string,
    mode: TemplateMode,
  ): Template<readonly unknown[]>;
  requestCallback<T>(
    callback: () => T | PromiseLike<T>,
    options?: RequestCallbackOptions,
  ): Promise<T>;
  resolveLayout(source: unknown, part: Part): Layout;
  resolvePrimitive(source: unknown, part: Part): Primitive<unknown>;
  startViewTransition(callback: () => Promise<void> | void): Promise<void>;
  yieldToMain(): Promise<void>;
}

// biome-ignore format: Align ExecutionMode flags
export const ExecutionMode = {
  NoMode:         0,
  ConcurrentMode: 0b1,
};

export type ExecutionModes = number;
