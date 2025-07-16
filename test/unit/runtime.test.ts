import { describe, expect, it, vi } from 'vitest';
import {
  $toDirective,
  ALL_LANES,
  CommitPhase,
  type Coroutine,
  type Hook,
  Lane,
  NO_LANES,
} from '@/core.js';
import { PartType } from '@/part.js';
import { RenderSession } from '@/render-session.js';
import { Runtime } from '@/runtime.js';
import { Scope } from '@/scope.js';
import { HTML_NAMESPACE_URI } from '@/template/template.js';
import { Literal } from '@/template-literal.js';
import {
  MockBackend,
  MockBindable,
  MockComponent,
  MockCoroutine,
  MockDirective,
  MockPrimitive,
  MockRuntimeObserver,
  MockSlot,
  MockTemplate,
} from '../mocks.js';
import { getPromiseState, templateLiteral } from '../test-utils.js';

describe('Runtime', () => {
  describe('debugValue()', () => {
    it('sets the debug information for the value in child node part', () => {
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const runtime = new Runtime(new MockBackend());

      runtime.debugValue(new MockDirective('FirstDirective'), 'foo', part);
      expect(part.node.data).toBe('/FirstDirective("foo")');

      runtime.debugValue(new MockDirective('FirstDirective'), 'bar', part);
      expect(part.node.data).toBe('/FirstDirective("bar")');

      runtime.debugValue(new MockDirective('SecondDirective'), 'baz', part);
      expect(part.node.data).toBe('/FirstDirective("bar")');

      runtime.undebugValue(new MockDirective('FirstDirective'), 'bar', part);
      expect(part.node.data).toBe('');

      runtime.debugValue(new MockDirective('SecondDirective'), 'baz', part);
      expect(part.node.data).toBe('/SecondDirective("baz")');
    });

    it('should do nothing if the part is not a child node part', () => {
      const part = {
        type: PartType.Text,
        node: document.createTextNode(''),
        precedingText: '',
        followingText: '',
      };
      const runtime = new Runtime(new MockBackend());

      runtime.debugValue(new MockDirective('FirstDirective'), 'foo', part);

      expect(part.node.data).toBe('');

      runtime.undebugValue(new MockDirective('FirstDirective'), 'bar', part);

      expect(part.node.data).toBe('');
    });
  });

  describe('enterScope()', () => {
    it('returns a new Runtime with the new scope', () => {
      const scope = new Scope(null);
      const runtime = new Runtime(new MockBackend());
      const newRuntime = runtime.enterScope(scope);

      expect(newRuntime).not.toBe(runtime);
      expect(newRuntime.getScope()).toBe(scope);
      expect(newRuntime.getScope()).not.toBe(runtime.getScope());
    });
  });

  describe('expandLiterals()', () => {
    it('expands literals in template values', () => {
      const { strings, values } =
        templateLiteral`<${new Literal('div')}>${'foo'}</${new Literal('div')}>`;
      const runtime = new Runtime(new MockBackend());

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
      const subcoroutine: Coroutine = {
        resume: vi.fn((_lane, context) => {
          context.enqueueMutationEffect(mutationEffect);
          context.enqueueLayoutEffect(layoutEffect);
          context.enqueuePassiveEffect(passiveEffect);
          return NO_LANES;
        }),
        commit: vi.fn(),
      };
      const coroutine: Coroutine = {
        resume: vi.fn((_lane, context) => {
          context.enqueueCoroutine(subcoroutine);
          return NO_LANES;
        }),
        commit: vi.fn(),
      };
      const observer = new MockRuntimeObserver();
      const runtime = new Runtime(new MockBackend());
      const unobserve = runtime.observe(observer);

      const requestCallbackSpy = vi.spyOn(
        runtime['_backend'],
        'requestCallback',
      );
      const startViewTransitionSpy = vi.spyOn(
        runtime['_backend'],
        'startViewTransition',
      );

      runtime.enqueueCoroutine(coroutine);
      runtime.enqueueMutationEffect(coroutine);

      await runtime.flushAsync({
        priority: 'user-blocking',
        viewTransition: false,
      });

      expect(requestCallbackSpy).toHaveBeenCalledTimes(2);
      expect(startViewTransitionSpy).toHaveBeenCalledTimes(0);
      expect(subcoroutine.resume).toHaveBeenCalledTimes(1);
      expect(subcoroutine.resume).toHaveBeenCalledWith(
        Lane.UserBlocking,
        runtime,
      );
      expect(coroutine.resume).toHaveBeenCalledTimes(1);
      expect(coroutine.resume).toHaveBeenCalledWith(Lane.UserBlocking, runtime);
      expect(mutationEffect.commit).toHaveBeenCalledTimes(1);
      expect(mutationEffect.commit).toHaveBeenCalledWith(runtime);
      expect(layoutEffect.commit).toHaveBeenCalledTimes(1);
      expect(layoutEffect.commit).toHaveBeenCalledWith(runtime);
      expect(passiveEffect.commit).toHaveBeenCalledTimes(1);
      expect(passiveEffect.commit).toHaveBeenCalledWith(runtime);
      expect(observer.flushEvents()).toStrictEqual([
        {
          type: 'UPDATE_START',
          id: 0,
          priority: 'user-blocking',
          viewTransition: false,
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
          effects: [coroutine, mutationEffect],
        },
        {
          type: 'COMMIT_END',
          id: 0,
          phase: CommitPhase.Mutation,
          effects: [coroutine, mutationEffect],
        },
        {
          type: 'COMMIT_START',
          id: 0,
          phase: CommitPhase.Layout,
          effects: [layoutEffect],
        },
        {
          type: 'COMMIT_END',
          id: 0,
          phase: CommitPhase.Layout,
          effects: [layoutEffect],
        },
        {
          type: 'COMMIT_START',
          id: 0,
          phase: CommitPhase.Passive,
          effects: [passiveEffect],
        },
        {
          type: 'COMMIT_END',
          id: 0,
          phase: CommitPhase.Passive,
          effects: [passiveEffect],
        },
        {
          type: 'UPDATE_END',
          id: 0,
          priority: 'user-blocking',
          viewTransition: false,
        },
      ]);

      runtime.enqueueCoroutine(subcoroutine);
      runtime.enqueueMutationEffect(subcoroutine);
      await runtime.flushAsync({
        priority: 'background',
        viewTransition: true,
      });

      expect(requestCallbackSpy).toHaveBeenCalledTimes(3);
      expect(startViewTransitionSpy).toHaveBeenCalledTimes(1);
      expect(subcoroutine.resume).toHaveBeenCalledTimes(2);
      expect(subcoroutine.resume).toHaveBeenCalledWith(
        Lane.UserBlocking,
        runtime,
      );
      expect(coroutine.resume).toHaveBeenCalledTimes(1);
      expect(mutationEffect.commit).toHaveBeenCalledTimes(2);
      expect(mutationEffect.commit).toHaveBeenCalledWith(runtime);
      expect(layoutEffect.commit).toHaveBeenCalledTimes(2);
      expect(layoutEffect.commit).toHaveBeenCalledWith(runtime);
      expect(passiveEffect.commit).toHaveBeenCalledTimes(2);
      expect(passiveEffect.commit).toHaveBeenCalledWith(runtime);
      expect(observer.flushEvents()).toStrictEqual([
        {
          type: 'UPDATE_START',
          id: 0,
          priority: 'background',
          viewTransition: true,
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
          effects: [subcoroutine, mutationEffect],
        },
        {
          type: 'COMMIT_END',
          id: 0,
          phase: CommitPhase.Mutation,
          effects: [subcoroutine, mutationEffect],
        },
        {
          type: 'COMMIT_START',
          id: 0,
          phase: CommitPhase.Layout,
          effects: [layoutEffect],
        },
        {
          type: 'COMMIT_END',
          id: 0,
          phase: CommitPhase.Layout,
          effects: [layoutEffect],
        },
        {
          type: 'COMMIT_START',
          id: 0,
          phase: CommitPhase.Passive,
          effects: [passiveEffect],
        },
        {
          type: 'COMMIT_END',
          id: 0,
          phase: CommitPhase.Passive,
          effects: [passiveEffect],
        },
        {
          type: 'UPDATE_END',
          id: 0,
          priority: 'background',
          viewTransition: true,
        },
      ]);

      unobserve();
      await runtime.flushAsync({
        priority: 'background',
        viewTransition: false,
      });

      expect(requestCallbackSpy).toHaveBeenCalledTimes(4);
      expect(startViewTransitionSpy).toHaveBeenCalledTimes(1);
      expect(subcoroutine.resume).toHaveBeenCalledTimes(2);
      expect(coroutine.resume).toHaveBeenCalledTimes(1);
      expect(mutationEffect.commit).toHaveBeenCalledTimes(2);
      expect(layoutEffect.commit).toHaveBeenCalledTimes(2);
      expect(passiveEffect.commit).toHaveBeenCalledTimes(2);
      expect(observer.flushEvents()).toStrictEqual([]);
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
      const subcoroutine: Coroutine = {
        resume: vi.fn((_lanes, context) => {
          context.enqueueMutationEffect(mutationEffect);
          context.enqueueLayoutEffect(layoutEffect);
          context.enqueuePassiveEffect(passiveEffect);
          return NO_LANES;
        }),
        commit: vi.fn(),
      };
      const coroutine: Coroutine = {
        resume: vi.fn((_lane, context) => {
          context.enqueueCoroutine(subcoroutine);
          return NO_LANES;
        }),
        commit: vi.fn(),
      };
      const observer = new MockRuntimeObserver();
      const runtime = new Runtime(new MockBackend());
      const unobserve = runtime.observe(observer);

      runtime.enqueueCoroutine(coroutine);
      runtime.enqueueMutationEffect(coroutine);
      runtime.flushSync();

      expect(subcoroutine.resume).toHaveBeenCalledTimes(1);
      expect(subcoroutine.resume).toHaveBeenCalledWith(ALL_LANES, runtime);
      expect(coroutine.resume).toHaveBeenCalledTimes(1);
      expect(coroutine.resume).toHaveBeenCalledWith(ALL_LANES, runtime);
      expect(mutationEffect.commit).toHaveBeenCalledTimes(1);
      expect(mutationEffect.commit).toHaveBeenCalledWith(runtime);
      expect(layoutEffect.commit).toHaveBeenCalledTimes(1);
      expect(layoutEffect.commit).toHaveBeenCalledWith(runtime);
      expect(passiveEffect.commit).toHaveBeenCalledTimes(1);
      expect(passiveEffect.commit).toHaveBeenCalledWith(runtime);
      expect(observer.flushEvents()).toStrictEqual([
        {
          type: 'UPDATE_START',
          id: 0,
          priority: null,
          viewTransition: false,
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
          effects: [coroutine, mutationEffect],
        },
        {
          type: 'COMMIT_END',
          id: 0,
          phase: CommitPhase.Mutation,
          effects: [coroutine, mutationEffect],
        },
        {
          type: 'COMMIT_START',
          id: 0,
          phase: CommitPhase.Layout,
          effects: [layoutEffect],
        },
        {
          type: 'COMMIT_END',
          id: 0,
          phase: CommitPhase.Layout,
          effects: [layoutEffect],
        },
        {
          type: 'COMMIT_START',
          id: 0,
          phase: CommitPhase.Passive,
          effects: [passiveEffect],
        },
        {
          type: 'COMMIT_END',
          id: 0,
          phase: CommitPhase.Passive,
          effects: [passiveEffect],
        },
        {
          type: 'UPDATE_END',
          id: 0,
          priority: null,
          viewTransition: false,
        },
      ]);

      runtime.enqueueCoroutine(subcoroutine);
      runtime.enqueueMutationEffect(subcoroutine);
      runtime.flushSync();

      expect(subcoroutine.resume).toHaveBeenCalledTimes(2);
      expect(subcoroutine.resume).toHaveBeenCalledWith(ALL_LANES, runtime);
      expect(coroutine.resume).toHaveBeenCalledTimes(1);
      expect(mutationEffect.commit).toHaveBeenCalledTimes(2);
      expect(mutationEffect.commit).toHaveBeenCalledWith(runtime);
      expect(layoutEffect.commit).toHaveBeenCalledTimes(2);
      expect(layoutEffect.commit).toHaveBeenCalledWith(runtime);
      expect(passiveEffect.commit).toHaveBeenCalledTimes(2);
      expect(passiveEffect.commit).toHaveBeenCalledWith(runtime);
      expect(observer.flushEvents()).toStrictEqual([
        {
          type: 'UPDATE_START',
          id: 0,
          priority: null,
          viewTransition: false,
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
          effects: [subcoroutine, mutationEffect],
        },
        {
          type: 'COMMIT_END',
          id: 0,
          phase: CommitPhase.Mutation,
          effects: [subcoroutine, mutationEffect],
        },
        {
          type: 'COMMIT_START',
          id: 0,
          phase: CommitPhase.Layout,
          effects: [layoutEffect],
        },
        {
          type: 'COMMIT_END',
          id: 0,
          phase: CommitPhase.Layout,
          effects: [layoutEffect],
        },
        {
          type: 'COMMIT_START',
          id: 0,
          phase: CommitPhase.Passive,
          effects: [passiveEffect],
        },
        {
          type: 'COMMIT_END',
          id: 0,
          phase: CommitPhase.Passive,
          effects: [passiveEffect],
        },
        {
          type: 'UPDATE_END',
          id: 0,
          priority: null,
          viewTransition: false,
        },
      ]);

      unobserve();
      runtime.flushSync();

      expect(subcoroutine.resume).toHaveBeenCalledTimes(2);
      expect(coroutine.resume).toHaveBeenCalledTimes(1);
      expect(mutationEffect.commit).toHaveBeenCalledTimes(2);
      expect(layoutEffect.commit).toHaveBeenCalledTimes(2);
      expect(passiveEffect.commit).toHaveBeenCalledTimes(2);
    });
  });

  describe('nextIdentifier()', () => {
    it('generates a new identifier', () => {
      const runtime = new Runtime(new MockBackend());

      expect(runtime.nextIdentifier()).toMatch(/[0-9a-z]+-1/);
      expect(runtime.nextIdentifier()).toMatch(/[0-9a-z]+-2/);
    });
  });

  describe('renderComponent()', () => {
    it('renders the component with a new render session', () => {
      const component = new MockComponent();
      const props = {};
      const hooks: Hook[] = [];
      const lanes = ALL_LANES;
      const coroutine = new MockCoroutine();
      const observer = new MockRuntimeObserver();
      const runtime = new Runtime(new MockBackend());

      const renderSpy = vi.spyOn(component, 'render');

      runtime.observe(observer);

      const result = runtime.renderComponent(
        component,
        props,
        hooks,
        lanes,
        coroutine,
      );

      expect(renderSpy).toHaveBeenCalledOnce();
      expect(renderSpy).toHaveBeenCalledWith(
        props,
        expect.objectContaining({
          _context: expect.exact(runtime),
          _hooks: expect.exact(hooks),
          _lanes: expect.exact(lanes),
          _coroutine: expect.exact(coroutine),
        }),
      );
      expect(observer.flushEvents()).toStrictEqual([
        {
          type: 'COMPONENT_RENDER_START',
          id: 0,
          component,
          props,
          context: expect.any(RenderSession),
        },
        {
          type: 'COMPONENT_RENDER_END',
          id: 0,
          component,
          props,
          context: expect.any(RenderSession),
        },
      ]);
      expect(result.value).toBe(null);
      expect(result.pendingLanes).toBe(NO_LANES);
    });
  });

  describe('resolveDirective()', () => {
    it('resolves the directive from the primitive value', () => {
      const value = 'foo';
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const runtime = new Runtime(new MockBackend());

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
        childNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const runtime = new Runtime(new MockBackend());

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
        childNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const runtime = new Runtime(new MockBackend());

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
        childNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const runtime = new Runtime(new MockBackend());

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
      const runtime = new Runtime(new MockBackend());

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

  describe('scheduleUpdate()', () => {
    it('schedules the update with the current priority of the backend', async () => {
      const coroutine = new MockCoroutine();
      const runtime = new Runtime(new MockBackend());

      const resumeSpy = vi.spyOn(coroutine, 'resume');

      const task = runtime.scheduleUpdate(coroutine);

      expect(task.lanes).toBe(Lane.UserBlocking);

      expect(await runtime.waitForUpdate(coroutine)).toBe(1);
      expect(await getPromiseState(task.promise)).toBe('fulfilled');

      expect(resumeSpy).toHaveBeenCalledOnce();
      expect(resumeSpy).toHaveBeenCalledWith(
        Lane.UserBlocking,
        expect.not.exact(runtime),
      );
    });

    it('schedules as a different update if the lanes are different', async () => {
      const coroutine = new MockCoroutine();
      const runtime = new Runtime(new MockBackend());

      const resumeSpy = vi.spyOn(coroutine, 'resume');

      const task1 = runtime.scheduleUpdate(coroutine, {
        priority: 'user-blocking',
      });
      const task2 = runtime.scheduleUpdate(coroutine, {
        priority: 'background',
      });
      const task3 = runtime.scheduleUpdate(coroutine, {
        priority: 'background',
        viewTransition: true,
      });

      expect(task1.lanes).toBe(Lane.UserBlocking);
      expect(task2.lanes).toBe(Lane.Background);
      expect(task3.lanes).toBe(Lane.Background | Lane.ViewTransition);

      expect(await runtime.waitForUpdate(coroutine)).toBe(3);
      expect(await getPromiseState(task1.promise)).toBe('fulfilled');
      expect(await getPromiseState(task2.promise)).toBe('fulfilled');
      expect(await getPromiseState(task3.promise)).toBe('fulfilled');

      expect(resumeSpy).toHaveBeenCalledOnce();
      expect(resumeSpy).toHaveBeenCalledWith(
        Lane.UserBlocking,
        expect.not.exact(runtime),
      );
    });

    it('returns the pending task scheduled in the same lane', async () => {
      const coroutine = new MockCoroutine();
      const runtime = new Runtime(new MockBackend());

      const resumeSpy = vi.spyOn(coroutine, 'resume');

      const task = runtime.scheduleUpdate(coroutine, {
        priority: 'user-blocking',
      });

      expect(task.lanes).toBe(Lane.UserBlocking);

      expect(
        runtime.scheduleUpdate(coroutine, { priority: 'user-blocking' }),
      ).toBe(task);

      expect(await runtime.waitForUpdate(coroutine)).toBe(1);
      expect(await getPromiseState(task.promise)).toBe('fulfilled');

      expect(resumeSpy).toHaveBeenCalledOnce();
      expect(resumeSpy).toHaveBeenCalledWith(
        Lane.UserBlocking,
        expect.not.exact(runtime),
      );
    });
  });

  describe('waitForUpdate()', () => {
    it('returns 0 if pending tasks do not exist', async () => {
      const coroutine = new MockCoroutine();
      const runtime = new Runtime(new MockBackend());

      const resumeSpy = vi.spyOn(coroutine, 'resume');

      expect(await runtime.waitForUpdate(coroutine)).toBe(0);

      expect(resumeSpy).not.toHaveBeenCalled();
    });
  });
});
