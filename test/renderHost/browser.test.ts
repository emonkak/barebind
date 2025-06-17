import { afterEach, describe, expect, it, vi } from 'vitest';
import { CommitPhase } from '../../src/hook.js';
import { PartType } from '../../src/part.js';
import { AttributePrimitive } from '../../src/primitive/attribute.js';
import { BlackholePrimitive } from '../../src/primitive/blackhole.js';
import { ClassListPrimitive } from '../../src/primitive/classList.js';
import { ClassMapPrimitive } from '../../src/primitive/classMap.js';
import { EventPrimitive } from '../../src/primitive/event.js';
import { LivePrimitive } from '../../src/primitive/live.js';
import { NodePrimitive } from '../../src/primitive/node.js';
import { PropertyPrimitive } from '../../src/primitive/property.js';
import { RefPrimitive } from '../../src/primitive/ref.js';
import { SpreadPrimitive } from '../../src/primitive/spread.js';
import { StylePrimitive } from '../../src/primitive/style.js';
import { BrowserRenderHost } from '../../src/renderHost/browser.js';
import { LooseSlot } from '../../src/slot/loose.js';
import { StrictSlot } from '../../src/slot/strict.js';
import { ChildNodeTemplate } from '../../src/template/childNodeTemplate.js';
import { EmptyTemplate } from '../../src/template/emptyTemplate.js';
import { TaggedTemplate } from '../../src/template/taggedTemplate.js';
import { TextTemplate } from '../../src/template/textTemplate.js';

const TEMPLATE_PLACEHOLDER = '__test__';

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

