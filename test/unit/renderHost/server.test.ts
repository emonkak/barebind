import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Effect } from '@/directive.js';
import { CommitPhase } from '@/hook.js';
import { PartType } from '@/part.js';
import { AttributePrimitive } from '@/primitive/attribute.js';
import { BlackholePrimitive } from '@/primitive/blackhole.js';
import { ClassListPrimitive } from '@/primitive/classList.js';
import { LivePrimitive } from '@/primitive/live.js';
import { NodePrimitive } from '@/primitive/node.js';
import { PropertyPrimitive } from '@/primitive/property.js';
import { SpreadPrimitive } from '@/primitive/spread.js';
import { StylePrimitive } from '@/primitive/style.js';
import { TextPrimitive } from '@/primitive/text.js';
import { ServerRenderHost } from '@/renderHost/server.js';
import { LooseSlot } from '@/slot/loose.js';
import { StrictSlot } from '@/slot/strict.js';
import { ChildNodeTemplate } from '@/template/childNodeTemplate.js';
import { EmptyTemplate } from '@/template/emptyTemplate.js';
import { TaggedTemplate } from '@/template/taggedTemplate.js';
import { TextTemplate } from '@/template/textTemplate.js';
import { UpdateEngine } from '@/updateEngine.js';

const TEMPLATE_PLACEHOLDER = '__test__';

describe('ServerRenderHost', () => {
  describe('commitEffects()', () => {
    it('commits only mutation effects', () => {
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
      const renderHost = new ServerRenderHost(document);
      const context = new UpdateEngine(renderHost);

      renderHost.commitEffects(mutationEffects, CommitPhase.Mutation, context);
      renderHost.commitEffects(layoutEffects, CommitPhase.Layout, context);
      renderHost.commitEffects(passiveEffects, CommitPhase.Layout, context);

      expect(mutationEffects[0].commit).toHaveBeenCalledOnce();
      expect(mutationEffects[0].commit).toHaveBeenCalledWith(context);
      expect(layoutEffects[0].commit).not.toHaveBeenCalled();
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
      expect((template as TaggedTemplate)['_template'].innerHTML).toBe(
        '<div></div>',
      );
      expect((template as TaggedTemplate)['_holes']).toStrictEqual([
        {
          type: PartType.Text,
          index: 1,
          precedingText: '',
          followingText: '',
          split: true,
        },
        {
          type: PartType.Text,
          index: 2,
          precedingText: ', ',
          followingText: '!',
          split: false,
        },
      ]);
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
