import type {
  CommitContext,
  CommitPhase,
  Effect,
  Part,
  Primitive,
  RequestCallbackOptions,
  SlotType,
  Template,
  TemplateMode,
} from './core.js';

export interface Backend {
  commitEffects(
    effects: Effect[],
    phase: CommitPhase,
    context: CommitContext,
  ): void;
  getCurrentPriority(): TaskPriority;
  parseTemplate(
    strings: readonly string[],
    binds: readonly unknown[],
    placeholder: string,
    mode: TemplateMode,
  ): Template<readonly unknown[]>;
  requestCallback(
    callback: () => Promise<void> | void,
    options?: RequestCallbackOptions,
  ): Promise<void>;
  resolvePrimitive(value: unknown, part: Part): Primitive<unknown>;
  resolveSlotType(value: unknown, part: Part): SlotType;
  startViewTransition(callback: () => void | Promise<void>): Promise<void>;
  yieldToMain(): Promise<void>;
}
