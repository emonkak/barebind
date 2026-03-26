/// <reference path="../typings/scheduler.d.ts" />

import type {
  CommitPhase,
  DirectiveType,
  EffectQueue,
  Lanes,
  Primitive,
  Scope,
  TemplateMode,
} from './core.js';

export interface HostAdapter<TPart = unknown, TRenderer = unknown> {
  flushEffects(effects: EffectQueue, phase: CommitPhase): void;
  getDefaultLanes(): Lanes;
  getUpdatePriority(): TaskPriority;
  requestCallback<T>(
    callback: () => T | PromiseLike<T>,
    options?: RequestCallbackOptions,
  ): Promise<T>;
  requestRenderer(scope: Scope): TRenderer;
  resolvePrimitive(source: unknown, part: TPart): Primitive<unknown>;
  resolveTemplate(
    strings: readonly string[],
    exprs: readonly unknown[],
    mode: TemplateMode,
    placeholder: string,
  ): DirectiveType<readonly unknown[]>;
  startViewTransition(callback: () => Promise<void> | void): Promise<void>;
  yieldToMain(): Promise<void>;
}

export type RequestCallbackOptions = SchedulerPostTaskOptions;
