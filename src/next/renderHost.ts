import type {
  Bindable,
  Effect,
  Primitive,
  SlotType,
  Template,
  TemplateMode,
} from './core.js';
import type { Part } from './part.js';

export interface RenderHost {
  commitEffects(effects: Effect[], phase: CommitPhase): void;
  createTemplate(
    strings: readonly string[],
    binds: readonly Bindable<unknown>[],
    placeholder: string,
    mode: TemplateMode,
  ): Template<readonly Bindable<unknown>[]>;
  getCurrentTaskPriority(): TaskPriority;
  requestCallback(
    callback: () => Promise<void> | void,
    options?: RequestCallbackOptions,
  ): Promise<void>;
  resolvePrimitive(part: Part): Primitive<unknown>;
  resolveSlotType(part: Part): SlotType;
  startViewTransition(callback: () => void | Promise<void>): Promise<void>;
  yieldToMain(): Promise<void>;
}

export const CommitPhase = {
  Mutation: 0,
  Layout: 1,
  Passive: 2,
} as const;

export type CommitPhase = (typeof CommitPhase)[keyof typeof CommitPhase];

export interface RequestCallbackOptions {
  priority?: TaskPriority;
}