describe('BrowserRenderHost', () => {
  describe('commitEffects()', () => {
    it.each([
      [CommitPhase.Mutation],
      [CommitPhase.Layout],
      [CommitPhase.Passive],
    ] as const)('commits given effects', (phase) => {
      const renderHost = new BrowserRenderHost();
      const effects = [
        {
          commit: vi.fn(),
        },
        {
          commit: vi.fn(),
        },
        {
          commit: vi.fn(),
        },
      ];

      renderHost.commitEffects(effects, phase);

      for (const effect of effects) {
        expect(effect.commit).toHaveBeenCalledOnce();
      }
    });
  });

  describe('createTemplate()', () => {
    it('creates a TaggedTemplate', () => {
      const renderHost = new BrowserRenderHost();
      const { strings, values } = tmpl`<div>${'Hello'}, ${'World'}!</div>`;
      const template = renderHost.createTemplate(
        strings,
        values,
        TEMPLATE_PLACEHOLDER,
        'html',
      );

      expect(template).toBeInstanceOf(TaggedTemplate);
      expect((template as TaggedTemplate)['_holes']).toStrictEqual([
        { type: PartType.Text, index: 1 },
        { type: PartType.Text, index: 3 },
      ]);
      expect((template as TaggedTemplate)['_element'].innerHTML).toBe(
        '<div>, !</div>',
      );
    });

    it.each([[tmpl``], [tmpl` `]])(
      'creates an EmptyTemplate if there is no contents',
      ({ strings, values }) => {
        const renderHost = new BrowserRenderHost();
        const template = renderHost.createTemplate(
          strings,
          values,
          TEMPLATE_PLACEHOLDER,
          'html',
        );

        expect(template).toBe(EmptyTemplate);
      },
    );

    it.each([
      [tmpl`<${'foo'}>`],
      [tmpl`<${'foo'}/>`],
      [tmpl` <${'foo'} /> `],
      [tmpl` <!--${'foo'}--> `],
      [tmpl` <!-- ${'foo'} --> `],
    ])(
      'creates a ChildNodeTemplate if there is a only child value',
      ({ strings, values }) => {
        const renderHost = new BrowserRenderHost();
        const template = renderHost.createTemplate(
          strings,
          values,
          TEMPLATE_PLACEHOLDER,
          'html',
        );

        expect(template).toBe(ChildNodeTemplate);
      },
    );

    it.each([[tmpl`${'foo'}`], [tmpl` ${'foo'} `]])(
      'should create a TextTemplate if there is a only text value',
      ({ strings, values }) => {
        const renderHost = new BrowserRenderHost();
        const template = renderHost.createTemplate(
          strings,
          values,
          TEMPLATE_PLACEHOLDER,
          'html',
        );

        expect(template).toBe(TextTemplate);
      },
    );
  });

  describe('getCurrentTaskPriority()', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('returns "user-blocking" if the current event is not continuous', () => {
      const renderHost = new BrowserRenderHost();
      const getEventSpy = vi
        .spyOn(globalThis, 'event', 'get')
        .mockReturnValue(new MouseEvent('click'));

      expect(renderHost.getCurrentTaskPriority()).toBe('user-blocking');
      expect(getEventSpy).toHaveBeenCalled();
    });

    it.each(CONTINUOUS_EVENT_TYPES)(
      'returns "user-visible" if the current event is continuous',
      (eventType) => {
        const renderHost = new BrowserRenderHost();
        const getEventSpy = vi
          .spyOn(globalThis, 'event', 'get')
          .mockReturnValue(new CustomEvent(eventType));

        expect(renderHost.getCurrentTaskPriority()).toBe('user-visible');
        expect(getEventSpy).toHaveBeenCalled();
      },
    );

    it('returns "background" if there is no current event', () => {
      const renderHost = new BrowserRenderHost();

      const getEventSpy = vi
        .spyOn(globalThis, 'event', 'get')
        .mockReturnValue(undefined);

      expect(renderHost.getCurrentTaskPriority()).toBe('background');
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

      const renderHost = new BrowserRenderHost();
      const callback = vi.fn();
      const options = { priority: 'user-blocking' } as const;
      const postTaskSpy = vi.spyOn(globalThis.scheduler, 'postTask');

      renderHost.requestCallback(callback, options);

      expect(callback).toHaveBeenCalledOnce();
      expect(callback).toHaveBeenCalledWith();
      expect(postTaskSpy).toHaveBeenCalledOnce();
      expect(postTaskSpy).toHaveBeenCalledWith(callback, options);
    });

    it('should schedule a callback with "user-blocking" priority using MessageChannel', async () => {
      vi.stubGlobal('scheduler', undefined);

      const renderHost = new BrowserRenderHost();
      const callback = vi.fn();
      const setOnmessageSpy = vi.spyOn(
        MessagePort.prototype,
        'onmessage',
        'set',
      );
      const postMessageSpy = vi.spyOn(MessagePort.prototype, 'postMessage');

      renderHost.requestCallback(callback, { priority: 'user-blocking' });

      await new Promise((resolve) => setTimeout(resolve));

      expect(callback).toHaveBeenCalledOnce();
      expect(callback).toHaveBeenCalledWith();
      expect(setOnmessageSpy).toHaveBeenCalledOnce();
      expect(setOnmessageSpy).toHaveBeenCalledWith(expect.any(Function));
      expect(postMessageSpy).toHaveBeenCalledOnce();
      expect(postMessageSpy).toHaveBeenCalledWith(null);
    });

    it('schedules a callback with "user-visible" priority using setTimeout()', async () => {
      vi.stubGlobal('scheduler', undefined);

      const renderHost = new BrowserRenderHost();
      const callback = vi.fn();
      const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

      await renderHost.requestCallback(callback);
      await renderHost.requestCallback(callback, { priority: 'user-visible' });

      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenCalledWith();
      expect(setTimeoutSpy).toHaveBeenCalledTimes(2);
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function));
    });

    it('schedules a callback with "background" priority using setTimeout()', async () => {
      vi.stubGlobal('scheduler', undefined);
      vi.stubGlobal('requestIdleCallback', undefined);

      const renderHost = new BrowserRenderHost();
      const callback = vi.fn();
      const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

      await renderHost.requestCallback(callback);
      await renderHost.requestCallback(callback, { priority: 'background' });

      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenCalledWith();
      expect(setTimeoutSpy).toHaveBeenCalledTimes(2);
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should schedule a callback with "background" priority using requestIdleCallback()', async () => {
      vi.stubGlobal('scheduler', undefined);
      vi.stubGlobal('requestIdleCallback', ((callback) => {
        callback({} as IdleDeadline);
        return 0;
      }) as typeof requestIdleCallback);

      const renderHost = new BrowserRenderHost();
      const callback = vi.fn();
      const requestIdleCallbackSpy = vi.spyOn(
        globalThis,
        'requestIdleCallback',
      );

      await renderHost.requestCallback(callback, { priority: 'background' });

      expect(callback).toHaveBeenCalledOnce();
      expect(callback).toHaveBeenCalledWith();
      expect(requestIdleCallbackSpy).toHaveBeenCalledOnce();
      expect(requestIdleCallbackSpy).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('resolvePrimitive()', () => {
    it.each([
      [
        {
          type: PartType.Attribute,
          node: document.createElement('div'),
          name: 'class',
        },
        AttributePrimitive,
      ],
      [
        {
          type: PartType.ChildNode,
          node: document.createComment(''),
          childNode: null,
        },
        NodePrimitive,
      ],
      [
        {
          type: PartType.Text,
          node: document.createTextNode(''),
        },
        NodePrimitive,
      ],
      [
        {
          type: PartType.Element,
          node: document.createElement('div'),
        },
        SpreadPrimitive,
      ],
      [
        {
          type: PartType.Event,
          node: document.createElement('div'),
          name: 'click',
        },
        EventPrimitive,
      ],
      [
        {
          type: PartType.Live,
          node: document.createElement('textarea'),
          name: 'value',
          defaultValue: '',
        },
        LivePrimitive,
      ],
      [
        {
          type: PartType.Property,
          node: document.createElement('textarea'),
          name: 'value',
          defaultValue: '',
        },
        PropertyPrimitive,
      ],
    ] as const)(
      'resolves the Primitive from an arbitrary part',
      (part, expectedPrimitive) => {
        const renderHost = new BrowserRenderHost();

        expect(renderHost.resolvePrimitive(part)).toBe(expectedPrimitive);
      },
    );

    it.each([
      [
        {
          type: PartType.Attribute,
          node: document.createElement('div'),
          name: ':classlist',
        },
        ClassListPrimitive,
      ],
      [
        {
          type: PartType.Attribute,
          node: document.createElement('div'),
          name: ':classmap',
        },
        ClassMapPrimitive,
      ],
      [
        {
          type: PartType.Attribute,
          node: document.createElement('div'),
          name: ':ref',
        },
        RefPrimitive,
      ],
      [
        {
          type: PartType.Attribute,
          node: document.createElement('div'),
          name: ':style',
        },
        StylePrimitive,
      ],
      [
        {
          type: PartType.Attribute,
          node: document.createElement('div'),
          name: ':',
        },
        BlackholePrimitive,
      ],
    ] as const)(
      'resolves the Primitive from special attribute parts',
      (part, expectedPrimitive) => {
        const renderHost = new BrowserRenderHost();

        expect(renderHost.resolvePrimitive(part)).toBe(expectedPrimitive);
        expect(
          renderHost.resolvePrimitive({
            ...part,
            name: part.name.toUpperCase(),
          }),
        ).toBe(expectedPrimitive);
      },
    );
  });

  describe('resolveSlotType()', () => {
    it.each([
      [
        {
          type: PartType.Attribute,
          node: document.createElement('div'),
          name: 'class',
        },
        StrictSlot,
      ],
      [
        {
          type: PartType.ChildNode,
          node: document.createComment(''),
          childNode: null,
        },
        LooseSlot,
      ],
      [
        {
          type: PartType.Text,
          node: document.createTextNode(''),
        },
        StrictSlot,
      ],
      [
        {
          type: PartType.Element,
          node: document.createElement('div'),
        },
        StrictSlot,
      ],
      [
        {
          type: PartType.Event,
          node: document.createElement('div'),
          name: 'click',
        },
        StrictSlot,
      ],
      [
        {
          type: PartType.Live,
          node: document.createElement('textarea'),
          name: 'value',
          defaultValue: '',
        },
        StrictSlot,
      ],
      [
        {
          type: PartType.Property,
          node: document.createElement('textarea'),
          name: 'value',
          defaultValue: '',
        },
        StrictSlot,
      ],
    ] as const)(
      'resolves the SlotType from an arbitrary part',
      (part, expectedSlotType) => {
        const renderHost = new BrowserRenderHost();

        expect(renderHost.resolveSlotType(part)).toBe(expectedSlotType);
      },
    );
  });

  describe('startViewTransition()', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it.runIf(typeof document.startViewTransition === 'function')(
      'invokes the callback using document.startViewTransition()',
      async () => {
        const renderHost = new BrowserRenderHost();
        const callback = vi.fn();
        const startViewTransitionSpy = vi.spyOn(
          document,
          'startViewTransition',
        );

        await renderHost.startViewTransition(callback);

        expect(startViewTransitionSpy).toHaveBeenCalledOnce();
        expect(startViewTransitionSpy).toHaveBeenCalledWith(callback);
        expect(callback).toHaveBeenCalledOnce();
      },
    );

    it('invokes the callback as a microtask', async () => {
      const renderHost = new BrowserRenderHost();
      const callback = vi.fn();

      vi.spyOn(
        document as { startViewTransition: unknown },
        'startViewTransition',
        'get',
      ).mockReturnValue(undefined);

      await renderHost.startViewTransition(callback);

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

      const renderHost = new BrowserRenderHost();
      const yieldSpy = vi.spyOn(globalThis.scheduler, 'yield');

      expect(await renderHost.yieldToMain()).toBe(undefined);
      expect(yieldSpy).toHaveBeenCalledOnce();
    });

    it('waits until the timer to be executed', async () => {
      vi.stubGlobal('scheduler', undefined);

      const renderHost = new BrowserRenderHost();
      const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

      expect(await renderHost.yieldToMain()).toBe(undefined);
      expect(setTimeoutSpy).toHaveBeenCalledOnce();
    });
  });
});

function tmpl<TValues extends readonly unknown[]>(
  strings: TemplateStringsArray,
  ...values: TValues
): { strings: TemplateStringsArray; values: TValues } {
  return { strings, values };
}
