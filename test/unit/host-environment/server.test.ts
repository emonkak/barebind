import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Effect } from '@/directive.js';
import { ServerHostEnvironment } from '@/host-environment/server.js';
import { CommitPhase } from '@/host-environment.js';
import { PartType } from '@/part.js';
import { AttributePrimitive } from '@/primitive/attribute.js';
import { BlackholePrimitive } from '@/primitive/blackhole.js';
import { ClassListPrimitive } from '@/primitive/class-list.js';
import { LivePrimitive } from '@/primitive/live.js';
import { NodePrimitive } from '@/primitive/node.js';
import { PropertyPrimitive } from '@/primitive/property.js';
import { SpreadPrimitive } from '@/primitive/spread.js';
import { StylePrimitive } from '@/primitive/style.js';
import { TextPrimitive } from '@/primitive/text.js';
import { LooseSlot } from '@/slot/loose.js';
import { StrictSlot } from '@/slot/strict.js';
import { ChildNodeTemplate } from '@/template/child-node.js';
import { EmptyTemplate } from '@/template/empty.js';
import { TaggedTemplate } from '@/template/tagged.js';
import { HTML_NAMESPACE_URI } from '@/template/template.js';
import { TextTemplate } from '@/template/text.js';
import { MockCommitContext } from '../../mocks.js';
import { templateLiteral } from '../../test-utils.js';

const TEMPLATE_PLACEHOLDER = '__test__';

