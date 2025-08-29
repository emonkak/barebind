import { describe, expect, it, vi } from 'vitest';
import { createComponent } from '@/component.js';
import {
  $toDirective,
  CommitPhase,
  createScope,
  type Hook,
  Lanes,
  PartType,
} from '@/internal.js';
import { RenderSession } from '@/render-session.js';
import { HTML_NAMESPACE_URI } from '@/template/template.js';
import { Literal } from '@/template-literal.js';
import {
  MockBindable,
  MockCoroutine,
  MockDirective,
  MockObserver,
  MockPrimitive,
  MockSlot,
  MockTemplate,
} from '../mocks.js';
import {
  createRenderFrame,
  createRuntime,
  templateLiteral,
} from '../test-helpers.js';

describe('Runtime', () => {
  describe('expandLiterals()', () => {
    it('expands literals in template values', () => {
      const { strings, values } =
        templateLiteral`<${new Literal('div')}>${'foo'}</${new Literal('div')}>`;
      const runtime = createRuntime();

      const templateLiteral1 = runtime.expandLiterals(strings, values);
      const templateLiteral2 = runtime.expandLiterals(strings, values);

      expect(templateLiteral1.strings).toStrictEqual(['<div>', '</div>']);
      expect(templateLiteral1.values).toStrictEqual(['foo']);
      expect(templateLiteral2.strings).toBe(templateLiteral1.strings);
      expect(templateLiteral2.values).toStrictEqual(templateLiteral1.values);
    });
  });

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
        const coroutine = new MockCoroutine((context) => {
          context.frame.mutationEffects.push(mutationEffect);
          context.frame.layoutEffects.push(layoutEffect);
        });

        const handle = runtime.scheduleUpdate(coroutine, {
          priority: 'user-blocking',
          silent: true,
        });

        runtime.scheduleUpdate(coroutine, {
          priority: 'user-blocking',
          silent: true,
        });

        await handle.scheduled;

        expect(runtime.getPendingTasks()).toStrictEqual([
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

        expect(runtime.getPendingTasks()).toStrictEqual([]);

        await handle.finished;

        expect(requestCallbackSpy).toHaveBeenCalledTimes(3);
        expect(startViewTransitionSpy).toHaveBeenCalledTimes(0);
        expect(mutationEffect.commit).toHaveBeenCalledTimes(1);
        expect(layoutEffect.commit).toHaveBeenCalledTimes(1);
        expect(passiveEffect.commit).toHaveBeenCalledTimes(0);
        expect(observer.flushEvents()).toStrictEqual([
          {
            type: 'UPDATE_START',
            id: 1,
            lanes: Lanes.DefaultLane | Lanes.UserBlockingLane,
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
            effects: [mutationEffect],
          },
          {
            type: 'COMMIT_END',
            id: 1,
            phase: CommitPhase.Mutation,
            effects: [mutationEffect],
          },
          {
            type: 'COMMIT_START',
            id: 1,
            phase: CommitPhase.Layout,
            effects: [layoutEffect],
          },
          {
            type: 'COMMIT_END',
            id: 1,
            phase: CommitPhase.Layout,
            effects: [layoutEffect],
          },
          {
            type: 'UPDATE_END',
            id: 1,
            lanes: Lanes.DefaultLane | Lanes.UserBlockingLane,
          },
        ]);
      }

      SESSION2: {
        const coroutine = new MockCoroutine((context) => {
          context.frame.pendingCoroutines.push(subcoroutine);
        });
        const subcoroutine = new MockCoroutine((context) => {
          context.frame.layoutEffects.push(layoutEffect);
          context.frame.passiveEffects.push(passiveEffect);
        });

        const handle = runtime.scheduleUpdate(coroutine, {
          priority: 'user-visible',
          viewTransition: true,
          silent: true,
        });

        await handle.scheduled;

        expect(runtime.getPendingTasks()).toStrictEqual([
          expect.objectContaining({
            coroutine,
            lanes:
              Lanes.DefaultLane |
              Lanes.UserVisibleLane |
              Lanes.ViewTransitionLane,
          }),
        ]);

        await runtime.flushAsync();

        expect(runtime.getPendingTasks()).toStrictEqual([]);

        await handle.finished;

        expect(requestCallbackSpy).toHaveBeenCalledTimes(5);
        expect(startViewTransitionSpy).toHaveBeenCalledTimes(1);
        expect(mutationEffect.commit).toHaveBeenCalledTimes(1);
        expect(layoutEffect.commit).toHaveBeenCalledTimes(2);
        expect(passiveEffect.commit).toHaveBeenCalledTimes(1);
        expect(observer.flushEvents()).toStrictEqual([
          {
            type: 'UPDATE_START',
            id: 2,
            lanes:
              Lanes.DefaultLane |
              Lanes.UserVisibleLane |
              Lanes.ViewTransitionLane,
          },
          {
            type: 'RENDER_START',
            id: 2,
          },
          {
            type: 'RENDER_END',
            id: 2,
          },
          {
            type: 'COMMIT_START',
            id: 2,
            phase: CommitPhase.Layout,
            effects: [layoutEffect],
          },
          {
            type: 'COMMIT_END',
            id: 2,
            phase: CommitPhase.Layout,
            effects: [layoutEffect],
          },
          {
            type: 'COMMIT_START',
            id: 2,
            phase: CommitPhase.Passive,
            effects: [passiveEffect],
          },
          {
            type: 'COMMIT_END',
            id: 2,
            phase: CommitPhase.Passive,
            effects: [passiveEffect],
          },
          {
            type: 'UPDATE_END',
            id: 2,
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
      const error = new Error();

      SESSION: {
        const coroutine = new MockCoroutine(() => {
          throw error;
        });

        const handle = runtime.scheduleUpdate(coroutine, {
          silent: true,
        });

        await handle.scheduled;

        await runtime.flushAsync();

        await expect(handle.finished).rejects.toThrow(error);
      }
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
        const coroutine = new MockCoroutine((context) => {
          context.frame.mutationEffects.push(mutationEffect);
          context.frame.layoutEffects.push(layoutEffect);
          context.frame.passiveEffects.push(passiveEffect);
        });

        const handle = runtime.scheduleUpdate(coroutine, {
          priority: 'user-blocking',
          silent: true,
        });

        runtime.scheduleUpdate(coroutine, {
          priority: 'user-blocking',
          silent: true,
        });

        await handle.scheduled;

        expect(runtime.getPendingTasks()).toStrictEqual([
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

        expect(runtime.getPendingTasks()).toStrictEqual([]);

        await handle.finished;

        expect(mutationEffect.commit).toHaveBeenCalledTimes(1);
        expect(layoutEffect.commit).toHaveBeenCalledTimes(1);
        expect(passiveEffect.commit).toHaveBeenCalledTimes(1);
        expect(observer.flushEvents()).toStrictEqual([
          {
            type: 'UPDATE_START',
            id: 1,
            lanes: Lanes.DefaultLane | Lanes.UserBlockingLane,
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
            effects: [mutationEffect],
          },
          {
            type: 'COMMIT_END',
            id: 1,
            phase: CommitPhase.Mutation,
            effects: [mutationEffect],
          },
          {
            type: 'COMMIT_START',
            id: 1,
            phase: CommitPhase.Layout,
            effects: [layoutEffect],
          },
          {
            type: 'COMMIT_END',
            id: 1,
            phase: CommitPhase.Layout,
            effects: [layoutEffect],
          },
          {
            type: 'COMMIT_START',
            id: 1,
            phase: CommitPhase.Passive,
            effects: [passiveEffect],
          },
          {
            type: 'COMMIT_END',
            id: 1,
            phase: CommitPhase.Passive,
            effects: [passiveEffect],
          },
          {
            type: 'UPDATE_END',
            id: 1,
            lanes: Lanes.DefaultLane | Lanes.UserBlockingLane,
          },
        ]);
      }

      SESSION2: {
        const coroutine = new MockCoroutine((context) => {
          context.frame.pendingCoroutines.push(subcoroutine);
        });
        const subcoroutine = new MockCoroutine((context) => {
          context.frame.mutationEffects.push(mutationEffect);
          context.frame.layoutEffects.push(layoutEffect);
        });

        const handle = runtime.scheduleUpdate(coroutine, {
          priority: 'user-visible',
          viewTransition: true,
          silent: true,
        });

        await handle.scheduled;

        expect(runtime.getPendingTasks()).toStrictEqual([
          expect.objectContaining({
            coroutine,
            lanes:
              Lanes.DefaultLane |
              Lanes.UserVisibleLane |
              Lanes.ViewTransitionLane,
          }),
        ]);

        runtime.flushSync();

        expect(runtime.getPendingTasks()).toStrictEqual([]);

        await handle.finished;

        expect(mutationEffect.commit).toHaveBeenCalledTimes(2);
        expect(layoutEffect.commit).toHaveBeenCalledTimes(2);
        expect(passiveEffect.commit).toHaveBeenCalledTimes(1);
        expect(observer.flushEvents()).toStrictEqual([
          {
            type: 'UPDATE_START',
            id: 2,
            lanes:
              Lanes.DefaultLane |
              Lanes.UserVisibleLane |
              Lanes.ViewTransitionLane,
          },
          {
            type: 'RENDER_START',
            id: 2,
          },
          {
            type: 'RENDER_END',
            id: 2,
          },
          {
            type: 'COMMIT_START',
            id: 2,
            phase: CommitPhase.Mutation,
            effects: [mutationEffect],
          },
          {
            type: 'COMMIT_END',
            id: 2,
            phase: CommitPhase.Mutation,
            effects: [mutationEffect],
          },
          {
            type: 'COMMIT_START',
            id: 2,
            phase: CommitPhase.Layout,
            effects: [layoutEffect],
          },
          {
            type: 'COMMIT_END',
            id: 2,
            phase: CommitPhase.Layout,
            effects: [layoutEffect],
          },
          {
            type: 'UPDATE_END',
            id: 2,
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
      const error = new Error();

      SESSION: {
        const coroutine = new MockCoroutine(() => {
          throw error;
        });

        await expect(
          runtime.scheduleUpdate(coroutine).finished,
        ).rejects.toThrow(error);
      }
    });
  });

  describe('nextIdentifier()', () => {
    it('generates a new identifier', () => {
      const runtime = createRuntime();

      expect(runtime.nextIdentifier()).toMatch(/[0-9a-z]+:1/);
      expect(runtime.nextIdentifier()).toMatch(/[0-9a-z]+:2/);
    });
  });

  describe('renderComponent()', () => {
    it('renders a component with the new render context', () => {
      const component = createComponent(() => null);
      const props = {};
      const hooks: Hook[] = [];
      const coroutine = new MockCoroutine();
      const frame = createRenderFrame(1, Lanes.AllLanes);
      const scope = createScope();
      const observer = new MockObserver();
      const runtime = createRuntime();

      const renderSpy = vi.spyOn(component, 'render');

      runtime.addObserver(observer);

      const result = runtime.renderComponent(
        component,
        props,
        hooks,
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
    it('resolves the directive from the primitive value', () => {
      const value = 'foo';
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

      const directive = runtime.resolveDirective(value, part);

      expect(resolvePrimitiveSpy).toHaveBeenCalledOnce();
      expect(resolvePrimitiveSpy).toHaveBeenCalledWith(value, part);
      expect(directive.type).toBe(MockPrimitive);
      expect(directive.value).toBe(value);
      expect(directive.slotType).toBe(undefined);
    });

    it('resolves the directive from the bindable value', () => {
      const value = new MockBindable({
        type: new MockDirective(),
        value: 'foo',
      });
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const runtime = createRuntime();

      const $toDirectiveSpy = vi.spyOn(value, $toDirective);

      const directive = runtime.resolveDirective(value, part);

      expect($toDirectiveSpy).toHaveBeenCalledOnce();
      expect($toDirectiveSpy).toHaveBeenCalledWith(part, runtime);
      expect(directive.type).toBe(value.directive.type);
      expect(directive.value).toBe(value.directive.value);
      expect(directive.slotType).toBe(undefined);
    });
  });

  describe('resolveSlot()', () => {
    it('resolves the slot from the bindable value', () => {
      const directive = { type: MockPrimitive, value: 'foo' };
      const value = {
        [$toDirective]: vi.fn(() => directive),
      };
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const runtime = createRuntime();

      const resolveSlotSpy = vi.spyOn(runtime['_backend'], 'resolveSlotType');

      const slot = runtime.resolveSlot(value, part);

      expect(resolveSlotSpy).toHaveBeenCalledOnce();
      expect(resolveSlotSpy).toHaveBeenCalledWith(value, part);
      expect(slot).toBeInstanceOf(MockSlot);
      expect(slot.type).toBe(directive.type);
      expect(slot.value).toBe(directive.value);
      expect(slot.part).toBe(part);
    });

    it('resolves the slot from the primitive value', () => {
      const value = 'foo';
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

      const slot = runtime.resolveSlot(value, part);

      expect(resolvePrimitiveSpy).toHaveBeenCalledOnce();
      expect(resolvePrimitiveSpy).toHaveBeenCalledWith(value, part);
      expect(slot).toBeInstanceOf(MockSlot);
      expect(slot.type).toBe(MockPrimitive);
      expect(slot.value).toBe(value);
      expect(slot.part).toBe(part);
    });
  });

  describe('resolveTemplate()', () => {
    it('returns the cached template if it exists', () => {
      const strings = ['<div>', '</div>'];
      const binds = ['foo'];
      const mode = 'html';
      const runtime = createRuntime();

      const template = runtime.resolveTemplate(strings, binds, mode);

      expect(template).toBeInstanceOf(MockTemplate);
      expect(template).toStrictEqual(
        expect.objectContaining({
          strings,
          binds,
          mode,
        }),
      );

      expect(runtime.resolveTemplate(strings, binds, mode)).toBe(template);
    });
  });
});
