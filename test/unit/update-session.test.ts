import { describe, expect, it, vi } from 'vitest';
import { createComponent } from '@/component.js';
import { $toDirective, CommitPhase, Lanes, PartType } from '@/internal.js';
import { RenderSession } from '@/render-session.js';
import { createRuntime } from '@/runtime.js';
import { HTML_NAMESPACE_URI } from '@/template/template.js';
import { Literal } from '@/template-literal.js';
import { UpdateSession } from '@/update-session.js';
import {
  MockBackend,
  MockBindable,
  MockCoroutine,
  MockDirective,
  MockPrimitive,
  MockRuntimeObserver,
  MockSlot,
  MockTemplate,
} from '../mocks.js';
import { createUpdateSession, waitForAll } from '../session-utils.js';
import { getPromiseState, templateLiteral } from '../test-utils.js';

describe('UpdateSession', () => {
  describe('expandLiterals()', () => {
    it('expands literals in template values', () => {
      const { strings, values } =
        templateLiteral`<${new Literal('div')}>${'foo'}</${new Literal('div')}>`;
      const session = createUpdateSession();

      const templateLiteral1 = session.expandLiterals(strings, values);
      const templateLiteral2 = session.expandLiterals(strings, values);

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
      const runtime = createRuntime(new MockBackend());
      const observer = new MockRuntimeObserver();

      const requestCallbackSpy = vi.spyOn(runtime.backend, 'requestCallback');
      const startViewTransitionSpy = vi.spyOn(
        runtime.backend,
        'startViewTransition',
      );

      runtime.observers.pushBack(observer);

      SESSION1: {
        const lanes = Lanes.UserBlockingLane | Lanes.ConcurrentLane;
        const coroutine = new MockCoroutine();
        const session = UpdateSession.create(lanes, runtime);

        const resumeSpy = vi
          .spyOn(coroutine, 'resume')
          .mockImplementation((context) => {
            session.enqueueMutationEffect(mutationEffect);
            session.enqueueLayoutEffect(layoutEffect);
            session.enqueuePassiveEffect(passiveEffect);
            MockCoroutine.prototype.resume.call(coroutine, context);
          });

        session.enqueueCoroutine(coroutine);
        await session.flushAsync();

        expect(resumeSpy).toHaveBeenCalledOnce();
        expect(resumeSpy).toHaveBeenCalledWith(session);
        expect(requestCallbackSpy).toHaveBeenCalledTimes(2);
        expect(startViewTransitionSpy).toHaveBeenCalledTimes(0);
        expect(mutationEffect.commit).toHaveBeenCalledTimes(1);
        expect(layoutEffect.commit).toHaveBeenCalledTimes(1);
        expect(passiveEffect.commit).toHaveBeenCalledTimes(1);
        expect(observer.flushEvents()).toStrictEqual([
          {
            type: 'UPDATE_START',
            id: 0,
            lanes: lanes,
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
            effects: [mutationEffect],
          },
          {
            type: 'COMMIT_END',
            id: 0,
            phase: CommitPhase.Mutation,
            effects: [mutationEffect],
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
            lanes: lanes,
          },
        ]);
      }

      SESSION2: {
        const lanes =
          Lanes.BackgroundLane |
          Lanes.ViewTransitionLane |
          Lanes.ConcurrentLane;
        const coroutine = new MockCoroutine();
        const subcoroutine = new MockCoroutine();
        const session = UpdateSession.create(lanes, runtime);

        const resume1Spy = vi
          .spyOn(coroutine, 'resume')
          .mockImplementation((context) => {
            session.enqueueCoroutine(subcoroutine);
            MockCoroutine.prototype.resume.call(coroutine, context);
          });
        const resume2Spy = vi
          .spyOn(subcoroutine, 'resume')
          .mockImplementation((context) => {
            session.enqueueMutationEffect(mutationEffect);
            session.enqueueLayoutEffect(layoutEffect);
            session.enqueuePassiveEffect(passiveEffect);
            MockCoroutine.prototype.resume.call(coroutine, context);
          });

        session.enqueueCoroutine(coroutine);
        await session.flushAsync();

        expect(resume1Spy).toHaveBeenCalledOnce();
        expect(resume1Spy).toHaveBeenCalledWith(session);
        expect(resume2Spy).toHaveBeenCalledOnce();
        expect(resume2Spy).toHaveBeenCalledWith(session);
        expect(requestCallbackSpy).toHaveBeenCalledTimes(3);
        expect(startViewTransitionSpy).toHaveBeenCalledTimes(1);
        expect(mutationEffect.commit).toHaveBeenCalledTimes(2);
        expect(layoutEffect.commit).toHaveBeenCalledTimes(2);
        expect(passiveEffect.commit).toHaveBeenCalledTimes(2);
        expect(observer.flushEvents()).toStrictEqual([
          {
            type: 'UPDATE_START',
            id: 0,
            lanes: lanes,
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
            effects: [mutationEffect],
          },
          {
            type: 'COMMIT_END',
            id: 0,
            phase: CommitPhase.Mutation,
            effects: [mutationEffect],
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
            lanes: lanes,
          },
        ]);
      }

      SESSION3: {
        const lanes = Lanes.NoLanes;
        const session = UpdateSession.create(lanes, runtime);

        await session.flushAsync();

        expect(requestCallbackSpy).toHaveBeenCalledTimes(3);
        expect(startViewTransitionSpy).toHaveBeenCalledTimes(1);
        expect(mutationEffect.commit).toHaveBeenCalledTimes(2);
        expect(layoutEffect.commit).toHaveBeenCalledTimes(2);
        expect(passiveEffect.commit).toHaveBeenCalledTimes(2);
        expect(observer.flushEvents()).toStrictEqual([
          {
            type: 'UPDATE_START',
            id: 0,
            lanes,
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
            type: 'UPDATE_END',
            id: 0,
            lanes,
          },
        ]);
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
      const runtime = createRuntime(new MockBackend());
      const observer = new MockRuntimeObserver();

      runtime.observers.pushBack(observer);

      SESSION1: {
        const lanes = Lanes.UserBlockingLane | Lanes.ConcurrentLane;
        const coroutine = new MockCoroutine();
        const session = UpdateSession.create(lanes, runtime);

        const resumeSpy = vi
          .spyOn(coroutine, 'resume')
          .mockImplementation((context) => {
            context.enqueueMutationEffect(mutationEffect);
            context.enqueueLayoutEffect(layoutEffect);
            context.enqueuePassiveEffect(passiveEffect);
            MockCoroutine.prototype.resume.call(coroutine, context);
          });

        session.enqueueCoroutine(coroutine);
        session.flushSync();

        expect(resumeSpy).toHaveBeenCalledOnce();
        expect(resumeSpy).toHaveBeenCalledWith(session);
        expect(mutationEffect.commit).toHaveBeenCalledTimes(1);
        expect(layoutEffect.commit).toHaveBeenCalledTimes(1);
        expect(passiveEffect.commit).toHaveBeenCalledTimes(1);
        expect(observer.flushEvents()).toStrictEqual([
          {
            type: 'UPDATE_START',
            id: 0,
            lanes,
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
            effects: [mutationEffect],
          },
          {
            type: 'COMMIT_END',
            id: 0,
            phase: CommitPhase.Mutation,
            effects: [mutationEffect],
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
            lanes,
          },
        ]);
      }

      SESSION2: {
        const lanes = Lanes.BackgroundLane;
        const coroutine = new MockCoroutine();
        const subcoroutine = new MockCoroutine();
        const session = UpdateSession.create(lanes, runtime);

        const resume1Spy = vi
          .spyOn(coroutine, 'resume')
          .mockImplementation((context) => {
            context.enqueueCoroutine(subcoroutine);
            MockCoroutine.prototype.resume.call(coroutine, context);
          });
        const resume2Spy = vi
          .spyOn(subcoroutine, 'resume')
          .mockImplementation((context) => {
            context.enqueueMutationEffect(mutationEffect);
            context.enqueueLayoutEffect(layoutEffect);
            context.enqueuePassiveEffect(passiveEffect);
            MockCoroutine.prototype.resume.call(coroutine, context);
          });

        session.enqueueCoroutine(coroutine);
        session.flushSync();

        expect(resume1Spy).toHaveBeenCalledOnce();
        expect(resume1Spy).toHaveBeenCalledWith(session);
        expect(resume2Spy).toHaveBeenCalledOnce();
        expect(resume2Spy).toHaveBeenCalledWith(session);
        expect(mutationEffect.commit).toHaveBeenCalledTimes(2);
        expect(layoutEffect.commit).toHaveBeenCalledTimes(2);
        expect(passiveEffect.commit).toHaveBeenCalledTimes(2);
        expect(observer.flushEvents()).toStrictEqual([
          {
            type: 'UPDATE_START',
            id: 0,
            lanes,
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
            effects: [mutationEffect],
          },
          {
            type: 'COMMIT_END',
            id: 0,
            phase: CommitPhase.Mutation,
            effects: [mutationEffect],
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
            lanes,
          },
        ]);
      }

      SESSION3: {
        const lanes = Lanes.NoLanes;
        const session = UpdateSession.create(lanes, runtime);

        session.flushSync();

        expect(mutationEffect.commit).toHaveBeenCalledTimes(2);
        expect(layoutEffect.commit).toHaveBeenCalledTimes(2);
        expect(passiveEffect.commit).toHaveBeenCalledTimes(2);
        expect(observer.flushEvents()).toStrictEqual([
          {
            type: 'UPDATE_START',
            id: 0,
            lanes,
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
            type: 'UPDATE_END',
            id: 0,
            lanes,
          },
        ]);
      }
    });
  });

  describe('nextIdentifier()', () => {
    it('generates a new identifier', () => {
      const session = createUpdateSession();

      expect(session.nextIdentifier()).toMatch(/[0-9a-z]+:1/);
      expect(session.nextIdentifier()).toMatch(/[0-9a-z]+:2/);
    });
  });

  describe('renderComponent()', () => {
    it('renders a component with the new render session', () => {
      const component = createComponent(() => null);
      const props = {};
      const state = { hooks: [], pendingLanes: Lanes.NoLanes };
      const coroutine = new MockCoroutine();
      const observer = new MockRuntimeObserver();
      const session = createUpdateSession();

      const renderSpy = vi.spyOn(component, 'render');

      session.addObserver(observer);

      const result = session.renderComponent(
        component,
        props,
        state,
        coroutine,
      );

      expect(renderSpy).toHaveBeenCalledOnce();
      expect(renderSpy).toHaveBeenCalledWith(
        props,
        expect.objectContaining({
          _state: expect.exact(state),
          _coroutine: expect.exact(coroutine),
          _context: expect.exact(session),
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
      const session = createUpdateSession();

      const resolvePrimitiveSpy = vi.spyOn(
        session['_runtime'].backend,
        'resolvePrimitive',
      );

      const directive = session.resolveDirective(value, part);

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
      const session = createUpdateSession();

      const $toDirectiveSpy = vi.spyOn(value, $toDirective);

      const directive = session.resolveDirective(value, part);

      expect($toDirectiveSpy).toHaveBeenCalledOnce();
      expect($toDirectiveSpy).toHaveBeenCalledWith(part, session);
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
      const session = createUpdateSession();

      const resolveSlotSpy = vi.spyOn(
        session['_runtime'].backend,
        'resolveSlotType',
      );

      const slot = session.resolveSlot(value, part);

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
      const session = createUpdateSession();

      const resolvePrimitiveSpy = vi.spyOn(
        session['_runtime'].backend,
        'resolvePrimitive',
      );

      const slot = session.resolveSlot(value, part);

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
      const session = createUpdateSession();

      const template = session.resolveTemplate(strings, binds, mode);

      expect(template).toBeInstanceOf(MockTemplate);
      expect(template).toStrictEqual(
        expect.objectContaining({
          strings,
          binds,
          mode,
        }),
      );

      expect(session.resolveTemplate(strings, binds, mode)).toBe(template);
    });
  });

  describe.for([true, false])('scheduleUpdate()', (concurrent) => {
    const concurrentLane = concurrent ? Lanes.ConcurrentLane : Lanes.NoLanes;

    it('schedules the update with the current priority of the backend', async () => {
      const coroutine = new MockCoroutine(
        Lanes.UserBlockingLane | concurrentLane,
      );
      const session = createUpdateSession(-1, { concurrent });

      const resumeSpy = vi.spyOn(coroutine, 'resume');

      const task = session.scheduleUpdate(coroutine);

      expect(task.lanes).toBe(Lanes.UserBlockingLane | concurrentLane);

      expect(await waitForAll(session)).toBe(1);
      expect(await getPromiseState(task.promise)).toBe('fulfilled');

      expect(resumeSpy).toHaveBeenCalledOnce();
      expect(resumeSpy).toHaveBeenCalledWith(expect.not.exact(session));
      expect(resumeSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          lanes: Lanes.UserBlockingLane | concurrentLane,
        }),
      );
    });

    it('schedules as a different update if the lanes are different', async () => {
      const coroutine = new MockCoroutine(
        Lanes.UserBlockingLane |
          Lanes.BackgroundLane |
          Lanes.ViewTransitionLane |
          concurrentLane,
      );
      const session = createUpdateSession();

      const resumeSpy = vi.spyOn(coroutine, 'resume');

      const task1 = session.scheduleUpdate(coroutine, {
        priority: 'user-blocking',
        concurrent,
      });
      const task2 = session.scheduleUpdate(coroutine, {
        priority: 'background',
        concurrent,
        viewTransition: true,
      });
      const task3 = session.scheduleUpdate(coroutine, {
        priority: 'background',
        concurrent,
      });

      expect(task1.lanes).toBe(Lanes.UserBlockingLane | concurrentLane);
      expect(task2.lanes).toBe(
        Lanes.BackgroundLane | Lanes.ViewTransitionLane | concurrentLane,
      );
      expect(task3.lanes).toBe(Lanes.BackgroundLane | concurrentLane);

      expect(await waitForAll(session)).toBe(3);
      expect(await getPromiseState(task1.promise)).toBe('fulfilled');
      expect(await getPromiseState(task2.promise)).toBe('fulfilled');
      expect(await getPromiseState(task3.promise)).toBe('fulfilled');

      expect(resumeSpy).toHaveBeenCalledTimes(2);
      expect(resumeSpy).toHaveBeenCalledWith(expect.not.exact(session));
      expect(resumeSpy).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          lanes: Lanes.UserBlockingLane | concurrentLane,
        }),
      );
      expect(resumeSpy).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          lanes:
            Lanes.UserBlockingLane |
            Lanes.UserVisibleLane |
            Lanes.BackgroundLane |
            Lanes.ViewTransitionLane |
            concurrentLane,
        }),
      );
    });

    it('returns the pending task scheduled in the same lane', async () => {
      const coroutine = new MockCoroutine(
        Lanes.UserBlockingLane | concurrentLane,
      );
      const session = createUpdateSession(-1);

      const resumeSpy = vi.spyOn(coroutine, 'resume');

      const task = session.scheduleUpdate(coroutine, {
        priority: 'user-blocking',
        concurrent,
      });

      expect(task.lanes).toBe(Lanes.UserBlockingLane | concurrentLane);

      expect(
        session.scheduleUpdate(coroutine, {
          priority: 'user-blocking',
          concurrent,
        }),
      ).toBe(task);

      expect(await waitForAll(session)).toBe(1);
      expect(await getPromiseState(task.promise)).toBe('fulfilled');

      expect(resumeSpy).toHaveBeenCalledOnce();
      expect(resumeSpy).toHaveBeenCalledWith(expect.not.exact(session));
      expect(resumeSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          lanes: Lanes.UserBlockingLane | concurrentLane,
        }),
      );
    });
  });

  describe('waitForUpdate()', () => {
    it('returns 0 if pending tasks do not exist', async () => {
      const coroutine = new MockCoroutine();
      const session = createUpdateSession();

      const resumeSpy = vi.spyOn(coroutine, 'resume');

      expect(await waitForAll(session)).toBe(0);

      expect(resumeSpy).not.toHaveBeenCalled();
    });
  });
});
