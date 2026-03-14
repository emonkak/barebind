import { describe, expect, it, vi } from 'vitest';
import { createComponent } from '@/component.js';
import {
  $directive,
  type Bindable,
  BoundaryType,
  type ComponentState,
  createScope,
  EffectQueue,
  Lane,
  PartType,
  type SessionEvent,
  type UpdateHandle,
} from '@/core.js';
import { ComponentError, InterruptError } from '@/error.js';
import { RenderSession } from '@/render-session.js';
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
        const runtime = createRuntime({ defaultLanes: Lane.ConcurrentLane });
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
          const coroutine = new MockCoroutine((session) => {
            session.frame.pendingCoroutines.push(subcoroutine);
          });
          const subcoroutine = new MockCoroutine((session) => {
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

          await runtime.scheduleUpdate(coroutine).finished;
          await waitForTimeout(1); // Wait for passive effects

          expect(requestCallbackSpy).toHaveBeenCalledTimes(3);
          expect(mutationEffect.commit).toHaveBeenCalledOnce();
          expect(layoutEffect.commit).toHaveBeenCalledOnce();
          expect(passiveEffect.commit).toHaveBeenCalledOnce();
        }

        expect(observer.flushEvents()).toStrictEqual([
          {
            type: 'render-start',
            id: 0,
            lanes: Lane.ConcurrentLane | Lane.UserBlockingLane,
          },
          {
            type: 'render-end',
            id: 0,
            lanes: Lane.ConcurrentLane | Lane.UserBlockingLane,
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
      });

      it('commits effects synchronously if flushSync option is true', async () => {
        const runtime = createRuntime({ defaultLanes: Lane.ConcurrentLane });
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
          const coroutine = new MockCoroutine((session) => {
            session.frame.pendingCoroutines.push(subcoroutine);
          });
          const subcoroutine = new MockCoroutine((session) => {
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

          await runtime.scheduleUpdate(coroutine, {
            flushSync: true,
          }).finished;

          expect(mutationEffect.commit).toHaveBeenCalledOnce();
          expect(layoutEffect.commit).toHaveBeenCalledOnce();
          expect(passiveEffect.commit).toHaveBeenCalledOnce();
        }

        expect(observer.flushEvents()).toStrictEqual([
          {
            type: 'render-start',
            id: 0,
            lanes: Lane.ConcurrentLane | Lane.SyncLane | Lane.UserBlockingLane,
          },
          {
            type: 'render-end',
            id: 0,
            lanes: Lane.ConcurrentLane | Lane.SyncLane | Lane.UserBlockingLane,
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
      });

      it('commits mutation and layout effects in view transition if viewTransition option is true', async () => {
        const runtime = createRuntime({ defaultLanes: Lane.ConcurrentLane });
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
          const coroutine = new MockCoroutine((session) => {
            session.frame.mutationEffects.push(
              mutationEffect,
              session.scope.level,
            );
            session.frame.layoutEffects.push(layoutEffect, session.scope.level);
          });

          await runtime.scheduleUpdate(coroutine, {
            viewTransition: true,
          }).finished;

          expect(startViewTransitionSpy).toHaveBeenCalledOnce();
          expect(mutationEffect.commit).toHaveBeenCalledOnce();
          expect(layoutEffect.commit).toHaveBeenCalledOnce();
        }

        expect(observer.flushEvents()).toStrictEqual([
          {
            type: 'render-start',
            id: 0,
            lanes:
              Lane.ConcurrentLane |
              Lane.UserBlockingLane |
              Lane.ViewTransitionLane,
          },
          {
            type: 'render-end',
            id: 0,
            lanes:
              Lane.ConcurrentLane |
              Lane.UserBlockingLane |
              Lane.ViewTransitionLane,
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
      });

      it('handles an error that occurs during rendering', async () => {
        const runtime = createRuntime({ defaultLanes: Lane.ConcurrentLane });
        const observer = new MockObserver();
        const error = new Error('fail');

        runtime.addObserver(observer);

        SESSION: {
          const coroutine = new MockCoroutine(() => {
            throw error;
          });

          const handle = runtime.scheduleUpdate(coroutine);

          try {
            await handle.finished;
            expect.unreachable();
          } catch (caughtError) {
            expect(caughtError).toBeInstanceOf(ComponentError);
            expect((caughtError as ComponentError).cause).toBe(error);
          }
        }

        expect(observer.flushEvents()).toStrictEqual([
          {
            type: 'render-start',
            id: 0,
            lanes: Lane.ConcurrentLane | Lane.UserBlockingLane,
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
            lanes: Lane.ConcurrentLane | Lane.UserBlockingLane,
          },
          {
            type: 'commit-abort',
            id: 0,
            reason: expect.any(ComponentError),
          },
        ] satisfies SessionEvent[]);
      });

      it('aborts rendering when error is captured outside the root', async () => {
        const runtime = createRuntime({ defaultLanes: Lane.ConcurrentLane });
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
          const parentCoroutine = new MockCoroutine(() => {}, parentScope);
          const childScope = createScope(parentCoroutine);
          const childCoroutine = new MockCoroutine(() => {
            throw error;
          }, childScope);

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
        }

        expect(observer.flushEvents()).toStrictEqual([
          {
            type: 'render-start',
            id: 0,
            lanes: Lane.ConcurrentLane | Lane.UserBlockingLane,
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
            lanes: Lane.ConcurrentLane | Lane.UserBlockingLane,
          },
          {
            type: 'commit-abort',
            id: 0,
            reason: expect.any(InterruptError),
          },
        ] satisfies SessionEvent[]);
      });

      it('defer commit phase until transition ready', async () => {
        const runtime = createRuntime({ defaultLanes: Lane.ConcurrentLane });
        const observer = new MockObserver();
        const effect1 = {
          commit: vi.fn(),
        };
        const effect2 = {
          commit: vi.fn(),
        };

        runtime.addObserver(observer);

        SESSION: {
          const coroutine1 = new MockCoroutine((session) => {
            session.frame.mutationEffects.push(effect1, session.scope.level);
          });
          const coroutine2 = new MockCoroutine((session) => {
            session.frame.mutationEffects.push(effect2, session.scope.level);
          });

          const transition = runtime.startTransition((transition) => {
            const handle1 = runtime.scheduleUpdate(coroutine1, {
              transition,
            });
            const handle2 = runtime.scheduleUpdate(coroutine2, {
              transition,
            });
            expect(handle1.lanes).toBe(
              Lane.ConcurrentLane | Lane.BackgroundLane | Lane.TransitionLane,
            );
            expect(handle2.lanes).toBe(
              Lane.ConcurrentLane | Lane.BackgroundLane | Lane.TransitionLane,
            );
          });

          await transition.finished;

          expect(observer.flushEvents()).toStrictEqual([
            {
              type: 'render-start',
              id: 0,
              lanes:
                Lane.ConcurrentLane | Lane.BackgroundLane | Lane.TransitionLane,
            },
            {
              type: 'render-end',
              id: 0,
              lanes:
                Lane.ConcurrentLane | Lane.BackgroundLane | Lane.TransitionLane,
            },
            {
              type: 'render-start',
              id: 1,
              lanes:
                Lane.ConcurrentLane | Lane.BackgroundLane | Lane.TransitionLane,
            },
            {
              type: 'render-end',
              id: 1,
              lanes:
                Lane.ConcurrentLane | Lane.BackgroundLane | Lane.TransitionLane,
            },
            {
              type: 'commit-start',
              id: 0,
            },
            {
              type: 'commit-start',
              id: 1,
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
              id: 1,
              phase: 'mutation',
              effects: expect.any(EffectQueue),
            },
            {
              type: 'effect-commit-end',
              id: 1,
              phase: 'mutation',
              effects: expect.any(EffectQueue),
            },
            {
              type: 'commit-end',
              id: 0,
            },
            {
              type: 'commit-end',
              id: 1,
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
          const coroutine = new MockCoroutine((session) => {
            session.frame.pendingCoroutines.push(subcoroutine);
          });
          const subcoroutine = new MockCoroutine((session) => {
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

          await runtime.scheduleUpdate(coroutine, {
            flushSync: true,
          }).finished;

          expect(mutationEffect.commit).toHaveBeenCalledOnce();
          expect(layoutEffect.commit).toHaveBeenCalledOnce();
          expect(passiveEffect.commit).toHaveBeenCalledOnce();
        }

        expect(observer.flushEvents()).toStrictEqual([
          {
            type: 'render-start',
            id: 0,
            lanes: Lane.SyncLane | Lane.UserBlockingLane,
          },
          {
            type: 'render-end',
            id: 0,
            lanes: Lane.SyncLane | Lane.UserBlockingLane,
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
      });

      it('handles an error that occurs during rendering', async () => {
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
            expect(caughtError).toBeInstanceOf(ComponentError);
            expect((caughtError as ComponentError).cause).toBe(error);
          }
        }

        expect(observer.flushEvents()).toStrictEqual([
          {
            type: 'render-start',
            id: 0,
            lanes: Lane.SyncLane | Lane.UserBlockingLane,
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
            lanes: Lane.SyncLane | Lane.UserBlockingLane,
          },
          {
            type: 'commit-abort',
            id: 0,
            reason: expect.any(ComponentError),
          },
        ] satisfies SessionEvent[]);
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
          const parentCoroutine = new MockCoroutine(() => {}, parentScope);
          const childScope = createScope(parentCoroutine);
          const childCoroutine = new MockCoroutine(() => {
            throw error;
          }, childScope);

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
        }

        expect(observer.flushEvents()).toStrictEqual([
          {
            type: 'render-start',
            id: 0,
            lanes: Lane.SyncLane | Lane.UserBlockingLane,
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
            lanes: Lane.SyncLane | Lane.UserBlockingLane,
          },
          {
            type: 'commit-abort',
            id: 0,
            reason: expect.any(InterruptError),
          },
        ] satisfies SessionEvent[]);
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
    it('renders the component with a new render session', () => {
      const component = createComponent(vi.fn(() => null));
      const props = {};
      const state: ComponentState = {
        hooks: [],
      };
      const frame = createRenderFrame(1, -1);
      const scope = createScope();
      const coroutine = new MockCoroutine();
      const runtime = createRuntime();
      const observer = new MockObserver();

      runtime.addObserver(observer);

      const result = runtime.renderComponent(
        component,
        props,
        state,
        frame,
        scope,
        coroutine,
      );

      expect(component.render).toHaveBeenCalledOnce();
      expect(component.render).toHaveBeenCalledWith(
        props,
        expect.any(RenderSession),
      );
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
    it.for([
      'foo',
      null,
      undefined,
    ])('resolves primitive values as primitive directives', (source) => {
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

    it('resolves the bindable value as a specific directive', () => {
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
      const values = ['foo'];
      const mode = 'html';
      const runtime = createRuntime();

      const template = runtime.resolveTemplate(strings, values, mode);

      expect(template).toBeInstanceOf(MockTemplate);
      expect(template).toStrictEqual(
        expect.objectContaining({
          strings,
          values,
          mode,
        }),
      );

      expect(runtime.resolveTemplate(strings, values, mode)).toBe(template);
    });
  });

  describe('scheduleUpdate()', () => {
    it('registers new a update', async () => {
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

    it('cancels the update when the signal aborts', async () => {
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

    it('cancels the update when the transition fails', async () => {
      const runtime = createRuntime({ defaultLanes: Lane.ConcurrentLane });

      SESSION: {
        let handle: UpdateHandle | undefined;
        const coroutine = new MockCoroutine();
        const error = new Error('fail');
        const transition = runtime.startTransition(async (transition) => {
          handle = runtime.scheduleUpdate(coroutine, {
            transition,
          });
          throw error;
        });

        await expect(transition.finished).rejects.toThrow(error);

        expect(await handle?.scheduled).toStrictEqual({
          status: 'canceled',
          reason: error,
        });
        expect(await handle?.finished).toStrictEqual({
          status: 'canceled',
          reason: error,
        });
      }
    });
  });
});
