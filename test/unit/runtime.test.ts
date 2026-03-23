import { describe, expect, it, vi } from 'vitest';
import {
  BOUNDARY_TYPE_ERROR,
  Directive,
  EffectQueue,
  Primitive,
  Scope,
  type SessionEvent,
  Template,
} from '@/core.js';
import { createChildNodePart, HTML_NAMESPACE_URI } from '@/dom.js';
import { AbortError, InterruptError } from '@/error.js';
import {
  ConcurrentLane,
  SyncLane,
  UserBlockingLane,
  ViewTransitionLane,
} from '@/lane.js';
import {
  createRuntime,
  MockCoroutine,
  MockObserver,
  MockTemplate,
  MockType,
} from '../mocks.js';
import { waitForTimeout } from '../test-helpers.js';

describe('Runtime', () => {
  describe('addObserver()', () => {
    it('does not deliver events to observer after unsubscribe', async () => {
      const runtime = createRuntime();
      const observer = new MockObserver();

      const removeObserver = runtime.addObserver(observer);
      removeObserver();

      await runtime.scheduleUpdate(new MockCoroutine()).finished;

      expect(observer.flushEvents()).toStrictEqual([]);
    });
  });

  describe('flushUpdates()', () => {
    describe('in concurrent mode', () => {
      it('commits effects asynchronously', async () => {
        const runtime = createRuntime({ defaultLanes: ConcurrentLane });
        const observer = new MockObserver();
        const mutationEffect = {
          commit: vi.fn(),
        };
        const layoutEffect = {
          commit: vi.fn(),
        };
        const passiveEffect = {
          commit: vi.fn(),
        };

        const requestCallbackSpy = vi.spyOn(
          runtime['_backend'],
          'requestCallback',
        );

        runtime.addObserver(observer);

        SESSION: {
          const coroutine = new MockCoroutine(
            'Coroutine1',
            new Scope(),
            (session) => {
              session.frame.coroutines.push(subcoroutine);
            },
          );
          const subcoroutine = new MockCoroutine(
            'Coroutine2',
            new Scope(coroutine),
            (session) => {
              session.frame.mutationEffects.push(
                mutationEffect,
                session.scope.level,
              );
              session.frame.layoutEffects.push(
                layoutEffect,
                session.scope.level,
              );
              session.frame.passiveEffects.push(
                passiveEffect,
                session.scope.level,
              );
            },
          );

          await runtime.scheduleUpdate(coroutine).finished;
          await waitForTimeout(1); // Wait for passive effects

          expect(requestCallbackSpy).toHaveBeenCalledTimes(3);
          expect(mutationEffect.commit).toHaveBeenCalledOnce();
          expect(layoutEffect.commit).toHaveBeenCalledOnce();
          expect(passiveEffect.commit).toHaveBeenCalledOnce();
          expect(observer.flushEvents()).toStrictEqual([
            {
              type: 'render-start',
              id: 0,
              lanes: ConcurrentLane | UserBlockingLane,
            },
            {
              type: 'coroutine-start',
              id: 0,
              coroutine,
            },
            {
              type: 'coroutine-end',
              id: 0,
              coroutine,
            },
            {
              type: 'coroutine-start',
              id: 0,
              coroutine: subcoroutine,
            },
            {
              type: 'coroutine-end',
              id: 0,
              coroutine: subcoroutine,
            },
            {
              type: 'render-end',
              id: 0,
              lanes: ConcurrentLane | UserBlockingLane,
            },
            {
              type: 'commit-start',
              id: 0,
            },
            {
              type: 'effect-commit-start',
              id: 0,
              phase: 'mutation',
              effects: expect.any(EffectQueue),
            },
            {
              type: 'effect-commit-end',
              id: 0,
              phase: 'mutation',
              effects: expect.any(EffectQueue),
            },
            {
              type: 'effect-commit-start',
              id: 0,
              phase: 'layout',
              effects: expect.any(EffectQueue),
            },
            {
              type: 'effect-commit-end',
              id: 0,
              phase: 'layout',
              effects: expect.any(EffectQueue),
            },
            {
              type: 'effect-commit-start',
              id: 0,
              phase: 'passive',
              effects: expect.any(EffectQueue),
            },
            {
              type: 'effect-commit-end',
              id: 0,
              phase: 'passive',
              effects: expect.any(EffectQueue),
            },
            {
              type: 'commit-end',
              id: 0,
            },
          ] satisfies SessionEvent[]);
        }
      });

      it('commits effects synchronously if flushSync option is true', async () => {
        const runtime = createRuntime({ defaultLanes: ConcurrentLane });
        const observer = new MockObserver();
        const mutationEffect = {
          commit: vi.fn(),
        };
        const layoutEffect = {
          commit: vi.fn(),
        };
        const passiveEffect = {
          commit: vi.fn(),
        };

        runtime.addObserver(observer);

        SESSION: {
          const coroutine = new MockCoroutine(
            'coroutine1',
            new Scope(),
            (session) => {
              session.frame.coroutines.push(subcoroutine);
            },
          );
          const subcoroutine = new MockCoroutine(
            'coroutine2',
            new Scope(coroutine),
            (session) => {
              session.frame.mutationEffects.push(
                mutationEffect,
                session.scope.level,
              );
              session.frame.layoutEffects.push(
                layoutEffect,
                session.scope.level,
              );
              session.frame.passiveEffects.push(
                passiveEffect,
                session.scope.level,
              );
            },
          );

          await runtime.scheduleUpdate(coroutine, {
            flushSync: true,
          }).finished;

          expect(mutationEffect.commit).toHaveBeenCalledOnce();
          expect(layoutEffect.commit).toHaveBeenCalledOnce();
          expect(passiveEffect.commit).toHaveBeenCalledOnce();
          expect(observer.flushEvents()).toStrictEqual([
            {
              type: 'render-start',
              id: 0,
              lanes: ConcurrentLane | SyncLane | UserBlockingLane,
            },
            {
              type: 'coroutine-start',
              id: 0,
              coroutine,
            },
            {
              type: 'coroutine-end',
              id: 0,
              coroutine,
            },
            {
              type: 'coroutine-start',
              id: 0,
              coroutine: subcoroutine,
            },
            {
              type: 'coroutine-end',
              id: 0,
              coroutine: subcoroutine,
            },
            {
              type: 'render-end',
              id: 0,
              lanes: ConcurrentLane | SyncLane | UserBlockingLane,
            },
            {
              type: 'commit-start',
              id: 0,
            },
            {
              type: 'effect-commit-start',
              id: 0,
              phase: 'mutation',
              effects: expect.any(EffectQueue),
            },
            {
              type: 'effect-commit-end',
              id: 0,
              phase: 'mutation',
              effects: expect.any(EffectQueue),
            },
            {
              type: 'effect-commit-start',
              id: 0,
              phase: 'layout',
              effects: expect.any(EffectQueue),
            },
            {
              type: 'effect-commit-end',
              id: 0,
              phase: 'layout',
              effects: expect.any(EffectQueue),
            },
            {
              type: 'effect-commit-start',
              id: 0,
              phase: 'passive',
              effects: expect.any(EffectQueue),
            },
            {
              type: 'effect-commit-end',
              id: 0,
              phase: 'passive',
              effects: expect.any(EffectQueue),
            },
            {
              type: 'commit-end',
              id: 0,
            },
          ] satisfies SessionEvent[]);
        }
      });

      it('commits mutation and layout effects in view transition if viewTransition option is true', async () => {
        const runtime = createRuntime({ defaultLanes: ConcurrentLane });
        const observer = new MockObserver();
        const mutationEffect = {
          commit: vi.fn(),
        };
        const layoutEffect = {
          commit: vi.fn(),
        };

        const startViewTransitionSpy = vi.spyOn(
          runtime['_backend'],
          'startViewTransition',
        );

        runtime.addObserver(observer);

        SESSION: {
          const coroutine = new MockCoroutine(
            'Coroutine',
            new Scope(),
            (session) => {
              session.frame.mutationEffects.push(
                mutationEffect,
                session.scope.level,
              );
              session.frame.layoutEffects.push(
                layoutEffect,
                session.scope.level,
              );
            },
          );

          await runtime.scheduleUpdate(coroutine, {
            viewTransition: true,
          }).finished;

          expect(startViewTransitionSpy).toHaveBeenCalledOnce();
          expect(mutationEffect.commit).toHaveBeenCalledOnce();
          expect(layoutEffect.commit).toHaveBeenCalledOnce();
          expect(observer.flushEvents()).toStrictEqual([
            {
              type: 'render-start',
              id: 0,
              lanes: ConcurrentLane | UserBlockingLane | ViewTransitionLane,
            },
            {
              type: 'coroutine-start',
              id: 0,
              coroutine,
            },
            {
              type: 'coroutine-end',
              id: 0,
              coroutine,
            },
            {
              type: 'render-end',
              id: 0,
              lanes: ConcurrentLane | UserBlockingLane | ViewTransitionLane,
            },
            {
              type: 'commit-start',
              id: 0,
            },
            {
              type: 'effect-commit-start',
              id: 0,
              phase: 'mutation',
              effects: expect.any(EffectQueue),
            },
            {
              type: 'effect-commit-end',
              id: 0,
              phase: 'mutation',
              effects: expect.any(EffectQueue),
            },
            {
              type: 'effect-commit-start',
              id: 0,
              phase: 'layout',
              effects: expect.any(EffectQueue),
            },
            {
              type: 'effect-commit-end',
              id: 0,
              phase: 'layout',
              effects: expect.any(EffectQueue),
            },
            {
              type: 'commit-end',
              id: 0,
            },
          ] satisfies SessionEvent[]);
        }
      });

      it('handles errors that occurs during rendering', async () => {
        const runtime = createRuntime({ defaultLanes: ConcurrentLane });
        const observer = new MockObserver();
        const error = new Error('fail');

        runtime.addObserver(observer);

        SESSION: {
          const coroutine = new MockCoroutine('coroutine', new Scope(), () => {
            throw error;
          });

          const handle = runtime.scheduleUpdate(coroutine);

          try {
            await handle.finished;
            expect.unreachable();
          } catch (caughtError) {
            expect(caughtError).toBeInstanceOf(AbortError);
            expect((caughtError as AbortError).cause).toBe(error);
          }

          expect(observer.flushEvents()).toStrictEqual([
            {
              type: 'render-start',
              id: 0,
              lanes: ConcurrentLane | UserBlockingLane,
            },
            {
              type: 'coroutine-start',
              id: 0,
              coroutine,
            },
            {
              type: 'render-error',
              id: 0,
              error,
              captured: false,
            },
            {
              type: 'render-end',
              id: 0,
              lanes: ConcurrentLane | UserBlockingLane,
            },
            {
              type: 'commit-cancel',
              id: 0,
              reason: expect.any(AbortError),
            },
          ] satisfies SessionEvent[]);
        }
      });

      it('aborts rendering when error is captured outside the root', async () => {
        const runtime = createRuntime({ defaultLanes: ConcurrentLane });
        const observer = new MockObserver();
        const errorHandler = vi.fn();
        const error = new Error('fail');

        runtime.addObserver(observer);

        SESSION: {
          const scope = new Scope();
          scope.boundary = {
            type: BOUNDARY_TYPE_ERROR,
            next: null,
            handler: errorHandler,
          };
          const parentCoroutine = new MockCoroutine('coroutine1', scope);
          const childCoroutine = new MockCoroutine(
            'coroutine2',
            new Scope(parentCoroutine),
            () => {
              throw error;
            },
          );

          const handle = runtime.scheduleUpdate(childCoroutine);

          expect(await handle.finished).toStrictEqual({
            status: 'canceled',
            reason: error,
          });
          expect(errorHandler).toHaveBeenCalledOnce();
          expect(errorHandler).toHaveBeenCalledWith(
            error,
            expect.any(Function),
          );
          expect(observer.flushEvents()).toStrictEqual([
            {
              type: 'render-start',
              id: 0,
              lanes: ConcurrentLane | UserBlockingLane,
            },
            {
              type: 'coroutine-start',
              id: 0,
              coroutine: childCoroutine,
            },
            {
              type: 'render-error',
              id: 0,
              error,
              captured: true,
            },
            {
              type: 'render-end',
              id: 0,
              lanes: ConcurrentLane | UserBlockingLane,
            },
            {
              type: 'commit-cancel',
              id: 0,
              reason: expect.any(InterruptError),
            },
          ] satisfies SessionEvent[]);
        }
      });
    });

    describe('in sync mode', () => {
      it('commits effects synchronously', async () => {
        const runtime = createRuntime();
        const observer = new MockObserver();
        const mutationEffect = {
          commit: vi.fn(),
        };
        const layoutEffect = {
          commit: vi.fn(),
        };
        const passiveEffect = {
          commit: vi.fn(),
        };

        runtime.addObserver(observer);

        SESSION: {
          const coroutine = new MockCoroutine(
            'Coroutine1',
            new Scope(),
            (session) => {
              session.frame.coroutines.push(subcoroutine);
            },
          );
          const subcoroutine = new MockCoroutine(
            'Coroutine2',
            new Scope(coroutine),
            (session) => {
              session.frame.mutationEffects.push(
                mutationEffect,
                session.scope.level,
              );
              session.frame.layoutEffects.push(
                layoutEffect,
                session.scope.level,
              );
              session.frame.passiveEffects.push(
                passiveEffect,
                session.scope.level,
              );
            },
          );

          await runtime.scheduleUpdate(coroutine, {
            flushSync: true,
          }).finished;

          expect(mutationEffect.commit).toHaveBeenCalledOnce();
          expect(layoutEffect.commit).toHaveBeenCalledOnce();
          expect(passiveEffect.commit).toHaveBeenCalledOnce();
          expect(observer.flushEvents()).toStrictEqual([
            {
              type: 'render-start',
              id: 0,
              lanes: SyncLane | UserBlockingLane,
            },
            {
              type: 'coroutine-start',
              id: 0,
              coroutine,
            },
            {
              type: 'coroutine-end',
              id: 0,
              coroutine,
            },
            {
              type: 'coroutine-start',
              id: 0,
              coroutine: subcoroutine,
            },
            {
              type: 'coroutine-end',
              id: 0,
              coroutine: subcoroutine,
            },
            {
              type: 'render-end',
              id: 0,
              lanes: SyncLane | UserBlockingLane,
            },
            {
              type: 'commit-start',
              id: 0,
            },
            {
              type: 'effect-commit-start',
              id: 0,
              phase: 'mutation',
              effects: expect.any(EffectQueue),
            },
            {
              type: 'effect-commit-end',
              id: 0,
              phase: 'mutation',
              effects: expect.any(EffectQueue),
            },
            {
              type: 'effect-commit-start',
              id: 0,
              phase: 'layout',
              effects: expect.any(EffectQueue),
            },
            {
              type: 'effect-commit-end',
              id: 0,
              phase: 'layout',
              effects: expect.any(EffectQueue),
            },
            {
              type: 'effect-commit-start',
              id: 0,
              phase: 'passive',
              effects: expect.any(EffectQueue),
            },
            {
              type: 'effect-commit-end',
              id: 0,
              phase: 'passive',
              effects: expect.any(EffectQueue),
            },
            {
              type: 'commit-end',
              id: 0,
            },
          ] satisfies SessionEvent[]);
        }
      });

      it('handles an error that occurs during rendering', async () => {
        const runtime = createRuntime();
        const observer = new MockObserver();
        const error = new Error('fail');

        runtime.addObserver(observer);

        SESSION: {
          const coroutine = new MockCoroutine('coroutine', new Scope(), () => {
            throw error;
          });

          try {
            await runtime.scheduleUpdate(coroutine).finished;
            expect.unreachable();
          } catch (caughtError) {
            expect(caughtError).toBeInstanceOf(AbortError);
            expect((caughtError as AbortError).cause).toBe(error);
          }

          expect(observer.flushEvents()).toStrictEqual([
            {
              type: 'render-start',
              id: 0,
              lanes: SyncLane | UserBlockingLane,
            },
            {
              type: 'coroutine-start',
              id: 0,
              coroutine,
            },
            {
              type: 'render-error',
              id: 0,
              error,
              captured: false,
            },
            {
              type: 'render-end',
              id: 0,
              lanes: SyncLane | UserBlockingLane,
            },
            {
              type: 'commit-cancel',
              id: 0,
              reason: expect.any(AbortError),
            },
          ] satisfies SessionEvent[]);
        }
      });

      it('aborts rendering when error is captured outside the root', async () => {
        const runtime = createRuntime();
        const observer = new MockObserver();
        const errorHandler = vi.fn();
        const error = new Error('fail');

        runtime.addObserver(observer);

        SESSION: {
          const scope = new Scope();
          scope.boundary = {
            type: BOUNDARY_TYPE_ERROR,
            next: null,
            handler: errorHandler,
          };
          const parentCoroutine = new MockCoroutine('Coroutine1', scope);
          const childCoroutine = new MockCoroutine(
            'Coroutine2',
            new Scope(parentCoroutine),
            () => {
              throw error;
            },
          );

          const handle = runtime.scheduleUpdate(childCoroutine, {});

          expect(await handle.finished).toStrictEqual({
            status: 'canceled',
            reason: error,
          });
          expect(errorHandler).toHaveBeenCalledOnce();
          expect(errorHandler).toHaveBeenCalledWith(
            error,
            expect.any(Function),
          );
          expect(observer.flushEvents()).toStrictEqual([
            {
              type: 'render-start',
              id: 0,
              lanes: SyncLane | UserBlockingLane,
            },
            {
              type: 'coroutine-start',
              id: 0,
              coroutine: childCoroutine,
            },
            {
              type: 'render-error',
              id: 0,
              error,
              captured: true,
            },
            {
              type: 'render-end',
              id: 0,
              lanes: SyncLane | UserBlockingLane,
            },
            {
              type: 'commit-cancel',
              id: 0,
              reason: expect.any(InterruptError),
            },
          ] satisfies SessionEvent[]);
        }
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

  describe('resolveDirective()', () => {
    it.for([
      'foo',
      null,
      undefined,
    ])('resolves sources as primitive directives when not bindable', (source) => {
      const runtime = createRuntime();
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );

      const resolvePrimitiveSpy = vi.spyOn(
        runtime['_backend'],
        'resolvePrimitive',
      );

      const directive = runtime.resolveDirective(source, part);

      expect(resolvePrimitiveSpy).toHaveBeenCalledOnce();
      expect(resolvePrimitiveSpy).toHaveBeenCalledWith(source, part);
      expect(directive.type).toStrictEqual(new MockType());
      expect(directive.value).toBe(source);
      expect(directive.key).toBe(undefined);
    });

    it('resolves sources as primitive directives when primitive', () => {
      const runtime = createRuntime();
      const source = new Directive(Primitive, 'value', 'key');
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );

      const resolvePrimitiveSpy = vi.spyOn(
        runtime['_backend'],
        'resolvePrimitive',
      );

      const directive = runtime.resolveDirective(source, part);

      expect(resolvePrimitiveSpy).toHaveBeenCalledOnce();
      expect(resolvePrimitiveSpy).toHaveBeenCalledWith('value', part);
      expect(directive.type).toStrictEqual(new MockType());
      expect(directive.value).toBe('value');
      expect(directive.key).toBe('key');
    });

    it('resolves sources as specific directives when bindable', () => {
      const runtime = createRuntime();
      const source = new Directive(new MockType(), 'foo', 'key');
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );
      const directive = runtime.resolveDirective(source, part);

      expect(directive).toBe(source);
    });

    it('resolves sources as template directives when template type', () => {
      const runtime = createRuntime();
      const source = new Directive(
        Template,
        {
          strings: ['(', ')'],
          exprs: ['value'],
          mode: 'html',
        },
        'key',
      );
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );
      const directive = runtime.resolveDirective(source, part);

      expect(directive.type).toBeInstanceOf(MockTemplate);
      expect(directive.type).toStrictEqual(
        expect.objectContaining(source.value),
      );
      expect(directive.value).toStrictEqual(['value']);
      expect(directive.key).toStrictEqual('key');
    });

    it('returns same directive types when the template is cached', () => {
      const runtime = createRuntime();
      const source = new Directive(Template, {
        strings: ['(', ')'],
        exprs: 'foo',
        mode: 'html',
      });
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );
      const directive1 = runtime.resolveDirective(source, part);
      const directive2 = runtime.resolveDirective(source, part);

      expect(directive1.type).toBe(directive2.type);
    });
  });

  describe('scheduleUpdate()', () => {
    it('registers new update', async () => {
      const runtime = createRuntime();
      const coroutine = new MockCoroutine();
      const handle = runtime.scheduleUpdate(coroutine);

      expect(runtime.getScheduledUpdates()).toStrictEqual([]);

      expect(await handle.scheduled).toStrictEqual({
        status: 'done',
      });
      expect(runtime.getScheduledUpdates()).toStrictEqual([
        expect.objectContaining({
          id: handle.id,
          lanes: handle.lanes,
          coroutine: expect.exact(coroutine),
        }),
      ]);

      expect(await handle.finished).toStrictEqual({
        status: 'done',
      });
      expect(runtime.getScheduledUpdates()).toStrictEqual([]);
    });

    it('cancels update when the signal aborts', async () => {
      const runtime = createRuntime();
      const coroutine = new MockCoroutine();
      const controller = new AbortController();
      const handle = runtime.scheduleUpdate(coroutine, {
        signal: controller.signal,
      });

      controller.abort();

      expect(await handle.scheduled).toStrictEqual({
        status: 'canceled',
        reason: controller.signal.reason,
      });
      expect(await handle.finished).toStrictEqual({
        status: 'canceled',
        reason: controller.signal.reason,
      });
      expect(runtime.getScheduledUpdates()).toStrictEqual([]);
    });
  });
});
