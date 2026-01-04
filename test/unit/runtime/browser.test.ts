import { afterEach, describe, expect, it, vi } from 'vitest';

import { CommitPhase, type Effect, PartType } from '@/internal.js';
import { LooseLayout } from '@/layout/loose.js';
import { StrictLayout } from '@/layout/strict.js';
import { AttributePrimitive } from '@/primitive/attribute.js';
import { BlackholePrimitive } from '@/primitive/blackhole.js';
import { ClassPrimitive } from '@/primitive/class.js';
import { CommentPrimitive } from '@/primitive/comment.js';
import { EventPrimitive } from '@/primitive/event.js';
import { LivePrimitive } from '@/primitive/live.js';
import { PropertyPrimitive } from '@/primitive/property.js';
import { RefPrimitive } from '@/primitive/ref.js';
import { SpreadPrimitive } from '@/primitive/spread.js';
import { StylePrimitive } from '@/primitive/style.js';
import { TextPrimitive } from '@/primitive/text.js';
import { BrowserBackend } from '@/runtime/browser.js';
import { Runtime } from '@/runtime.js';
import { TaggedTemplate } from '@/template/tagged.js';
import { HTML_NAMESPACE_URI } from '@/template/template.js';
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
  describe('commitEffects()', () => {
    it('commits all effects in reverse order', () => {
      const executedEffects: Effect[] = [];
      const commit = function (this: Effect) {
        executedEffects.push(this);
      };
      const mutationEffects: Effect[] = [
        {
          commit,
        },
        {
          commit,
        },
      ];
      const layoutEffects: Effect[] = [
        {
          commit,
        },
        {
          commit,
        },
      ];
      const passiveEffects: Effect[] = [
        {
          commit,
        },
        {
          commit,
        },
      ];
      const backend = new BrowserBackend();

      backend.commitEffects(mutationEffects, CommitPhase.Mutation);
      backend.commitEffects(layoutEffects, CommitPhase.Layout);
      backend.commitEffects(passiveEffects, CommitPhase.Passive);

      expect(executedEffects).toStrictEqual(
        mutationEffects
          .toReversed()
          .concat(layoutEffects.toReversed())
          .concat(passiveEffects.toReversed())
          .map((effect) => expect.exact(effect)),
      );
    });
  });

  describe('getTaskPriority()', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it.for(
      CONTINUOUS_EVENT_TYPES,
    )('returns "user-visible" if the current event is "%s"', (eventType) => {
      const backend = new BrowserBackend();
      const getEventSpy = vi
        .spyOn(window, 'event', 'get')
        .mockReturnValue(new CustomEvent(eventType));

      expect(backend.getTaskPriority()).toBe('user-visible');
      expect(getEventSpy).toHaveBeenCalled();
    });

    it('returns "user-blocking" if the current event is not continuous', () => {
      const backend = new BrowserBackend();
      const getEventSpy = vi
        .spyOn(window, 'event', 'get')
        .mockReturnValue(new MouseEvent('click'));

      expect(backend.getTaskPriority()).toBe('user-blocking');
      expect(getEventSpy).toHaveBeenCalled();
    });

    it('returns "background" if the document loading state is "complete"', () => {
      const backend = new BrowserBackend();

      const getEventSpy = vi
        .spyOn(window, 'event', 'get')
        .mockReturnValue(undefined);
      const getDocumentReadyState = vi
        .spyOn(document, 'readyState', 'get')
        .mockReturnValue('complete');

      expect(backend.getTaskPriority()).toBe('background');
      expect(getEventSpy).toHaveBeenCalledOnce();
      expect(getDocumentReadyState).toHaveBeenCalledOnce();
    });

    it('otherwise returns "user-blocking"', () => {
      const backend = new BrowserBackend();

      const getEventSpy = vi
        .spyOn(window, 'event', 'get')
        .mockReturnValue(undefined);
      const getDocumentReadyState = vi
        .spyOn(document, 'readyState', 'get')
        .mockReturnValue('interactive');

      expect(backend.getTaskPriority()).toBe('user-blocking');
      expect(getEventSpy).toHaveBeenCalledOnce();
      expect(getDocumentReadyState).toHaveBeenCalledOnce();
    });
  });

  describe('parseTemplate()', () => {
    it('creates a TaggedTemplate', () => {
      const [strings, ...values] =
        templateLiteral`<div>${'Hello'}, ${'World'}!</div>`;
      const backend = new BrowserBackend();
      const template = backend.parseTemplate(
        strings,
        values,
        TEMPLATE_PLACEHOLDER,
        'html',
      );

      expect(template).toBeInstanceOf(TaggedTemplate);
      expect((template as TaggedTemplate)['_template'].innerHTML).toBe(
        '<div></div>',
      );
      expect((template as TaggedTemplate)['_holes']).toStrictEqual([
        {
          type: PartType.Text,
          index: 1,
          precedingText: '',
          followingText: '',
        },
        {
          type: PartType.Text,
          index: 2,
          precedingText: ', ',
          followingText: '!',
        },
      ]);
    });
  });

  describe('flushUpdate()', () => {
    it('flush updates asynchronously', async () => {
      const backend = new BrowserBackend();
      const runtime = new Runtime(backend);

      const flushAsyncSpy = vi.spyOn(runtime, 'flushAsync');

      backend.flushUpdate(runtime);

      expect(flushAsyncSpy).toHaveBeenCalledOnce();
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
    it.each([
      [
        'foo',
        {
          type: PartType.Attribute,
          node: document.createElement('div'),
          name: 'class',
        },
        AttributePrimitive,
      ],
      [
        null,
        {
          type: PartType.ChildNode,
          node: document.createComment(''),
          anchorNode: null,
          namespaceURI: HTML_NAMESPACE_URI,
        },
        BlackholePrimitive,
      ],
      [
        undefined,
        {
          type: PartType.ChildNode,
          node: document.createComment(''),
          anchorNode: null,
          namespaceURI: HTML_NAMESPACE_URI,
        },
        BlackholePrimitive,
      ],
      [
        'foo',
        {
          type: PartType.ChildNode,
          node: document.createComment(''),
          anchorNode: null,
          namespaceURI: HTML_NAMESPACE_URI,
        },
        CommentPrimitive,
      ],
      [
        () => {},
        {
          type: PartType.Element,
          node: document.createElement('div'),
        },
        SpreadPrimitive,
      ],
      [
        'foo',
        {
          type: PartType.Event,
          node: document.createElement('div'),
          name: 'click',
        },
        EventPrimitive,
      ],
      [
        'foo',
        {
          type: PartType.Live,
          node: document.createElement('textarea'),
          name: 'value',
          defaultValue: '',
        },
        LivePrimitive,
      ],
      [
        'foo',
        {
          type: PartType.Property,
          node: document.createElement('textarea'),
          name: 'value',
          defaultValue: '',
        },
        PropertyPrimitive,
      ],
      [
        'foo',
        {
          type: PartType.Text,
          node: document.createTextNode(''),
          precedingText: '',
          followingText: '',
        },
        TextPrimitive,
      ],
    ] as const)('resolves the Primitive from an arbitrary part', (value, part, expectedPrimitive) => {
      const backend = new BrowserBackend();

      expect(backend.resolvePrimitive(value, part)).toStrictEqual(
        expectedPrimitive,
      );
    });

    it.each([
      [
        [],
        {
          type: PartType.Attribute,
          node: document.createElement('div'),
          name: ':class',
        },
        ClassPrimitive,
      ],
      [
        { current: null },
        {
          type: PartType.Attribute,
          node: document.createElement('div'),
          name: ':ref',
        },
        RefPrimitive,
      ],
      [
        {},
        {
          type: PartType.Attribute,
          node: document.createElement('div'),
          name: ':style',
        },
        StylePrimitive,
      ],
      [
        null,
        {
          type: PartType.Attribute,
          node: document.createElement('div'),
          name: ':',
        },
        BlackholePrimitive,
      ],
    ] as const)('resolves the Primitive from special attribute parts', (value, part, expectedPrimitive) => {
      const backend = new BrowserBackend();

      expect(backend.resolvePrimitive(value, part)).toBe(expectedPrimitive);
      expect(
        backend.resolvePrimitive(value, {
          ...part,
          name: part.name.toUpperCase(),
        }),
      ).toBe(expectedPrimitive);
    });
  });

  describe('resolveLayout()', () => {
    it.each([
      [
        'foo',
        {
          type: PartType.Attribute,
          node: document.createElement('div'),
          name: 'class',
        },
        StrictLayout,
      ],
      [
        'foo',
        {
          type: PartType.ChildNode,
          node: document.createComment(''),
          anchorNode: null,
          namespaceURI: HTML_NAMESPACE_URI,
        },
        LooseLayout,
      ],
      [
        'foo',
        {
          type: PartType.Element,
          node: document.createElement('div'),
        },
        StrictLayout,
      ],
      [
        'foo',
        {
          type: PartType.Event,
          node: document.createElement('div'),
          name: 'click',
        },
        StrictLayout,
      ],
      [
        'foo',
        {
          type: PartType.Live,
          node: document.createElement('textarea'),
          name: 'value',
          defaultValue: '',
        },
        StrictLayout,
      ],
      [
        'foo',
        {
          type: PartType.Property,
          node: document.createElement('textarea'),
          name: 'value',
          defaultValue: '',
        },
        StrictLayout,
      ],
      [
        'foo',
        {
          type: PartType.Text,
          node: document.createTextNode(''),
          precedingText: '',
          followingText: '',
        },
        StrictLayout,
      ],
    ] as const)('resolves the Layout from an arbitrary part', (value, part, expectedLayout) => {
      const backend = new BrowserBackend();

      expect(backend.resolveLayout(value, part)).toBe(expectedLayout);
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
