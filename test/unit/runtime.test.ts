import { describe, expect, it, vi } from 'vitest';

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
  Lanes,
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

describe('Runtime', () => {
  describe('flushAsync()', () => {
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
      const runtime = createRuntime();

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

        expect(runtime.getPendingTasks().toArray()).toStrictEqual([
          expect.objectContaining({
            coroutine,
            lanes: Lanes.DefaultLane | Lanes.UserBlockingLane,
          }),
          expect.objectContaining({
            coroutine,
            lanes: Lanes.DefaultLane | Lanes.UserBlockingLane,
          }),
        ]);

        await runtime.flushAsync();

        expect(runtime.getPendingTasks().toArray()).toStrictEqual([]);

        expect(await handle1.finished).toStrictEqual({
          canceled: false,
          done: true,
        });
        expect(await handle2.finished).toStrictEqual({
          canceled: true,
          done: true,
        });

        expect(requestCallbackSpy).toHaveBeenCalledTimes(3);
        expect(startViewTransitionSpy).toHaveBeenCalledTimes(0);
        expect(mutationEffect.commit).toHaveBeenCalledTimes(1);
        expect(layoutEffect.commit).toHaveBeenCalledTimes(1);
        expect(passiveEffect.commit).toHaveBeenCalledTimes(0);
        expect(observer.flushEvents()).toStrictEqual([
          {
            type: 'UPDATE_START',
            id: 0,
            lanes: Lanes.DefaultLane | Lanes.UserBlockingLane,
          },
          {
            type: 'RENDER_START',
            id: 0,
          },
          {
            type: 'RENDER_END',
            id: 0,
          },
          {
            type: 'COMMIT_START',
            id: 0,
            phase: CommitPhase.Mutation,
            effects: expect.any(EffectQueue),
          },
          {
            type: 'COMMIT_END',
            id: 0,
            phase: CommitPhase.Mutation,
            effects: expect.any(EffectQueue),
          },
          {
            type: 'COMMIT_START',
            id: 0,
            phase: CommitPhase.Layout,
            effects: expect.any(EffectQueue),
          },
          {
            type: 'COMMIT_END',
            id: 0,
            phase: CommitPhase.Layout,
            effects: expect.any(EffectQueue),
          },
          {
            type: 'UPDATE_SUCCESS',
            id: 0,
            lanes: Lanes.DefaultLane | Lanes.UserBlockingLane,
          },
        ]);
      }

      SESSION2: {
        const coroutine = new MockCoroutine((session) => {
          session.frame.pendingCoroutines.push(subcoroutine);
        });
        const subcoroutine = new MockCoroutine((session) => {
          session.frame.layoutEffects.push(layoutEffect, session.scope.level);
          session.frame.passiveEffects.push(passiveEffect, session.scope.level);
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

        expect(runtime.getPendingTasks().toArray()).toStrictEqual([
          expect.objectContaining({
            coroutine,
            lanes:
              Lanes.DefaultLane |
              Lanes.UserVisibleLane |
              Lanes.ViewTransitionLane,
          }),
        ]);

        await runtime.flushAsync();

        expect(runtime.getPendingTasks().toArray()).toStrictEqual([]);

        expect(await handle.finished).toStrictEqual({
          canceled: false,
          done: true,
        });

        expect(requestCallbackSpy).toHaveBeenCalledTimes(5);
        expect(startViewTransitionSpy).toHaveBeenCalledTimes(1);
        expect(mutationEffect.commit).toHaveBeenCalledTimes(1);
        expect(layoutEffect.commit).toHaveBeenCalledTimes(2);
        expect(passiveEffect.commit).toHaveBeenCalledTimes(1);
        expect(observer.flushEvents()).toStrictEqual([
          {
            type: 'UPDATE_START',
            id: 1,
            lanes:
              Lanes.DefaultLane |
              Lanes.UserVisibleLane |
              Lanes.ViewTransitionLane,
          },
          {
            type: 'RENDER_START',
            id: 1,
          },
          {
            type: 'RENDER_END',
            id: 1,
          },
          {
            type: 'COMMIT_START',
            id: 1,
            phase: CommitPhase.Layout,
            effects: expect.any(EffectQueue),
          },
          {
            type: 'COMMIT_END',
            id: 1,
            phase: CommitPhase.Layout,
            effects: expect.any(EffectQueue),
          },
          {
            type: 'COMMIT_START',
            id: 1,
            phase: CommitPhase.Passive,
            effects: expect.any(EffectQueue),
          },
          {
            type: 'COMMIT_END',
            id: 1,
            phase: CommitPhase.Passive,
            effects: expect.any(EffectQueue),
          },
          {
            type: 'UPDATE_SUCCESS',
            id: 1,
            lanes:
              Lanes.DefaultLane |
              Lanes.UserVisibleLane |
              Lanes.ViewTransitionLane,
          },
        ]);
      }

      SESSION3: {
        removeObserver();

        await runtime.flushAsync();

        expect(requestCallbackSpy).toHaveBeenCalledTimes(5);
        expect(startViewTransitionSpy).toHaveBeenCalledTimes(1);
        expect(mutationEffect.commit).toHaveBeenCalledTimes(1);
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

        const handle = runtime.scheduleUpdate(coroutine, {
          triggerFlush: false,
        });

        expect(await handle.scheduled).toStrictEqual({
          canceled: false,
          done: true,
        });

        await runtime.flushAsync();

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
          type: 'UPDATE_START',
          id: 0,
          lanes: Lanes.DefaultLane | Lanes.UserBlockingLane,
        },
        {
          type: 'RENDER_START',
          id: 0,
        },
        {
          type: 'UPDATE_FAILURE',
          id: 0,
          lanes: Lanes.DefaultLane | Lanes.UserBlockingLane,
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
          Lanes.AllLanes,
          childScope,
        );

        const handle = runtime.scheduleUpdate(coroutine, {
          triggerFlush: false,
        });

        expect(await handle.scheduled).toStrictEqual({
          canceled: false,
          done: true,
        });

        await runtime.flushAsync();

        expect(await handle.finished).toStrictEqual({
          canceled: true,
          done: false,
        });
        expect(errorHandler).toHaveBeenCalledOnce();
        expect(errorHandler).toHaveBeenCalledWith(error, expect.any(Function));
      }

      expect(observer.flushEvents()).toStrictEqual([
        {
          type: 'UPDATE_START',
          id: 0,
          lanes: Lanes.DefaultLane | Lanes.UserBlockingLane,
        },
        {
          type: 'RENDER_START',
          id: 0,
        },
        {
          type: 'UPDATE_FAILURE',
          id: 0,
          lanes: Lanes.DefaultLane | Lanes.UserBlockingLane,
          error: expect.objectContaining({ cause: error }),
        },
      ]);
    });
  });

  describe('flushSync()', () => {
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
          session.frame.passiveEffects.push(passiveEffect, session.scope.level);
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

        expect(runtime.getPendingTasks().toArray()).toStrictEqual([
          expect.objectContaining({
            coroutine,
            lanes: Lanes.DefaultLane | Lanes.UserBlockingLane,
          }),
          expect.objectContaining({
            coroutine,
            lanes: Lanes.DefaultLane | Lanes.UserBlockingLane,
          }),
        ]);

        runtime.flushSync();

        expect(runtime.getPendingTasks().toArray()).toStrictEqual([]);

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
            type: 'UPDATE_START',
            id: 0,
            lanes: Lanes.DefaultLane | Lanes.UserBlockingLane,
          },
          {
            type: 'RENDER_START',
            id: 0,
          },
          {
            type: 'RENDER_END',
            id: 0,
          },
          {
            type: 'COMMIT_START',
            id: 0,
            phase: CommitPhase.Mutation,
            effects: expect.any(EffectQueue),
          },
          {
            type: 'COMMIT_END',
            id: 0,
            phase: CommitPhase.Mutation,
            effects: expect.any(EffectQueue),
          },
          {
            type: 'COMMIT_START',
            id: 0,
            phase: CommitPhase.Layout,
            effects: expect.any(EffectQueue),
          },
          {
            type: 'COMMIT_END',
            id: 0,
            phase: CommitPhase.Layout,
            effects: expect.any(EffectQueue),
          },
          {
            type: 'COMMIT_START',
            id: 0,
            phase: CommitPhase.Passive,
            effects: expect.any(EffectQueue),
          },
          {
            type: 'COMMIT_END',
            id: 0,
            phase: CommitPhase.Passive,
            effects: expect.any(EffectQueue),
          },
          {
            type: 'UPDATE_SUCCESS',
            id: 0,
            lanes: Lanes.DefaultLane | Lanes.UserBlockingLane,
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

        expect(runtime.getPendingTasks().toArray()).toStrictEqual([
          expect.objectContaining({
            coroutine,
            lanes:
              Lanes.DefaultLane |
              Lanes.UserVisibleLane |
              Lanes.ViewTransitionLane,
          }),
        ]);

        runtime.flushSync();

        expect(runtime.getPendingTasks().toArray()).toStrictEqual([]);

        expect(await handle.finished).toStrictEqual({
          canceled: false,
          done: true,
        });

        expect(mutationEffect.commit).toHaveBeenCalledTimes(2);
        expect(layoutEffect.commit).toHaveBeenCalledTimes(2);
        expect(passiveEffect.commit).toHaveBeenCalledTimes(1);
        expect(observer.flushEvents()).toStrictEqual([
          {
            type: 'UPDATE_START',
            id: 1,
            lanes:
              Lanes.DefaultLane |
              Lanes.UserVisibleLane |
              Lanes.ViewTransitionLane,
          },
          {
            type: 'RENDER_START',
            id: 1,
          },
          {
            type: 'RENDER_END',
            id: 1,
          },
          {
            type: 'COMMIT_START',
            id: 1,
            phase: CommitPhase.Mutation,
            effects: expect.any(EffectQueue),
          },
          {
            type: 'COMMIT_END',
            id: 1,
            phase: CommitPhase.Mutation,
            effects: expect.any(EffectQueue),
          },
          {
            type: 'COMMIT_START',
            id: 1,
            phase: CommitPhase.Layout,
            effects: expect.any(EffectQueue),
          },
          {
            type: 'COMMIT_END',
            id: 1,
            phase: CommitPhase.Layout,
            effects: expect.any(EffectQueue),
          },
          {
            type: 'UPDATE_SUCCESS',
            id: 1,
            lanes:
              Lanes.DefaultLane |
              Lanes.UserVisibleLane |
              Lanes.ViewTransitionLane,
          },
        ]);
      }

      SESSION3: {
        removeObserver();

        runtime.flushSync();

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
          type: 'UPDATE_START',
          id: 0,
          lanes: Lanes.DefaultLane | Lanes.UserBlockingLane,
        },
        {
          type: 'RENDER_START',
          id: 0,
        },
        {
          type: 'UPDATE_FAILURE',
          id: 0,
          lanes: Lanes.DefaultLane | Lanes.UserBlockingLane,
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
          Lanes.AllLanes,
          childScope,
        );

        const handle = runtime.scheduleUpdate(coroutine, {
          triggerFlush: false,
        });

        expect(await handle.scheduled).toStrictEqual({
          canceled: false,
          done: true,
        });

        runtime.flushSync();

        expect(await handle.finished).toStrictEqual({
          canceled: true,
          done: false,
        });
        expect(errorHandler).toHaveBeenCalledOnce();
        expect(errorHandler).toHaveBeenCalledWith(error, expect.any(Function));
      }

      expect(observer.flushEvents()).toStrictEqual([
        {
          type: 'UPDATE_START',
          id: 0,
          lanes: Lanes.DefaultLane | Lanes.UserBlockingLane,
        },
        {
          type: 'RENDER_START',
          id: 0,
        },
        {
          type: 'UPDATE_FAILURE',
          id: 0,
          lanes: Lanes.DefaultLane | Lanes.UserBlockingLane,
          error: expect.objectContaining({ cause: error }),
        },
      ]);
    });
  });

  describe('nextIdentifier()', () => {
    it('generates unique identifiers', () => {
      const runtime = createRuntime();

      expect(runtime.nextIdentifier()).toMatch(/^id-[0-9a-z]+-0$/);
      expect(runtime.nextIdentifier()).toMatch(/^id-[0-9a-z]+-1$/);
    });
  });

  describe('renderComponent()', () => {
    it('renders a component with the new render session', () => {
      const component = createComponent(() => null);
      const props = {};
      const state: ComponentState = {
        hooks: [],
        pendingLanes: Lanes.NoLanes,
        scope: createScope(),
      };
      const coroutine = new MockCoroutine();
      const frame = createRenderFrame(1, Lanes.AllLanes);
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
          type: 'COMPONENT_RENDER_START',
          id: 1,
          component,
          props,
          context: expect.any(RenderSession),
        },
        {
          type: 'COMPONENT_RENDER_END',
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
      pendingLanes: Lanes.NoLanes,
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
