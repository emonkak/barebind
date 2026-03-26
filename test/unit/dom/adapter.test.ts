import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClientAdapter } from '@/dom/adapter.js';
import {
  createAttributePart,
  createChildNodePart,
  createElementPart,
  createEventPart,
  createLivePart,
  createPropertyPart,
  createTextPart,
  PART_TYPE_TEXT,
} from '@/dom/part.js';
import { DOMAttribute } from '@/dom/primitive/attribute.js';
import { DOMClass } from '@/dom/primitive/class.js';
import { DOMEvent } from '@/dom/primitive/event.js';
import { DOMLive } from '@/dom/primitive/live.js';
import { DOMNode } from '@/dom/primitive/node.js';
import { DOMProperty } from '@/dom/primitive/property.js';
import { DOMRef } from '@/dom/primitive/ref.js';
import { DOMRepeat } from '@/dom/primitive/repeat.js';
import { DOMSpread } from '@/dom/primitive/spread.js';
import { DOMStyle } from '@/dom/primitive/style.js';
import { ConcurrentLane } from '@/lane.js';
import { Blackhole } from '@/primitive.js';
import { templateLiteral } from '../../helpers.js';
import { createEffect, createEffectQueue } from '../../mocks.js';

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

describe('ClientAdapter', () => {
  const container = document.createElement('div');
  const adapter = new ClientAdapter(container);

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('container', () => {
    it('returns the container element', () => {
      expect(adapter.container).toBe(container);
    });
  });

  describe('flushEffects()', () => {
    it('commits all pending effects', () => {
      const mutationEffect = createEffect();
      const layoutEffect = createEffect();
      const passiveEffect = createEffect();
      const mutationEffects = createEffectQueue(
        mutationEffect,
        mutationEffect,
        mutationEffect,
        mutationEffect,
      );
      const layoutEffects = createEffectQueue(layoutEffect, layoutEffect);
      const passiveEffects = createEffectQueue(passiveEffect);

      adapter.flushEffects(mutationEffects, 'mutation');
      adapter.flushEffects(layoutEffects, 'layout');
      adapter.flushEffects(passiveEffects, 'passive');

      expect(mutationEffect.commit).toHaveBeenCalledTimes(4);
      expect(layoutEffect.commit).toHaveBeenCalledTimes(2);
      expect(passiveEffect.commit).toHaveBeenCalledTimes(1);
    });
  });

  describe('getDefaultLanes()', () => {
    it('returns ConcurrentLane', () => {
      expect(adapter.getDefaultLanes()).toBe(ConcurrentLane);
    });
  });

  describe('getUpdatePriority()', () => {
    it.for(
      CONTINUOUS_EVENT_TYPES,
    )('returns "user-visible" when the current event is "%s"', (DOMevent) => {
      const getEventSpy = vi
        .spyOn(window, 'event', 'get')
        .mockReturnValue(new CustomEvent(DOMevent));

      expect(adapter.getUpdatePriority()).toBe('user-visible');
      expect(getEventSpy).toHaveBeenCalled();
    });

    it('returns "user-blocking" when the current event is not continuous', () => {
      const getEventSpy = vi
        .spyOn(window, 'event', 'get')
        .mockReturnValue(new MouseEvent('click'));

      expect(adapter.getUpdatePriority()).toBe('user-blocking');
      expect(getEventSpy).toHaveBeenCalled();
    });

    it('returns "user-visible" when there is no current event', () => {
      const getEventSpy = vi
        .spyOn(window, 'event', 'get')
        .mockReturnValue(undefined);

      expect(adapter.getUpdatePriority()).toBe('user-visible');
      expect(getEventSpy).toHaveBeenCalledOnce();
    });
  });

  describe('requestCallback()', () => {
    it('schedules callbacks with "user-blocking" priority using Scheduler.postTask()', () => {
      vi.stubGlobal('scheduler', {
        postTask(callback) {
          return callback();
        },
      } as Partial<Scheduler>);

      const callback = vi.fn();
      const options = { priority: 'user-blocking' } as const;
      const postTaskSpy = vi.spyOn(window.scheduler, 'postTask');

      adapter.requestCallback(callback, options);

      expect(callback).toHaveBeenCalledOnce();
      expect(postTaskSpy).toHaveBeenCalledOnce();
      expect(postTaskSpy).toHaveBeenCalledWith(callback, options);
    });

    it('schedules callbacks with "user-blocking" priority using MessageChannel', async () => {
      vi.stubGlobal('scheduler', undefined);

      const callback = vi.fn();
      const setOnmessageSpy = vi.spyOn(
        MessagePort.prototype,
        'onmessage',
        'set',
      );
      const postMessageSpy = vi.spyOn(MessagePort.prototype, 'postMessage');

      adapter.requestCallback(callback, { priority: 'user-blocking' });

      await new Promise((resolve) => setTimeout(resolve));

      expect(callback).toHaveBeenCalledOnce();
      expect(setOnmessageSpy).toHaveBeenCalledOnce();
      expect(setOnmessageSpy).toHaveBeenCalledWith(expect.any(Function));
      expect(postMessageSpy).toHaveBeenCalledOnce();
      expect(postMessageSpy).toHaveBeenCalledWith(null);
    });

    it('schedules callbacks with "user-visible" priority using setTimeout()', async () => {
      vi.stubGlobal('scheduler', undefined);

      const callback = vi.fn();
      const setTimeoutSpy = vi.spyOn(window, 'setTimeout');

      await adapter.requestCallback(callback);
      await adapter.requestCallback(callback, {
        priority: 'user-visible',
      });

      expect(callback).toHaveBeenCalledTimes(2);
      expect(setTimeoutSpy).toHaveBeenCalledTimes(2);
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function));
    });

    it('schedules callbacks with "background" priority using setTimeout()', async () => {
      vi.stubGlobal('scheduler', undefined);
      vi.stubGlobal('requestIdleCallback', undefined);

      const callback = vi.fn();
      const setTimeoutSpy = vi.spyOn(window, 'setTimeout');

      await adapter.requestCallback(callback);
      await adapter.requestCallback(callback, {
        priority: 'background',
      });

      expect(callback).toHaveBeenCalledTimes(2);
      expect(setTimeoutSpy).toHaveBeenCalledTimes(2);
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 1);
    });

    it('schedules callbacks with "background" priority using requestIdleCallback()', async () => {
      vi.stubGlobal('scheduler', undefined);
      vi.stubGlobal('requestIdleCallback', ((callback) => {
        callback({} as IdleDeadline);
        return 0;
      }) as typeof requestIdleCallback);

      const callback = vi.fn();
      const requestIdleCallbackSpy = vi.spyOn(window, 'requestIdleCallback');

      await adapter.requestCallback(callback, {
        priority: 'background',
      });

      expect(callback).toHaveBeenCalledOnce();
      expect(requestIdleCallbackSpy).toHaveBeenCalledOnce();
      expect(requestIdleCallbackSpy).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('resolvePrimitive()', () => {
    it('returns DOMAttribute when the part is AttributePart', () => {
      expect(
        adapter.resolvePrimitive(
          'a',
          createAttributePart(document.createElement('div'), 'class'),
        ),
      ).toBe(DOMAttribute);
    });

    it.for([
      ':class',
      ':CLASS',
    ])('returns DOMClass when the part AttributePart and name is %s', (name) => {
      expect(
        adapter.resolvePrimitive(
          { a: true },
          createAttributePart(document.createElement('div'), name),
        ),
      ).toBe(DOMClass);
    });

    it.for([
      ':ref',
      ':REF',
    ])('returns DOMRef when the part AttributePart and name is %s', () => {
      expect(
        adapter.resolvePrimitive(
          { current: null },
          createAttributePart(document.createElement('div'), ':ref'),
        ),
      ).toBe(DOMRef);
    });

    it.for([
      ':style',
      ':STYLE',
    ])('returns DOMStyle when the part AttributePart and name is %s', () => {
      expect(
        adapter.resolvePrimitive(
          { current: null },
          createAttributePart(document.createElement('div'), ':style'),
        ),
      ).toBe(DOMStyle);
    });

    it.for([
      ':',
      ':invalid',
    ])('returns Blackhole when the part AttributePart and name starts with ":"', (name) => {
      expect(
        adapter.resolvePrimitive(
          { current: null },
          createAttributePart(document.createElement('div'), name),
        ),
      ).toBe(Blackhole);
    });

    it('returns DOMNode when the part is ChildNodePart', () => {
      expect(
        adapter.resolvePrimitive(
          'a',
          createChildNodePart(document.createComment(''), null),
        ),
      ).toBe(DOMNode);
    });

    it.each([
      [null],
      [undefined],
    ])('returns DOMNode when the part is ChildNodePart and the value is %s', (source) => {
      expect(
        adapter.resolvePrimitive(
          source,
          createChildNodePart(document.createComment(''), null),
        ),
      ).toBe(Blackhole);
    });

    it.each([
      [['a']],
      [Iterator.from(['a'])],
    ])('returns DOMRepeat when the part is ChildNodePart and the value is Iterable', (source) => {
      expect(
        adapter.resolvePrimitive(
          source,
          createChildNodePart(document.createComment(''), null),
        ),
      ).toBe(DOMRepeat);
    });

    it('returns DOMSpread when the part is ElementPart', () => {
      expect(
        adapter.resolvePrimitive(
          'a',
          createElementPart(document.createElement('div')),
        ),
      ).toBe(DOMSpread);
    });

    it('returns DOMEvent when the part is EventPart', () => {
      expect(
        adapter.resolvePrimitive(
          () => {},
          createEventPart(document.createElement('div'), 'click'),
        ),
      ).toBe(DOMEvent);
    });

    it('returns DOMLive when the part is LivePart', () => {
      expect(
        adapter.resolvePrimitive(
          'a',
          createLivePart(document.createElement('input'), 'value'),
        ),
      ).toBe(DOMLive);
    });

    it('returns DOMProperty when the part is PropertyPart', () => {
      expect(
        adapter.resolvePrimitive(
          'a',
          createPropertyPart(document.createElement('input'), 'value'),
        ),
      ).toBe(DOMProperty);
    });

    it('returns DOMNode when the part is TextPart', () => {
      expect(
        adapter.resolvePrimitive(
          'a',
          createTextPart(document.createTextNode('')),
        ),
      ).toBe(DOMNode);
    });
  });

  describe('resolveTemplate()', () => {
    it('parses strings as DOMTemplate', () => {
      const [strings, ...exprs] =
        templateLiteral`<div>${'Hello'}, ${'World'}!</div>`;
      const template = adapter.resolveTemplate(
        strings,
        exprs,
        'html',
        TEMPLATE_PLACEHOLDER,
      );

      expect(template.element.innerHTML).toBe('<div>, !</div>');
      expect(template.holes).toStrictEqual([
        {
          type: PART_TYPE_TEXT,
          index: 1,
          leadingSpan: 0,
          trailingSpan: 0,
        },
        {
          type: PART_TYPE_TEXT,
          index: 1,
          leadingSpan: 2,
          trailingSpan: 1,
        },
      ]);
    });
  });

  describe('startViewTransition()', () => {
    it.runIf(typeof document.startViewTransition === 'function')(
      'invokes the callback using document.startViewTransition()',
      async () => {
        const callback = vi.fn();
        const startViewTransitionSpy = vi.spyOn(
          document,
          'startViewTransition',
        );

        await adapter.startViewTransition(callback);

        expect(startViewTransitionSpy).toHaveBeenCalledOnce();
        expect(startViewTransitionSpy).toHaveBeenCalledWith(callback);
        expect(callback).toHaveBeenCalledOnce();
      },
    );

    it('invokes the callback as a microtask', async () => {
      const callback = vi.fn();

      vi.spyOn(
        document as { startViewTransition: unknown },
        'startViewTransition',
        'get',
      ).mockReturnValue(undefined);

      await adapter.startViewTransition(callback);

      expect(callback).toHaveBeenCalledOnce();
    });
  });

  describe('yieldToMain()', () => {
    it.runIf(typeof window.scheduler?.yield === 'function')(
      'calls scheduler.yield()',
      async () => {
        const yieldSpy = vi.spyOn(window.scheduler, 'yield');

        expect(await adapter.yieldToMain()).toBe(undefined);
        expect(yieldSpy).toHaveBeenCalledOnce();
      },
    );

    it('waits until timeout of 0 seconds', async () => {
      vi.stubGlobal('scheduler', undefined);

      const setTimeoutSpy = vi.spyOn(window, 'setTimeout');

      expect(await adapter.yieldToMain()).toBe(undefined);

      expect(setTimeoutSpy).toHaveBeenCalledOnce();
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function));
    });
  });
});
