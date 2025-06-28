import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Effect } from '../../src/directive.js';
import { CommitPhase } from '../../src/hook.js';
import { PartType } from '../../src/part.js';
import { AttributePrimitive } from '../../src/primitive/attribute.js';
import { BlackholePrimitive } from '../../src/primitive/blackhole.js';
import { ClassListPrimitive } from '../../src/primitive/classList.js';
import { ClassMapPrimitive } from '../../src/primitive/classMap.js';
import { LivePrimitive } from '../../src/primitive/live.js';
import { NodePrimitive } from '../../src/primitive/node.js';
import { PropertyPrimitive } from '../../src/primitive/property.js';
import { SpreadPrimitive } from '../../src/primitive/spread.js';
import { StylePrimitive } from '../../src/primitive/style.js';
import { TextPrimitive } from '../../src/primitive/text.js';
import { ServerRenderHost } from '../../src/renderHost/server.js';
import { LooseSlot } from '../../src/slot/loose.js';
import { StrictSlot } from '../../src/slot/strict.js';
import { ChildNodeTemplate } from '../../src/template/childNodeTemplate.js';
import { EmptyTemplate } from '../../src/template/emptyTemplate.js';
import { TaggedTemplate } from '../../src/template/taggedTemplate.js';
import { TextTemplate } from '../../src/template/textTemplate.js';

const TEMPLATE_PLACEHOLDER = '__test__';

describe('ServerRenderHost', () => {
  describe('commitEffects()', () => {
    it('commits only mutation effects', () => {
      const renderHost = new ServerRenderHost(document);
      const mutationEffects: [Effect] = [
        {
          commit: vi.fn(),
        },
      ];
      const layoutEffects: [Effect] = [
        {
          commit: vi.fn(),
        },
      ];
      const passiveEffects: [Effect] = [
        {
          commit: vi.fn(),
        },
      ];

      renderHost.commitEffects(mutationEffects, CommitPhase.Mutation);
      renderHost.commitEffects(layoutEffects, CommitPhase.Layout);
      renderHost.commitEffects(passiveEffects, CommitPhase.Layout);

      expect(mutationEffects[0].commit).toHaveBeenCalledOnce();
      expect(layoutEffects[0].commit).not.toHaveBeenCalled();
      expect(passiveEffects[0].commit).not.toHaveBeenCalled();
    });
  });

  describe('createTemplate()', () => {
    it('creates a TaggedTemplate', () => {
      const renderHost = new ServerRenderHost(document);
      const { strings, values } = tmpl`<div>${'Hello'}, ${'World'}!</div>`;
      const template = renderHost.createTemplate(
        strings,
        values,
        TEMPLATE_PLACEHOLDER,
        'html',
      );

      expect(template).toBeInstanceOf(TaggedTemplate);
      expect((template as TaggedTemplate)['_holes']).toStrictEqual([
        {
          type: PartType.Text,
          index: 1,
          precedingText: '',
          followingText: '',
          tail: false,
        },
        {
          type: PartType.Text,
          index: 2,
          precedingText: ', ',
          followingText: '!',
          tail: true,
        },
      ]);
      expect((template as TaggedTemplate)['_element'].innerHTML).toBe(
        '<div></div>',
      );
    });

    it.each([[tmpl``], [tmpl` `]])(
      'creates an EmptyTemplate if there is no contents',
      ({ strings, values }) => {
        const renderHost = new ServerRenderHost(document);
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
        const renderHost = new ServerRenderHost(document);
        const template = renderHost.createTemplate(
          strings,
          values,
          TEMPLATE_PLACEHOLDER,
          'html',
        );

        expect(template).toBe(ChildNodeTemplate);
      },
    );

    it.each([[tmpl`${'foo'}`], [tmpl` ${'foo'} `], [tmpl`(${'foo'})`]])(
      'should create a TextTemplate if there is a only text value',
      ({ strings, values }) => {
        const renderHost = new ServerRenderHost(document);
        const template = renderHost.createTemplate(
          strings,
          values,
          TEMPLATE_PLACEHOLDER,
          'html',
        ) as TextTemplate;

        expect(template).toBeInstanceOf(TextTemplate);
        expect(template['_precedingText']).toBe(strings[0]?.trim());
        expect(template['_followingText']).toBe(strings[1]?.trim());
      },
    );
  });

  describe('getCurrentTaskPriority()', () => {
    it('always returns "user-blocking"', () => {
      const renderHost = new ServerRenderHost(document);
      expect(renderHost.getCurrentTaskPriority()).toBe('user-blocking');
    });
  });

  describe('requestCallback()', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('schedules a callback using setTimeout()', async () => {
      const renderHost = new ServerRenderHost(document);
      const callback = vi.fn();
      const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

      await renderHost.requestCallback(callback);

      expect(callback).toHaveBeenCalledOnce();
      expect(callback).toHaveBeenCalledWith();
      expect(setTimeoutSpy).toHaveBeenCalledOnce();
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function));
    });

    it.each([['user-blocking'], ['user-visible'], ['background']] as const)(
      'schedules a callback with an arbitrary priority using setTimeout()',
      async (priority) => {
        const renderHost = new ServerRenderHost(document);
        const callback = vi.fn();
        const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

        await renderHost.requestCallback(callback, { priority });

        expect(callback).toHaveBeenCalledOnce();
        expect(callback).toHaveBeenCalledWith();
        expect(setTimeoutSpy).toHaveBeenCalledOnce();
        expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function));
      },
    );
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
        BlackholePrimitive,
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
      [
        {
          type: PartType.Text,
          node: document.createTextNode(''),
          precedingText: '',
          followingText: '',
        },
        TextPrimitive,
      ],
    ] as const)(
      'resolves the Primitive from an arbitrary part',
      (part, expectedPrimitive) => {
        const renderHost = new ServerRenderHost(document);

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
        BlackholePrimitive,
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
        const renderHost = new ServerRenderHost(document);

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
      [
        {
          type: PartType.Text,
          node: document.createTextNode(''),
          precedingText: '',
          followingText: '',
        },
        StrictSlot,
      ],
    ] as const)(
      'resolves the SlotType from an arbitrary part',
      (part, expectedSlotType) => {
        const renderHost = new ServerRenderHost(document);

        expect(renderHost.resolveSlotType(part)).toBe(expectedSlotType);
      },
    );
  });

  describe('startViewTransition()', () => {
    it('invokes the callback as a microtask', async () => {
      const renderHost = new ServerRenderHost(document);
      const callback = vi.fn();

      await renderHost.startViewTransition(callback);

      expect(callback).toHaveBeenCalledOnce();
    });
  });

  describe('yieldToMain()', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('waits until the timer to be executed', async () => {
      const renderHost = new ServerRenderHost(document);
      const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

      await renderHost.yieldToMain();

      expect(setTimeoutSpy).toHaveBeenCalledOnce();
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function));
    });
  });
});

function tmpl<TValues extends readonly unknown[]>(
  strings: TemplateStringsArray,
  ...values: TValues
): { strings: TemplateStringsArray; values: TValues } {
  return { strings, values };
}
