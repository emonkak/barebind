import { describe, expect, it, vi } from 'vitest';
import { ExecutionMode } from '@/backend.js';
import { ComponentBinding, createComponent } from '@/component.js';
import {
  $directive,
  type Bindable,
  BoundaryType,
  CommitPhase,
  type ComponentState,
  type Coroutine,
  createScope,
  EffectQueue,
  Lane,
  PartType,
} from '@/internal.js';
import { RenderSession } from '@/render-session.js';
import { RenderError } from '@/runtime.js';
import { HTML_NAMESPACE_URI } from '@/template/template.js';
import {
  createRenderFrame,
  createRuntime,
  MockBindable,
  MockCoroutine,
  MockDirective,
  MockLayout,
  MockObserver,
  MockPrimitive,
  MockSlot,
  MockTemplate,
} from '../mocks.js';
import { waitForTimeout } from '../test-helpers.js';

describe('Runtime', () => {
  describe('flushUpdates()', () => {
    describe('in concurrent mode', () => {
      it('commits effects asynchronously', async () => {
        const mutationEffect = {
          commit: vi.fn(),
        };
        const layoutEffect = {
          commit: vi.fn(),
        };
        const passiveEffect = {
          commit: vi.fn(),
        };
        const observer = new MockObserver();
        const runtime = createRuntime(ExecutionMode.ConcurrentMode);

        const requestCallbackSpy = vi.spyOn(
          runtime['_backend'],
          'requestCallback',
        );
        const startViewTransitionSpy = vi.spyOn(
          runtime['_backend'],
          'startViewTransition',
        );

        const removeObserver = runtime.addObserver(observer);

        SESSION1: {
          const coroutine = new MockCoroutine((session) => {
            session.frame.mutationEffects.push(
              mutationEffect,
              session.scope.level,
            );
            session.frame.layoutEffects.push(layoutEffect, session.scope.level);
          });

          const handle1 = runtime.scheduleUpdate(coroutine, {
            priority: 'user-blocking',
          });
          const handle2 = runtime.scheduleUpdate(coroutine, {
            priority: 'user-blocking',
          });

          expect(await handle1.scheduled).toStrictEqual({
            canceled: false,
            done: true,
          });
          expect(await handle2.scheduled).toStrictEqual({
            canceled: false,
            done: true,
          });

          expect(runtime.getPendingUpdates().toArray()).toStrictEqual([
            expect.objectContaining({
              coroutine,
              lanes: Lane.DefaultLane | Lane.UserBlockingLane,
            }),
            expect.objectContaining({
              coroutine,
              lanes: Lane.DefaultLane | Lane.UserBlockingLane,
            }),
          ]);

          expect(await handle1.finished).toStrictEqual({
            canceled: false,
            done: true,
          });
          expect(await handle2.finished).toStrictEqual({
            canceled: true,
            done: true,
          });

          expect(runtime.getPendingUpdates().toArray()).toStrictEqual([]);

          expect(requestCallbackSpy).toHaveBeenCalledTimes(3);
          expect(startViewTransitionSpy).toHaveBeenCalledTimes(0);
          expect(mutationEffect.commit).toHaveBeenCalledTimes(1);
          expect(layoutEffect.commit).toHaveBeenCalledTimes(1);
          expect(passiveEffect.commit).toHaveBeenCalledTimes(0);
          expect(observer.flushEvents()).toStrictEqual([
            {
              type: 'update-start',
              id: 0,
              lanes: Lane.DefaultLane | Lane.UserBlockingLane,
            },
            {
              type: 'render-phase-start',
              id: 0,
            },
            {
              type: 'render-phase-end',
              id: 0,
            },
            {
              type: 'commit-phase-start',
              id: 0,
              mutationEffects: expect.any(EffectQueue),
              layoutEffects: expect.any(EffectQueue),
              passiveEffects: expect.any(EffectQueue),
            },
            {
              type: 'effect-commit-start',
              id: 0,
              phase: CommitPhase.Mutation,
              effects: expect.any(EffectQueue),
            },
            {
              type: 'effect-commit-end',
              id: 0,
              phase: CommitPhase.Mutation,
              effects: expect.any(EffectQueue),
            },
            {
              type: 'effect-commit-start',
              id: 0,
              phase: CommitPhase.Layout,
              effects: expect.any(EffectQueue),
            },
            {
              type: 'effect-commit-end',
              id: 0,
              phase: CommitPhase.Layout,
              effects: expect.any(EffectQueue),
            },
            {
              type: 'commit-phase-end',
              id: 0,
              mutationEffects: expect.any(EffectQueue),
              layoutEffects: expect.any(EffectQueue),
              passiveEffects: expect.any(EffectQueue),
            },
            {
              type: 'update-success',
              id: 0,
              lanes: Lane.DefaultLane | Lane.UserBlockingLane,
            },
          ]);
        }

        SESSION2: {
          const coroutine = new MockCoroutine((session) => {
            session.frame.pendingCoroutines.push(subcoroutine);
          });
          const subcoroutine = new MockCoroutine((session) => {
            session.frame.mutationEffects.push(
              mutationEffect,
              session.scope.level,
            );
            session.frame.passiveEffects.push(
              passiveEffect,
              session.scope.level,
            );
          });

          const handle = runtime.scheduleUpdate(coroutine, {
            priority: 'user-visible',
            viewTransition: true,
          });

          expect(await handle.scheduled).toStrictEqual({
            canceled: false,
            done: true,
          });

          expect(runtime.getPendingUpdates().toArray()).toStrictEqual([
            expect.objectContaining({
              coroutine,
              lanes:
                Lane.DefaultLane |
                Lane.UserVisibleLane |
                Lane.ViewTransitionLane,
            }),
          ]);

          expect(await handle.finished).toStrictEqual({
            canceled: false,
            done: true,
          });
          await waitForTimeout(1);

          expect(runtime.getPendingUpdates().toArray()).toStrictEqual([]);

          expect(requestCallbackSpy).toHaveBeenCalledTimes(5);
          expect(startViewTransitionSpy).toHaveBeenCalledTimes(1);
          expect(mutationEffect.commit).toHaveBeenCalledTimes(2);
          expect(layoutEffect.commit).toHaveBeenCalledTimes(1);
          expect(passiveEffect.commit).toHaveBeenCalledTimes(1);
          expect(observer.flushEvents()).toStrictEqual([
            {
              type: 'update-start',
              id: 1,
              lanes:
                Lane.DefaultLane |
                Lane.UserVisibleLane |
                Lane.ViewTransitionLane,
            },
            {
              type: 'render-phase-start',
              id: 1,
            },
            {
              type: 'render-phase-end',
              id: 1,
            },
            {
              type: 'commit-phase-start',
              id: 1,
              mutationEffects: expect.any(EffectQueue),
              layoutEffects: expect.any(EffectQueue),
              passiveEffects: expect.any(EffectQueue),
            },
            {
              type: 'effect-commit-start',
              id: 1,
              phase: CommitPhase.Mutation,
              effects: expect.any(EffectQueue),
            },
            {
              type: 'effect-commit-end',
              id: 1,
              phase: CommitPhase.Mutation,
              effects: expect.any(EffectQueue),
            },
            {
              type: 'update-success',
              id: 1,
              lanes:
                Lane.DefaultLane |
                Lane.UserVisibleLane |
                Lane.ViewTransitionLane,
            },
            {
              type: 'effect-commit-start',
              id: 1,
              phase: CommitPhase.Passive,
              effects: expect.any(EffectQueue),
            },
            {
              type: 'effect-commit-end',
              id: 1,
              phase: CommitPhase.Passive,
              effects: expect.any(EffectQueue),
            },
            {
              type: 'commit-phase-end',
              id: 1,
              mutationEffects: expect.any(EffectQueue),
              layoutEffects: expect.any(EffectQueue),
              passiveEffects: expect.any(EffectQueue),
            },
          ]);
        }

        SESSION3: {
          removeObserver();

          expect(runtime.getPendingUpdates().toArray()).toStrictEqual([]);

          expect(requestCallbackSpy).toHaveBeenCalledTimes(5);
          expect(startViewTransitionSpy).toHaveBeenCalledTimes(1);
          expect(mutationEffect.commit).toHaveBeenCalledTimes(2);
          expect(layoutEffect.commit).toHaveBeenCalledTimes(1);
          expect(passiveEffect.commit).toHaveBeenCalledTimes(1);
          expect(observer.flushEvents()).toStrictEqual([]);
        }
      });

      it('commits effects synchronously if the flushSync option is specified', async () => {
        const mutationEffect = {
          commit: vi.fn(),
        };
        const layoutEffect = {
          commit: vi.fn(),
        };
        const passiveEffect = {
          commit: vi.fn(),
        };
        const observer = new MockObserver();
        const runtime = createRuntime(ExecutionMode.ConcurrentMode);

        const removeObserver = runtime.addObserver(observer);

        SESSION1: {
          const coroutine = new MockCoroutine((session) => {
            session.frame.mutationEffects.push(
              mutationEffect,
              session.scope.level,
            );
            session.frame.layoutEffects.push(layoutEffect, session.scope.level);
            session.frame.passiveEffects.push(
              passiveEffect,
              session.scope.level,
            );
          });

          const handle1 = runtime.scheduleUpdate(coroutine, {
            flushSync: true,
            priority: 'user-blocking',
            triggerFlush: false,
          });
          const handle2 = runtime.scheduleUpdate(coroutine, {
            flushSync: true,
            priority: 'user-blocking',
            triggerFlush: false,
          });

          expect(await handle1.scheduled).toStrictEqual({
            canceled: false,
            done: true,
          });
          expect(await handle2.scheduled).toStrictEqual({
            canceled: false,
            done: true,
          });

          expect(runtime.getPendingUpdates().toArray()).toStrictEqual([
            expect.objectContaining({
              coroutine,
              lanes: Lane.DefaultLane | Lane.UserBlockingLane | Lane.SyncLane,
            }),
            expect.objectContaining({
              coroutine,
              lanes: Lane.DefaultLane | Lane.UserBlockingLane | Lane.SyncLane,
            }),
          ]);

          runtime.flushUpdates();

          expect(runtime.getPendingUpdates().toArray()).toStrictEqual([]);

          expect(await handle1.finished).toStrictEqual({
            canceled: false,
            done: true,
          });
          expect(await handle2.finished).toStrictEqual({
            canceled: true,
            done: true,
          });

          expect(mutationEffect.commit).toHaveBeenCalledTimes(1);
          expect(layoutEffect.commit).toHaveBeenCalledTimes(1);
          expect(passiveEffect.commit).toHaveBeenCalledTimes(1);
          expect(observer.flushEvents()).toStrictEqual([
            {
              type: 'update-start',
              id: 0,
              lanes: Lane.DefaultLane | Lane.UserBlockingLane | Lane.SyncLane,
            },
            {
              type: 'render-phase-start',
              id: 0,
            },
            {
              type: 'render-phase-end',
              id: 0,
            },
            {
              type: 'commit-phase-start',
              id: 0,
              mutationEffects: expect.any(EffectQueue),
              layoutEffects: expect.any(EffectQueue),
              passiveEffects: expect.any(EffectQueue),
            },
            {
              type: 'effect-commit-start',
              id: 0,
              phase: CommitPhase.Mutation,
              effects: expect.any(EffectQueue),
            },
            {
              type: 'effect-commit-end',
              id: 0,
              phase: CommitPhase.Mutation,
              effects: expect.any(EffectQueue),
            },
            {
              type: 'effect-commit-start',
              id: 0,
              phase: CommitPhase.Layout,
              effects: expect.any(EffectQueue),
            },
            {
              type: 'effect-commit-end',
              id: 0,
              phase: CommitPhase.Layout,
              effects: expect.any(EffectQueue),
            },
            {
              type: 'effect-commit-start',
              id: 0,
              phase: CommitPhase.Passive,
              effects: expect.any(EffectQueue),
            },
            {
              type: 'effect-commit-end',
              id: 0,
              phase: CommitPhase.Passive,
              effects: expect.any(EffectQueue),
            },
            {
              type: 'commit-phase-end',
              id: 0,
              mutationEffects: expect.any(EffectQueue),
              layoutEffects: expect.any(EffectQueue),
              passiveEffects: expect.any(EffectQueue),
            },
            {
              type: 'update-success',
              id: 0,
              lanes: Lane.DefaultLane | Lane.UserBlockingLane | Lane.SyncLane,
            },
          ]);
        }

        SESSION2: {
          const coroutine = new MockCoroutine((session) => {
            session.frame.pendingCoroutines.push(subcoroutine);
          });
          const subcoroutine = new MockCoroutine((session) => {
            session.frame.mutationEffects.push(
              mutationEffect,
              session.scope.level,
            );
            session.frame.layoutEffects.push(layoutEffect, session.scope.level);
          });

          const handle = runtime.scheduleUpdate(coroutine, {
            flushSync: true,
            priority: 'user-visible',
            triggerFlush: false,
            viewTransition: true,
          });

          expect(await handle.scheduled).toStrictEqual({
            canceled: false,
            done: true,
          });

          expect(runtime.getPendingUpdates().toArray()).toStrictEqual([
            expect.objectContaining({
              coroutine,
              lanes:
                Lane.DefaultLane |
                Lane.UserVisibleLane |
                Lane.SyncLane |
                Lane.ViewTransitionLane,
            }),
          ]);

          runtime.flushUpdates();

          expect(runtime.getPendingUpdates().toArray()).toStrictEqual([]);

          expect(await handle.finished).toStrictEqual({
            canceled: false,
            done: true,
          });

          expect(mutationEffect.commit).toHaveBeenCalledTimes(2);
          expect(layoutEffect.commit).toHaveBeenCalledTimes(2);
          expect(passiveEffect.commit).toHaveBeenCalledTimes(1);
          expect(observer.flushEvents()).toStrictEqual([
            {
              type: 'update-start',
              id: 1,
              lanes:
                Lane.DefaultLane |
                Lane.UserVisibleLane |
                Lane.SyncLane |
                Lane.ViewTransitionLane,
            },
            {
              type: 'render-phase-start',
              id: 1,
            },
            {
              type: 'render-phase-end',
              id: 1,
            },
            {
              type: 'commit-phase-start',
              id: 1,
              mutationEffects: expect.any(EffectQueue),
              layoutEffects: expect.any(EffectQueue),
              passiveEffects: expect.any(EffectQueue),
            },
            {
              type: 'effect-commit-start',
              id: 1,
              phase: CommitPhase.Mutation,
              effects: expect.any(EffectQueue),
            },
            {
              type: 'effect-commit-end',
              id: 1,
              phase: CommitPhase.Mutation,
              effects: expect.any(EffectQueue),
            },
            {
              type: 'effect-commit-start',
              id: 1,
              phase: CommitPhase.Layout,
              effects: expect.any(EffectQueue),
            },
            {
              type: 'effect-commit-end',
              id: 1,
              phase: CommitPhase.Layout,
              effects: expect.any(EffectQueue),
            },
            {
              type: 'commit-phase-end',
              id: 1,
              mutationEffects: expect.any(EffectQueue),
              layoutEffects: expect.any(EffectQueue),
              passiveEffects: expect.any(EffectQueue),
            },
            {
              type: 'update-success',
              id: 1,
              lanes:
                Lane.DefaultLane |
                Lane.UserVisibleLane |
                Lane.SyncLane |
                Lane.ViewTransitionLane,
            },
          ]);
        }

        SESSION3: {
          removeObserver();

          expect(runtime.getPendingUpdates().toArray()).toStrictEqual([]);

          expect(mutationEffect.commit).toHaveBeenCalledTimes(2);
          expect(layoutEffect.commit).toHaveBeenCalledTimes(2);
          expect(passiveEffect.commit).toHaveBeenCalledTimes(1);
          expect(observer.flushEvents()).toStrictEqual([]);
        }
      });

      it('handles an error that occurs during flushing', async () => {
        const runtime = createRuntime(ExecutionMode.ConcurrentMode);
        const observer = new MockObserver();
        const error = new Error('fail');

        runtime.addObserver(observer);

        SESSION: {
          const coroutine = new MockCoroutine(() => {
            throw error;
          });

          const handle = runtime.scheduleUpdate(coroutine);

          expect(await handle.scheduled).toStrictEqual({
            canceled: false,
            done: true,
          });

          try {
            await handle.finished;
            expect.unreachable();
          } catch (caughtError) {
            expect(caughtError).toBeInstanceOf(RenderError);
            expect((caughtError as RenderError).cause).toBe(error);
          }
        }

        expect(observer.flushEvents()).toStrictEqual([
          {
            type: 'update-start',
            id: 0,
            lanes: Lane.DefaultLane | Lane.UserBlockingLane,
          },
          {
            type: 'render-phase-start',
            id: 0,
          },
          {
            type: 'render-phase-end',
            id: 0,
          },
          {
            type: 'update-failure',
            id: 0,
            lanes: Lane.DefaultLane | Lane.UserBlockingLane,
            error: expect.objectContaining({ cause: error }),
          },
        ]);
      });

      it('aborts rendering when error is captured outside the root', async () => {
        const runtime = createRuntime(ExecutionMode.ConcurrentMode);
        const observer = new MockObserver();
        const errorHandler = vi.fn();
        const error = new Error('fail');

        runtime.addObserver(observer);

        SESSION: {
          const parentScope = createScope();
          parentScope.boundary = {
            type: BoundaryType.Error,
            next: null,
            handler: errorHandler,
          };
          const childScope = createScope(parentScope);
          const coroutine = new MockCoroutine(
            () => {
              throw error;
            },
            -1,
            childScope,
          );

          const handle = runtime.scheduleUpdate(coroutine);

          expect(await handle.scheduled).toStrictEqual({
            canceled: false,
            done: true,
          });

          expect(await handle.finished).toStrictEqual({
            canceled: true,
            done: false,
          });
          expect(errorHandler).toHaveBeenCalledOnce();
          expect(errorHandler).toHaveBeenCalledWith(
            error,
            expect.any(Function),
          );
        }

        expect(observer.flushEvents()).toStrictEqual([
          {
            type: 'update-start',
            id: 0,
            lanes: Lane.DefaultLane | Lane.UserBlockingLane,
          },
          {
            type: 'render-phase-start',
            id: 0,
          },
          {
            type: 'render-phase-end',
            id: 0,
          },
          {
            type: 'update-failure',
            id: 0,
            lanes: Lane.DefaultLane | Lane.UserBlockingLane,
            error: expect.objectContaining({ cause: error }),
          },
        ]);
      });
    });

    describe('not in concurrent mode', () => {
      it('commits effects synchronously', async () => {
        const mutationEffect = {
          commit: vi.fn(),
        };
        const layoutEffect = {
          commit: vi.fn(),
        };
        const passiveEffect = {
          commit: vi.fn(),
        };
        const observer = new MockObserver();
        const runtime = createRuntime();

        const removeObserver = runtime.addObserver(observer);

        SESSION1: {
          const coroutine = new MockCoroutine((session) => {
            session.frame.mutationEffects.push(
              mutationEffect,
              session.scope.level,
            );
            session.frame.layoutEffects.push(layoutEffect, session.scope.level);
            session.frame.passiveEffects.push(
              passiveEffect,
              session.scope.level,
            );
          });

          const handle1 = runtime.scheduleUpdate(coroutine, {
            priority: 'user-blocking',
            triggerFlush: false,
          });
          const handle2 = runtime.scheduleUpdate(coroutine, {
            priority: 'user-blocking',
            triggerFlush: false,
          });

          expect(await handle1.scheduled).toStrictEqual({
            canceled: false,
            done: true,
          });
          expect(await handle2.scheduled).toStrictEqual({
            canceled: false,
            done: true,
          });

          expect(runtime.getPendingUpdates().toArray()).toStrictEqual([
            expect.objectContaining({
              coroutine,
              lanes: Lane.DefaultLane | Lane.UserBlockingLane,
            }),
            expect.objectContaining({
              coroutine,
              lanes: Lane.DefaultLane | Lane.UserBlockingLane,
            }),
          ]);

          runtime.flushUpdates();

          expect(runtime.getPendingUpdates().toArray()).toStrictEqual([]);

          expect(await handle1.finished).toStrictEqual({
            canceled: false,
            done: true,
          });
          expect(await handle2.finished).toStrictEqual({
            canceled: true,
            done: true,
          });

          expect(mutationEffect.commit).toHaveBeenCalledTimes(1);
          expect(layoutEffect.commit).toHaveBeenCalledTimes(1);
          expect(passiveEffect.commit).toHaveBeenCalledTimes(1);
          expect(observer.flushEvents()).toStrictEqual([
            {
              type: 'update-start',
              id: 0,
              lanes: Lane.DefaultLane | Lane.UserBlockingLane,
            },
            {
              type: 'render-phase-start',
              id: 0,
            },
            {
              type: 'render-phase-end',
              id: 0,
            },
            {
              type: 'commit-phase-start',
              id: 0,
              mutationEffects: expect.any(EffectQueue),
              layoutEffects: expect.any(EffectQueue),
              passiveEffects: expect.any(EffectQueue),
            },
            {
              type: 'effect-commit-start',
              id: 0,
              phase: CommitPhase.Mutation,
              effects: expect.any(EffectQueue),
            },
            {
              type: 'effect-commit-end',
              id: 0,
              phase: CommitPhase.Mutation,
              effects: expect.any(EffectQueue),
            },
            {
              type: 'effect-commit-start',
              id: 0,
              phase: CommitPhase.Layout,
              effects: expect.any(EffectQueue),
            },
            {
              type: 'effect-commit-end',
              id: 0,
              phase: CommitPhase.Layout,
              effects: expect.any(EffectQueue),
            },
            {
              type: 'effect-commit-start',
              id: 0,
              phase: CommitPhase.Passive,
              effects: expect.any(EffectQueue),
            },
            {
              type: 'effect-commit-end',
              id: 0,
              phase: CommitPhase.Passive,
              effects: expect.any(EffectQueue),
            },
            {
              type: 'commit-phase-end',
              id: 0,
              mutationEffects: expect.any(EffectQueue),
              layoutEffects: expect.any(EffectQueue),
              passiveEffects: expect.any(EffectQueue),
            },
            {
              type: 'update-success',
              id: 0,
              lanes: Lane.DefaultLane | Lane.UserBlockingLane,
            },
          ]);
        }

        SESSION2: {
          const coroutine = new MockCoroutine((session) => {
            session.frame.pendingCoroutines.push(subcoroutine);
          });
          const subcoroutine = new MockCoroutine((session) => {
            session.frame.mutationEffects.push(
              mutationEffect,
              session.scope.level,
            );
            session.frame.layoutEffects.push(layoutEffect, session.scope.level);
          });

          const handle = runtime.scheduleUpdate(coroutine, {
            priority: 'user-visible',
            triggerFlush: false,
            viewTransition: true,
          });

          expect(await handle.scheduled).toStrictEqual({
            canceled: false,
            done: true,
          });

          expect(runtime.getPendingUpdates().toArray()).toStrictEqual([
            expect.objectContaining({
              coroutine,
              lanes:
                Lane.DefaultLane |
                Lane.UserVisibleLane |
                Lane.ViewTransitionLane,
            }),
          ]);

          runtime.flushUpdates();

          expect(runtime.getPendingUpdates().toArray()).toStrictEqual([]);

          expect(await handle.finished).toStrictEqual({
            canceled: false,
            done: true,
          });

          expect(mutationEffect.commit).toHaveBeenCalledTimes(2);
          expect(layoutEffect.commit).toHaveBeenCalledTimes(2);
          expect(passiveEffect.commit).toHaveBeenCalledTimes(1);
          expect(observer.flushEvents()).toStrictEqual([
            {
              type: 'update-start',
              id: 1,
              lanes:
                Lane.DefaultLane |
                Lane.UserVisibleLane |
                Lane.ViewTransitionLane,
            },
            {
              type: 'render-phase-start',
              id: 1,
            },
            {
              type: 'render-phase-end',
              id: 1,
            },
            {
              type: 'commit-phase-start',
              id: 1,
              mutationEffects: expect.any(EffectQueue),
              layoutEffects: expect.any(EffectQueue),
              passiveEffects: expect.any(EffectQueue),
            },
            {
              type: 'effect-commit-start',
              id: 1,
              phase: CommitPhase.Mutation,
              effects: expect.any(EffectQueue),
            },
            {
              type: 'effect-commit-end',
              id: 1,
              phase: CommitPhase.Mutation,
              effects: expect.any(EffectQueue),
            },
            {
              type: 'effect-commit-start',
              id: 1,
              phase: CommitPhase.Layout,
              effects: expect.any(EffectQueue),
            },
            {
              type: 'effect-commit-end',
              id: 1,
              phase: CommitPhase.Layout,
              effects: expect.any(EffectQueue),
            },
            {
              type: 'commit-phase-end',
              id: 1,
              mutationEffects: expect.any(EffectQueue),
              layoutEffects: expect.any(EffectQueue),
              passiveEffects: expect.any(EffectQueue),
            },
            {
              type: 'update-success',
              id: 1,
              lanes:
                Lane.DefaultLane |
                Lane.UserVisibleLane |
                Lane.ViewTransitionLane,
            },
          ]);
        }

        SESSION3: {
          removeObserver();

          expect(runtime.getPendingUpdates().toArray()).toStrictEqual([]);

          expect(mutationEffect.commit).toHaveBeenCalledTimes(2);
          expect(layoutEffect.commit).toHaveBeenCalledTimes(2);
          expect(passiveEffect.commit).toHaveBeenCalledTimes(1);
          expect(observer.flushEvents()).toStrictEqual([]);
        }
      });

      it('handles an error that occurs during flushing', async () => {
        const runtime = createRuntime();
        const observer = new MockObserver();
        const error = new Error('fail');

        runtime.addObserver(observer);

        SESSION: {
          const coroutine = new MockCoroutine(() => {
            throw error;
          });

          try {
            await runtime.scheduleUpdate(coroutine).finished;
            expect.unreachable();
          } catch (caughtError) {
            expect(caughtError).toBeInstanceOf(RenderError);
            expect((caughtError as RenderError).cause).toBe(error);
          }
        }

        expect(observer.flushEvents()).toStrictEqual([
          {
            type: 'update-start',
            id: 0,
            lanes: Lane.DefaultLane | Lane.UserBlockingLane,
          },
          {
            type: 'render-phase-start',
            id: 0,
          },
          {
            type: 'render-phase-end',
            id: 0,
          },
          {
            type: 'update-failure',
            id: 0,
            lanes: Lane.DefaultLane | Lane.UserBlockingLane,
            error: expect.objectContaining({ cause: error }),
          },
        ]);
      });

      it('aborts rendering when error is captured outside the root', async () => {
        const runtime = createRuntime();
        const observer = new MockObserver();
        const errorHandler = vi.fn();
        const error = new Error('fail');

        runtime.addObserver(observer);

        SESSION: {
          const parentScope = createScope();
          parentScope.boundary = {
            type: BoundaryType.Error,
            next: null,
            handler: errorHandler,
          };
          const childScope = createScope(parentScope);
          const coroutine = new MockCoroutine(
            () => {
              throw error;
            },
            -1,
            childScope,
          );

          const handle = runtime.scheduleUpdate(coroutine, {
            triggerFlush: false,
          });

          expect(await handle.scheduled).toStrictEqual({
            canceled: false,
            done: true,
          });

          runtime.flushUpdates();

          expect(await handle.finished).toStrictEqual({
            canceled: true,
            done: false,
          });
          expect(errorHandler).toHaveBeenCalledOnce();
          expect(errorHandler).toHaveBeenCalledWith(
            error,
            expect.any(Function),
          );
        }

        expect(observer.flushEvents()).toStrictEqual([
          {
            type: 'update-start',
            id: 0,
            lanes: Lane.DefaultLane | Lane.UserBlockingLane,
          },
          {
            type: 'render-phase-start',
            id: 0,
          },
          {
            type: 'render-phase-end',
            id: 0,
          },
          {
            type: 'update-failure',
            id: 0,
            lanes: Lane.DefaultLane | Lane.UserBlockingLane,
            error: expect.objectContaining({ cause: error }),
          },
        ]);
      });
    });
  });

  describe('nextIdentifier()', () => {
    it('generates unique identifiers', () => {
      const runtime = createRuntime();

      expect(runtime.nextIdentifier()).toMatch(/^[a-z][0-9a-z]*-0$/);
      expect(runtime.nextIdentifier()).toMatch(/^[a-z][0-9a-z]*-1$/);
    });
  });

  describe('renderComponent()', () => {
    it('renders a component with the new render session', () => {
      const component = createComponent(() => null);
      const props = {};
      const state: ComponentState = {
        hooks: [],
        pendingLanes: Lane.NoLane,
        scope: createScope(),
      };
      const coroutine = new MockCoroutine();
      const frame = createRenderFrame(1, -1);
      const scope = createScope(state.scope);
      const observer = new MockObserver();
      const runtime = createRuntime();

      const renderSpy = vi.spyOn(component, 'render');

      runtime.addObserver(observer);

      const result = runtime.renderComponent(
        component,
        props,
        state,
        coroutine,
        frame,
        scope,
      );

      expect(renderSpy).toHaveBeenCalledOnce();
      expect(renderSpy).toHaveBeenCalledWith(props, expect.any(RenderSession));
      expect(observer.flushEvents()).toStrictEqual([
        {
          type: 'component-render-start',
          id: 1,
          component,
          props,
          context: expect.any(RenderSession),
        },
        {
          type: 'component-render-end',
          id: 1,
          component,
          props,
          context: expect.any(RenderSession),
        },
      ]);
      expect(result).toBe(null);
    });
  });

  describe('resolveDirective()', () => {
    it('resolves the directive from Primitive', () => {
      const source = 'foo';
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const runtime = createRuntime();

      const resolvePrimitiveSpy = vi.spyOn(
        runtime['_backend'],
        'resolvePrimitive',
      );

      const directive = runtime.resolveDirective(source, part);

      expect(resolvePrimitiveSpy).toHaveBeenCalledOnce();
      expect(resolvePrimitiveSpy).toHaveBeenCalledWith(source, part);
      expect(directive.type).toBe(MockPrimitive);
      expect(directive.value).toBe(source);
      expect(directive.layout).toStrictEqual(new MockLayout());
    });

    it('resolves the directive from Bindable', () => {
      const source = new MockBindable({
        type: new MockDirective(),
        value: 'foo',
        layout: new MockLayout(),
      });
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const runtime = createRuntime();

      const directive = runtime.resolveDirective(source, part);

      expect(directive.type).toBe(source.directive.type);
      expect(directive.value).toBe(source.directive.value);
      expect(directive.layout).toBe(source.directive.layout);
      expect(directive.defaultLayout).toStrictEqual(new MockLayout());
    });
  });

  describe('resolveSlot()', () => {
    it('resolves the slot from the primitive source', () => {
      const source = 'foo';
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const runtime = createRuntime();

      const resolvePrimitiveSpy = vi.spyOn(
        runtime['_backend'],
        'resolvePrimitive',
      );

      const slot = runtime.resolveSlot(source, part);

      expect(resolvePrimitiveSpy).toHaveBeenCalledOnce();
      expect(resolvePrimitiveSpy).toHaveBeenCalledWith(source, part);
      expect(slot).toBeInstanceOf(MockSlot);
      expect(slot.type).toBe(MockPrimitive);
      expect(slot.value).toBe(source);
      expect(slot.part).toBe(part);
    });

    it('resolves the slot from the bindable source', () => {
      const type = MockPrimitive;
      const value = 'foo';
      const source: Bindable<string> = {
        [$directive]() {
          return {
            type,
            value,
          };
        },
      };
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const runtime = createRuntime();

      const resolveLayoutSpy = vi.spyOn(runtime['_backend'], 'resolveLayout');

      const slot = runtime.resolveSlot(source, part);

      expect(resolveLayoutSpy).toHaveBeenCalledOnce();
      expect(resolveLayoutSpy).toHaveBeenCalledWith(source, part);
      expect(slot).toBeInstanceOf(MockSlot);
      expect(slot.type).toBe(type);
      expect(slot.value).toBe(value);
      expect(slot.part).toBe(part);
    });
  });

  describe('resolveTemplate()', () => {
    it('returns the cached template if it exists', () => {
      const strings = ['<div>', '</div>'];
      const args = ['foo'];
      const mode = 'html';
      const runtime = createRuntime();

      const template = runtime.resolveTemplate(strings, args, mode);

      expect(template).toBeInstanceOf(MockTemplate);
      expect(template).toStrictEqual(
        expect.objectContaining({
          strings,
          args,
          mode,
        }),
      );

      expect(runtime.resolveTemplate(strings, args, mode)).toBe(template);
    });
  });
});

describe('RenderError', () => {
  it('contains the coroutine stack in the message', () => {
    const part = {
      type: PartType.ChildNode,
      node: document.createComment(''),
      anchorNode: null,
      namespaceURI: HTML_NAMESPACE_URI,
    };
    const scope = createScope(
      createScope(createScope(), new ComponentBinding(Parent, {}, part)),
      new ComponentBinding(Child, {}, part),
    );
    const coroutine: Coroutine = {
      name: 'ErrorPlace',
      pendingLanes: Lane.NoLane,
      scope,
      resume() {},
    };
    const error = new RenderError(coroutine);

    expect(error.message).toBe(`An error occurred while rendering.
${Parent.name}
\`- ${Child.name}
   \`- ErrorPlace <- ERROR occurred here!`);
  });
});

const Parent = createComponent(function Parent() {});

const Child = createComponent(function Child() {});
