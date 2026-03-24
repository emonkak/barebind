import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrowserBackend } from '@/backend/browser.js';
import {
  type Effect,
  EffectQueue,
  PART_TYPE_TEXT,
  type Part,
  type Primitive,
} from '@/core.js';
import {
  createAttributePart,
  createChildNodePart,
  createElementPart,
  createEventPart,
  createLivePart,
  createPropertyPart,
  createTextPart,
  HTML_NAMESPACE_URI,
} from '@/dom.js';
import { ConcurrentLane } from '@/lane.js';
import { AttributeType } from '@/primitive/attribute.js';
import { BlackholeType } from '@/primitive/blackhole.js';
import { ClassType } from '@/primitive/class.js';
import { CommentType } from '@/primitive/comment.js';
import { EventType } from '@/primitive/event.js';
import { LiveType } from '@/primitive/live.js';
import { PropertyType } from '@/primitive/property.js';
import { RefType } from '@/primitive/ref.js';
import { SpreadType } from '@/primitive/spread.js';
import { StyleType } from '@/primitive/style.js';
import { TextType } from '@/primitive/text.js';
import { Repeat } from '@/repeat.js';
import { TaggedTemplate } from '@/template/tagged.js';
import { templateLiteral } from '../../test-helpers.js';

const CONTINUOUS_EVENT_TYPES: (keyof DocumentEventMap)[] = [
  'drag',
  'dragenter',
  'dragleave',
  'dragover',
  'mouseenter',
  'mouseleave',
  'mousemove',
  'mouseout',
  'mouseover',
  'pointerenter',
  'pointerleave',
  'pointermove',
  'pointerout',
  'pointerover',
  'scroll',
  'touchmove',
  'wheel',
];

const TEMPLATE_PLACEHOLDER = '__test__';

