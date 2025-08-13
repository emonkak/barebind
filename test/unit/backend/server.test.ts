import { afterEach, describe, expect, it, vi } from 'vitest';
import { ServerBackend } from '@/backend/server.js';
import { CommitPhase, type Effect, PartType } from '@/core.js';
import { AttributePrimitive } from '@/primitive/attribute.js';
import { BlackholePrimitive } from '@/primitive/blackhole.js';
import { ClassListPrimitive } from '@/primitive/class-list.js';
import { CommentPrimitive } from '@/primitive/comment.js';
import { LivePrimitive } from '@/primitive/live.js';
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

describe('ServerBackend', () => {
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
      const backend = new ServerBackend(document);
      const context = new MockCommitContext();

      backend.commitEffects(mutationEffects, CommitPhase.Mutation, context);
      backend.commitEffects(layoutEffects, CommitPhase.Layout, context);
      backend.commitEffects(passiveEffects, CommitPhase.Layout, context);

      expect(mutationEffects[0].commit).toHaveBeenCalledOnce();
      expect(mutationEffects[0].commit).toHaveBeenCalledWith(context);
      expect(layoutEffects[0].commit).not.toHaveBeenCalled();
      expect(layoutEffects[0].commit).not.toHaveBeenCalled();
      expect(passiveEffects[0].commit).not.toHaveBeenCalled();
    });
  });

  describe('parseTemplate()', () => {
    it('creates a TaggedTemplate', () => {
      const backend = new ServerBackend(document);
      const { strings, values } =
        templateLiteral`<div>${'Hello'}, ${'World'}!</div>`;
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

    it.for([templateLiteral``, templateLiteral`\n`, templateLiteral`\n \n`])(
      'creates an EmptyTemplate if there is no contents',
      ({ strings, values }) => {
        const backend = new ServerBackend(document);
        const template = backend.parseTemplate(
          strings,
          values,
          TEMPLATE_PLACEHOLDER,
          'html',
        );

        expect(template).toBeInstanceOf(EmptyTemplate);
      },
    );

    it.for([
      templateLiteral`<${'foo'}>`,
      templateLiteral`<${'foo'}/>`,
      templateLiteral`\n <${'foo'} /> \n`,
      templateLiteral`\n <!--${'foo'}--> \n`,
      templateLiteral`\n <!-- ${'foo'} --> \n`,
    ])(
      'creates a ChildNodeTemplate if there is a only child value',
      ({ strings, values }) => {
        const backend = new ServerBackend(document);
        const template = backend.parseTemplate(
          strings,
          values,
          TEMPLATE_PLACEHOLDER,
          'html',
        );

        expect(template).toBeInstanceOf(ChildNodeTemplate);
      },
    );

    it.each([
      [templateLiteral`${'foo'}`, 'html'],
      [templateLiteral` ${'foo'} `, 'html'],
      [templateLiteral`(${'foo'})`, 'html'],
      [templateLiteral`<${'foo'}>`, 'textarea'],
      [templateLiteral`<!--${'foo'}-->`, 'textarea'],
    ] as const)(
      'creates a TextTemplate if there is a only text value',
      ({ strings, values }, mode) => {
        const backend = new ServerBackend(document);
        const template = backend.parseTemplate(
          strings,
          values,
          TEMPLATE_PLACEHOLDER,
          mode,
        ) as TextTemplate;

        expect(template).toBeInstanceOf(TextTemplate);
        expect(template['_precedingText']).toBe(strings[0]);
        expect(template['_followingText']).toBe(strings[1]);
      },
    );
  });

  describe('getCurrentPriority()', () => {
    it('always returns "user-blocking"', () => {
      const backend = new ServerBackend(document);
      expect(backend.getCurrentPriority()).toBe('user-blocking');
    });
  });

  describe('requestCallback()', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('schedules a callback using setTimeout()', async () => {
      const backend = new ServerBackend(document);
      const callback = vi.fn();
      const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

      await backend.requestCallback(callback);

      expect(callback).toHaveBeenCalledOnce();
      expect(setTimeoutSpy).toHaveBeenCalledOnce();
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function));
    });

    it.for(['user-blocking', 'user-visible', 'background'] as const)(
      'schedules a callback with an arbitrary priority using setTimeout()',
      async (priority) => {
        const backend = new ServerBackend(document);
        const callback = vi.fn();
        const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

        await backend.requestCallback(callback, { priority });

        expect(callback).toHaveBeenCalledOnce();
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
          anchorNode: null,
          namespaceURI: HTML_NAMESPACE_URI,
        },
        CommentPrimitive,
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
        const backend = new ServerBackend(document);

        expect(backend.resolvePrimitive(value, part)).toBe(expectedPrimitive);
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
        const backend = new ServerBackend(document);

        expect(backend.resolvePrimitive(value, part)).toBe(expectedPrimitive);
        expect(
          backend.resolvePrimitive(value, {
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
          anchorNode: null,
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
        const backend = new ServerBackend(document);

        expect(backend.resolveSlotType(value, part)).toBe(expectedSlotType);
      },
    );
  });

  describe('startViewTransition()', () => {
    it('invokes the callback as a microtask', async () => {
      const backend = new ServerBackend(document);
      const callback = vi.fn();

      await backend.startViewTransition(callback);

      expect(callback).toHaveBeenCalledOnce();
    });
  });

  describe('yieldToMain()', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('waits until the timer to be executed', async () => {
      const backend = new ServerBackend(document);
      const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

      await backend.yieldToMain();

      expect(setTimeoutSpy).toHaveBeenCalledOnce();
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function));
    });
  });
});