describe('ServerHostEnvironment', () => {
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
      const hostEnvironment = new ServerHostEnvironment(document);
      const context = new MockCommitContext();

      hostEnvironment.commitEffects(
        mutationEffects,
        CommitPhase.Mutation,
        context,
      );
      hostEnvironment.commitEffects(layoutEffects, CommitPhase.Layout, context);
      hostEnvironment.commitEffects(
        passiveEffects,
        CommitPhase.Layout,
        context,
      );

      expect(mutationEffects[0].commit).toHaveBeenCalledOnce();
      expect(mutationEffects[0].commit).toHaveBeenCalledWith(context);
      expect(layoutEffects[0].commit).not.toHaveBeenCalled();
      expect(layoutEffects[0].commit).not.toHaveBeenCalled();
      expect(passiveEffects[0].commit).not.toHaveBeenCalled();
    });
  });

  describe('createTemplate()', () => {
    it('creates a TaggedTemplate', () => {
      const hostEnvironment = new ServerHostEnvironment(document);
      const { strings, values } =
        templateLiteral`<div>${'Hello'}, ${'World'}!</div>`;
      const template = hostEnvironment.createTemplate(
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

    it.each([[templateLiteral``], [templateLiteral` `]])(
      'creates an EmptyTemplate if there is no contents',
      ({ strings, values }) => {
        const hostEnvironment = new ServerHostEnvironment(document);
        const template = hostEnvironment.createTemplate(
          strings,
          values,
          TEMPLATE_PLACEHOLDER,
          'html',
        );

        expect(template).toBeInstanceOf(EmptyTemplate);
      },
    );

    it.each([
      [templateLiteral`<${'foo'}>`],
      [templateLiteral`<${'foo'}/>`],
      [templateLiteral` <${'foo'} /> `],
      [templateLiteral` <!--${'foo'}--> `],
      [templateLiteral` <!-- ${'foo'} --> `],
    ])(
      'creates a ChildNodeTemplate if there is a only child value',
      ({ strings, values }) => {
        const hostEnvironment = new ServerHostEnvironment(document);
        const template = hostEnvironment.createTemplate(
          strings,
          values,
          TEMPLATE_PLACEHOLDER,
          'html',
        );

        expect(template).toBeInstanceOf(ChildNodeTemplate);
      },
    );

    it.each([
      [templateLiteral`${'foo'}`],
      [templateLiteral` ${'foo'} `],
      [templateLiteral`(${'foo'})`],
    ])(
      'should create a TextTemplate if there is a only text value',
      ({ strings, values }) => {
        const hostEnvironment = new ServerHostEnvironment(document);
        const template = hostEnvironment.createTemplate(
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

  describe('getCurrentPriority()', () => {
    it('always returns "user-blocking"', () => {
      const hostEnvironment = new ServerHostEnvironment(document);
      expect(hostEnvironment.getCurrentPriority()).toBe('user-blocking');
    });
  });

  describe('requestCallback()', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('schedules a callback using setTimeout()', async () => {
      const hostEnvironment = new ServerHostEnvironment(document);
      const callback = vi.fn();
      const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

      await hostEnvironment.requestCallback(callback);

      expect(callback).toHaveBeenCalledOnce();
      expect(callback).toHaveBeenCalledWith();
      expect(setTimeoutSpy).toHaveBeenCalledOnce();
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function));
    });

    it.each([['user-blocking'], ['user-visible'], ['background']] as const)(
      'schedules a callback with an arbitrary priority using setTimeout()',
      async (priority) => {
        const hostEnvironment = new ServerHostEnvironment(document);
        const callback = vi.fn();
        const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

        await hostEnvironment.requestCallback(callback, { priority });

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
        'foo',
        {
          type: PartType.Attribute,
          node: document.createElement('div'),
          name: 'class',
        },
        AttributePrimitive,
      ],
      [
        'foo',
        {
          type: PartType.ChildNode,
          node: document.createComment(''),
          childNode: null,
          namespaceURI: HTML_NAMESPACE_URI,
        },
        NodePrimitive,
      ],
      [
        null,
        {
          type: PartType.ChildNode,
          node: document.createComment(''),
          childNode: null,
          namespaceURI: HTML_NAMESPACE_URI,
        },
        BlackholePrimitive,
      ],
      [
        undefined,
        {
          type: PartType.ChildNode,
          node: document.createComment(''),
          childNode: null,
          namespaceURI: HTML_NAMESPACE_URI,
        },
        BlackholePrimitive,
      ],
      [
        {},
        {
          type: PartType.Element,
          node: document.createElement('div'),
        },
        SpreadPrimitive,
      ],
      [
        () => {},
        {
          type: PartType.Event,
          node: document.createElement('div'),
          name: 'click',
        },
        BlackholePrimitive,
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
    ] as const)(
      'resolves the Primitive from an arbitrary part',
      (value, part, expectedPrimitive) => {
        const hostEnvironment = new ServerHostEnvironment(document);

        expect(hostEnvironment.resolvePrimitive(value, part)).toBe(
          expectedPrimitive,
        );
      },
    );

    it.each([
      [
        [],
        {
          type: PartType.Attribute,
          node: document.createElement('div'),
          name: ':classlist',
        },
        ClassListPrimitive,
      ],
      [
        'foo',
        {
          type: PartType.Attribute,
          node: document.createElement('div'),
          name: ':ref',
        },
        BlackholePrimitive,
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
    ] as const)(
      'resolves the Primitive from special attribute parts',
      (value, part, expectedPrimitive) => {
        const hostEnvironment = new ServerHostEnvironment(document);

        expect(hostEnvironment.resolvePrimitive(value, part)).toBe(
          expectedPrimitive,
        );
        expect(
          hostEnvironment.resolvePrimitive(value, {
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
        'foo',
        {
          type: PartType.Attribute,
          node: document.createElement('div'),
          name: 'class',
        },
        StrictSlot,
      ],
      [
        'foo',
        {
          type: PartType.ChildNode,
          node: document.createComment(''),
          childNode: null,
          namespaceURI: HTML_NAMESPACE_URI,
        },
        LooseSlot,
      ],
      [
        'foo',
        {
          type: PartType.Element,
          node: document.createElement('div'),
        },
        StrictSlot,
      ],
      [
        'foo',
        {
          type: PartType.Event,
          node: document.createElement('div'),
          name: 'click',
        },
        StrictSlot,
      ],
      [
        'foo',
        {
          type: PartType.Live,
          node: document.createElement('textarea'),
          name: 'value',
          defaultValue: '',
        },
        StrictSlot,
      ],
      [
        'foo',
        {
          type: PartType.Property,
          node: document.createElement('textarea'),
          name: 'value',
          defaultValue: '',
        },
        StrictSlot,
      ],
      [
        'foo',
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
      (value, part, expectedSlotType) => {
        const hostEnvironment = new ServerHostEnvironment(document);

        expect(hostEnvironment.resolveSlotType(value, part)).toBe(
          expectedSlotType,
        );
      },
    );
  });

  describe('startViewTransition()', () => {
    it('invokes the callback as a microtask', async () => {
      const hostEnvironment = new ServerHostEnvironment(document);
      const callback = vi.fn();

      await hostEnvironment.startViewTransition(callback);

      expect(callback).toHaveBeenCalledOnce();
    });
  });

  describe('yieldToMain()', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('waits until the timer to be executed', async () => {
      const hostEnvironment = new ServerHostEnvironment(document);
      const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

      await hostEnvironment.yieldToMain();

      expect(setTimeoutSpy).toHaveBeenCalledOnce();
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function));
    });
  });
});
