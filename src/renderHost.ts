/// <reference path="../typings/scheduler.d.ts" />

import type {
  Bindable,
  Effect,
  Primitive,
  SlotType,
  Template,
  TemplateMode,
} from './directive.js';
import type { CommitPhase } from './hook.js';
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

export interface RequestCallbackOptions {
  priority?: TaskPriority;
}