describe('BrowserBackend', () => {
  describe('flushEffects()', () => {
    it('commits all effects in order from child to parent', () => {
      const mutationEffects = new EffectQueue();
      const layoutEffects = new EffectQueue();
      const passiveEffects = new EffectQueue();
      const backend = new BrowserBackend();

      const mutationEffect: Effect = {
        commit: vi.fn(),
      };
      const layoutEffect: Effect = {
        commit: vi.fn(),
      };
      const passiveEffect: Effect = {
        commit: vi.fn(),
      };

      mutationEffects.push(mutationEffect, 0);
      mutationEffects.push(mutationEffect, 1);
      mutationEffects.push(mutationEffect, 1);
      mutationEffects.push(mutationEffect, 2);
      layoutEffects.push(layoutEffect, 0);
      layoutEffects.push(layoutEffect, 2);
      passiveEffects.push(passiveEffect, 1);

      backend.flushEffects(mutationEffects, 'mutation');
      backend.flushEffects(layoutEffects, 'layout');
      backend.flushEffects(passiveEffects, 'passive');

      expect(mutationEffect.commit).toHaveBeenCalledTimes(4);
      expect(layoutEffect.commit).toHaveBeenCalledTimes(2);
      expect(passiveEffect.commit).toHaveBeenCalledTimes(1);
    });
  });

  describe('getDefaultLanes()', () => {
    it('returns ConcurrentLane', () => {
      const backend = new BrowserBackend();

      expect(backend.getDefaultLanes()).toBe(ConcurrentLane);
    });
  });

  describe('getUpdatePriority()', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it.for(
      CONTINUOUS_EVENT_TYPES,
    )('returns "user-visible" when the current event is "%s"', (eventType) => {
      const backend = new BrowserBackend();
      const getEventSpy = vi
        .spyOn(window, 'event', 'get')
        .mockReturnValue(new CustomEvent(eventType));

      expect(backend.getUpdatePriority()).toBe('user-visible');
      expect(getEventSpy).toHaveBeenCalled();
    });

    it('returns "user-blocking" when the current event is not continuous', () => {
      const backend = new BrowserBackend();
      const getEventSpy = vi
        .spyOn(window, 'event', 'get')
        .mockReturnValue(new MouseEvent('click'));

      expect(backend.getUpdatePriority()).toBe('user-blocking');
      expect(getEventSpy).toHaveBeenCalled();
    });

    it('otherwise returns "user-visible"', () => {
      const backend = new BrowserBackend();

      const getEventSpy = vi
        .spyOn(window, 'event', 'get')
        .mockReturnValue(undefined);

      expect(backend.getUpdatePriority()).toBe('user-visible');
      expect(getEventSpy).toHaveBeenCalledOnce();
    });
  });

  describe('requestCallback()', () => {
    afterEach(() => {
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    });

    it('schedules a callback with "user-blocking" priority using Scheduler.postTask()', () => {
      vi.stubGlobal('scheduler', {
        postTask(callback) {
          return callback();
        },
      } as Partial<Scheduler>);

      const backend = new BrowserBackend();
      const callback = vi.fn();
      const options = { priority: 'user-blocking' } as const;
      const postTaskSpy = vi.spyOn(window.scheduler, 'postTask');

      backend.requestCallback(callback, options);

      expect(callback).toHaveBeenCalledOnce();
      expect(postTaskSpy).toHaveBeenCalledOnce();
      expect(postTaskSpy).toHaveBeenCalledWith(callback, options);
    });

    it('should schedule a callback with "user-blocking" priority using MessageChannel', async () => {
      vi.stubGlobal('scheduler', undefined);

      const backend = new BrowserBackend();
      const callback = vi.fn();
      const setOnmessageSpy = vi.spyOn(
        MessagePort.prototype,
        'onmessage',
        'set',
      );
      const postMessageSpy = vi.spyOn(MessagePort.prototype, 'postMessage');

      backend.requestCallback(callback, { priority: 'user-blocking' });

      await new Promise((resolve) => setTimeout(resolve));

      expect(callback).toHaveBeenCalledOnce();
      expect(setOnmessageSpy).toHaveBeenCalledOnce();
      expect(setOnmessageSpy).toHaveBeenCalledWith(expect.any(Function));
      expect(postMessageSpy).toHaveBeenCalledOnce();
      expect(postMessageSpy).toHaveBeenCalledWith(null);
    });

    it('schedules a callback with "user-visible" priority using setTimeout()', async () => {
      vi.stubGlobal('scheduler', undefined);

      const backend = new BrowserBackend();
      const callback = vi.fn();
      const setTimeoutSpy = vi.spyOn(window, 'setTimeout');

      await backend.requestCallback(callback);
      await backend.requestCallback(callback, {
        priority: 'user-visible',
      });

      expect(callback).toHaveBeenCalledTimes(2);
      expect(setTimeoutSpy).toHaveBeenCalledTimes(2);
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function));
    });

    it('schedules a callback with "background" priority using setTimeout()', async () => {
      vi.stubGlobal('scheduler', undefined);
      vi.stubGlobal('requestIdleCallback', undefined);

      const backend = new BrowserBackend();
      const callback = vi.fn();
      const setTimeoutSpy = vi.spyOn(window, 'setTimeout');

      await backend.requestCallback(callback);
      await backend.requestCallback(callback, {
        priority: 'background',
      });

      expect(callback).toHaveBeenCalledTimes(2);
      expect(setTimeoutSpy).toHaveBeenCalledTimes(2);
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 1);
    });

    it('should schedule a callback with "background" priority using requestIdleCallback()', async () => {
      vi.stubGlobal('scheduler', undefined);
      vi.stubGlobal('requestIdleCallback', ((callback) => {
        callback({} as IdleDeadline);
        return 0;
      }) as typeof requestIdleCallback);

      const backend = new BrowserBackend();
      const callback = vi.fn();
      const requestIdleCallbackSpy = vi.spyOn(window, 'requestIdleCallback');

      await backend.requestCallback(callback, {
        priority: 'background',
      });

      expect(callback).toHaveBeenCalledOnce();
      expect(requestIdleCallbackSpy).toHaveBeenCalledOnce();
      expect(requestIdleCallbackSpy).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('resolvePrimitive()', () => {
    it.each<[unknown, Part, Primitive<unknown>]>([
      [
        'foo',
        createAttributePart(document.createElement('div'), 'class'),
        AttributeType,
      ],
      [
        'foo',
        createChildNodePart(document.createComment(''), HTML_NAMESPACE_URI),
        CommentType,
      ],
      [() => {}, createElementPart(document.createElement('div')), SpreadType],
      [
        'foo',
        createEventPart(document.createElement('div'), 'click'),
        EventType,
      ],
      [
        'foo',
        createLivePart(document.createElement('textarea'), 'value'),
        LiveType,
      ],
      [
        'foo',
        createPropertyPart(document.createElement('textarea'), 'value'),
        PropertyType,
      ],
      ['foo', createTextPart(document.createTextNode(''), '', ''), TextType],
    ])('resolves basic primitives depending on the part', (source, part, expectedPrimitive) => {
      const backend = new BrowserBackend();

      expect(backend.resolvePrimitive(source, part)).toStrictEqual(
        expectedPrimitive,
      );
    });

    it.each<[unknown, Part, Primitive<unknown>]>([
      [
        null,
        createChildNodePart(document.createComment(''), HTML_NAMESPACE_URI),
        BlackholeType,
      ],
      [
        undefined,
        createChildNodePart(document.createComment(''), HTML_NAMESPACE_URI),
        BlackholeType,
      ],
      [
        ['foo'],
        createChildNodePart(document.createComment(''), HTML_NAMESPACE_URI),
        Repeat,
      ],
      [
        Iterator.from(['foo']),
        createChildNodePart(document.createComment(''), HTML_NAMESPACE_URI),
        Repeat,
      ],
    ])('resolves child node primitives depending on the source', (source, part, expectedPrimitive) => {
      const backend = new BrowserBackend();

      expect(backend.resolvePrimitive(source, part)).toStrictEqual(
        expectedPrimitive,
      );
    });

    it.each<[unknown, Part.AttributePart, Primitive<unknown>]>([
      [
        [],
        createAttributePart(document.createElement('div'), ':class'),
        ClassType,
      ],
      [
        { current: null },
        createAttributePart(document.createElement('div'), ':ref'),
        RefType,
      ],
      [
        {},
        createAttributePart(document.createElement('div'), ':style'),
        StyleType,
      ],
      [
        null,
        createAttributePart(document.createElement('div'), ':'),
        BlackholeType,
      ],
    ])('resolves special primitives from the attribute part starting with ":"', (source, part, expectedPrimitive) => {
      const backend = new BrowserBackend();

      expect(backend.resolvePrimitive(source, part)).toBe(expectedPrimitive);
      expect(
        backend.resolvePrimitive(source, {
          ...part,
          name: part.name.toUpperCase(),
        }),
      ).toBe(expectedPrimitive);
    });
  });

  describe('resolveTemplate()', () => {
    it('creates a TaggedTemplate', () => {
      const [strings, ...exprs] =
        templateLiteral`<div>${'Hello'}, ${'World'}!</div>`;
      const backend = new BrowserBackend();
      const template = backend.resolveTemplate(
        strings,
        exprs,
        'html',
        TEMPLATE_PLACEHOLDER,
      );

      expect(template).toBeInstanceOf(TaggedTemplate);
      expect((template as TaggedTemplate)['_template'].innerHTML).toBe(
        '<div></div>',
      );
      expect((template as TaggedTemplate)['_holes']).toStrictEqual([
        {
          type: PART_TYPE_TEXT,
          index: 1,
          precedingText: '',
          followingText: '',
        },
        {
          type: PART_TYPE_TEXT,
          index: 2,
          precedingText: ', ',
          followingText: '!',
        },
      ]);
    });
  });

  describe('startViewTransition()', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it.runIf(typeof document.startViewTransition === 'function')(
      'invokes the callback using document.startViewTransition()',
      async () => {
        const backend = new BrowserBackend();
        const callback = vi.fn();
        const startViewTransitionSpy = vi.spyOn(
          document,
          'startViewTransition',
        );

        await backend.startViewTransition(callback);

        expect(startViewTransitionSpy).toHaveBeenCalledOnce();
        expect(startViewTransitionSpy).toHaveBeenCalledWith(callback);
        expect(callback).toHaveBeenCalledOnce();
      },
    );

    it('invokes the callback as a microtask', async () => {
      const backend = new BrowserBackend();
      const callback = vi.fn();

      vi.spyOn(
        document as { startViewTransition: unknown },
        'startViewTransition',
        'get',
      ).mockReturnValue(undefined);

      await backend.startViewTransition(callback);

      expect(callback).toHaveBeenCalledOnce();
    });
  });

  describe('yieldToMain()', () => {
    afterEach(() => {
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    });

    it('returns a promise by scheduler.yield()', async () => {
      vi.stubGlobal('scheduler', {
        yield() {
          return Promise.resolve();
        },
      } as Partial<Scheduler>);

      const backend = new BrowserBackend();
      const yieldSpy = vi.spyOn(window.scheduler, 'yield');

      expect(await backend.yieldToMain()).toBe(undefined);
      expect(yieldSpy).toHaveBeenCalledOnce();
    });

    it('waits until the timer to be executed', async () => {
      vi.stubGlobal('scheduler', undefined);

      const backend = new BrowserBackend();
      const setTimeoutSpy = vi.spyOn(window, 'setTimeout');

      expect(await backend.yieldToMain()).toBe(undefined);
      expect(setTimeoutSpy).toHaveBeenCalledOnce();
    });
  });
});
