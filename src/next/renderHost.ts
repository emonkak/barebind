import type {
  Bindable,
  Effect,
  SlotType,
  Template,
  TemplateMode,
} from './core.js';
import type { Part } from './part.js';
import type { Primitive } from './primitives/primitive.js';

export interface RenderHost {
  commitEffects(effects: Effect[], phase: CommitPhase): void;
  createMarkerNode(): ChildNode;
  createTemplate(
    strings: readonly string[],
    binds: readonly Bindable<unknown>[],
    mode: TemplateMode,
  ): Template<readonly Bindable<unknown>[]>;
  getTaskPriority(): TaskPriority;
  getTemplatePlaceholder(): string;
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
