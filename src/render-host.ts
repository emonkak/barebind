/// <reference path="../typings/scheduler.d.ts" />

import type {
  CommitContext,
  Effect,
  Primitive,
  SlotType,
  Template,
  TemplateMode,
} from './directive.js';
import type { Part } from './part.js';

export const CommitPhase = {
  Mutation: 0,
  Layout: 1,
  Passive: 2,
} as const;

export type CommitPhase = (typeof CommitPhase)[keyof typeof CommitPhase];

export interface RequestCallbackOptions {
  priority?: TaskPriority;
}

export interface RenderHost {
  commitEffects(
    effects: Effect[],
    phase: CommitPhase,
    context: CommitContext,
  ): void;
  createTemplate(
    strings: readonly string[],
    binds: readonly unknown[],
    placeholder: string,
    mode: TemplateMode,
  ): Template<readonly unknown[]>;
  getCurrentPriority(): TaskPriority;
  requestCallback(
    callback: () => Promise<void> | void,
    options?: RequestCallbackOptions,
  ): Promise<void>;
  resolvePrimitive(value: unknown, part: Part): Primitive<unknown>;
  resolveSlotType(value: unknown, part: Part): SlotType;
  startViewTransition(callback: () => void | Promise<void>): Promise<void>;
  yieldToMain(): Promise<void>;
}
