import { afterEach, describe, expect, it, vi } from 'vitest';

import { CommitPhase, type Effect, PartType } from '@/internal.js';
import { AttributePrimitive } from '@/primitive/attribute.js';
import { BlackholePrimitive } from '@/primitive/blackhole.js';
import { ClassPrimitive } from '@/primitive/class.js';
import { CommentPrimitive } from '@/primitive/comment.js';
import { LivePrimitive } from '@/primitive/live.js';
import { PropertyPrimitive } from '@/primitive/property.js';
import { SpreadPrimitive } from '@/primitive/spread.js';
import { StylePrimitive } from '@/primitive/style.js';
import { TextPrimitive } from '@/primitive/text.js';
import { ServerBackend } from '@/runtime/server.js';
import { Runtime } from '@/runtime.js';
import { LooseLayout } from '@/slot/loose.js';
import { StrictLayout } from '@/slot/strict.js';
import { ChildNodeTemplate } from '@/template/child-node.js';
import { FragmentTemplate } from '@/template/fragment.js';
import { TaggedTemplate } from '@/template/tagged.js';
import { HTML_NAMESPACE_URI } from '@/template/template.js';
import { templateLiteral } from '../../test-helpers.js';

const TEMPLATE_PLACEHOLDER = '__test__';

describe('ServerBackend', () => {
  describe('commitEffects()', () => {
    it('commits only mutation effects', () => {
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
      const backend = new ServerBackend(document);

      backend.commitEffects(mutationEffects, CommitPhase.Mutation);
      backend.commitEffects(layoutEffects, CommitPhase.Layout);
      backend.commitEffects(passiveEffects, CommitPhase.Passive);

      expect(executedEffects).toStrictEqual(
        [mutationEffects[1], mutationEffects[0]].map((effect) =>
          expect.exact(effect),
        ),
      );
    });
  });

  describe('getTaskPriority()', () => {
    it('always returns "user-blocking"', () => {
      const backend = new ServerBackend(document);
      expect(backend.getTaskPriority()).toBe('user-blocking');
    });
  });

  describe('parseTemplate()', () => {
    it('creates a TaggedTemplate', () => {
      const { strings, values } =
        templateLiteral`<div>${'Hello'}, ${'World'}!</div>`;
      const backend = new ServerBackend(document);
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
    it('flush updates synchronously', async () => {
      const backend = new ServerBackend(document);
      const runtime = new Runtime(backend);

      const flushSyncSpy = vi.spyOn(runtime, 'flushSync');

      backend.flushUpdate(runtime);

      expect(flushSyncSpy).toHaveBeenCalledOnce();
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

    it.for([
      'user-blocking',
      'user-visible',
      'background',
    ] as const)('schedules a callback with "%s" priority using setTimeout()', async (priority) => {
      const backend = new ServerBackend(document);
      const callback = vi.fn();
      const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

      await backend.requestCallback(callback, { priority });

      expect(callback).toHaveBeenCalledOnce();
      expect(setTimeoutSpy).toHaveBeenCalledOnce();
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function));
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
        AttributePrimitive.instance,
      ],
      [
        null,
        {
          type: PartType.ChildNode,
          node: document.createComment(''),
          anchorNode: null,
          namespaceURI: HTML_NAMESPACE_URI,
        },
        BlackholePrimitive.instance,
      ],
      [
        undefined,
        {
          type: PartType.ChildNode,
          node: document.createComment(''),
          anchorNode: null,
          namespaceURI: HTML_NAMESPACE_URI,
        },
        BlackholePrimitive.instance,
      ],
      [
        ['foo', 'bar', 'baz'],
        {
          type: PartType.ChildNode,
          node: document.createComment(''),
          anchorNode: null,
          namespaceURI: HTML_NAMESPACE_URI,
        },
        new FragmentTemplate([
          ChildNodeTemplate.instance,
          ChildNodeTemplate.instance,
          ChildNodeTemplate.instance,
        ]),
      ],
      [
        'foo',
        {
          type: PartType.ChildNode,
          node: document.createComment(''),
          anchorNode: null,
          namespaceURI: HTML_NAMESPACE_URI,
        },
        CommentPrimitive.instance,
      ],
      [
        {},
        {
          type: PartType.Element,
          node: document.createElement('div'),
        },
        SpreadPrimitive.instance,
      ],
      [
        () => {},
        {
          type: PartType.Event,
          node: document.createElement('div'),
          name: 'click',
        },
        BlackholePrimitive.instance,
      ],
      [
        'foo',
        {
          type: PartType.Live,
          node: document.createElement('textarea'),
          name: 'value',
          defaultValue: '',
        },
        LivePrimitive.instance,
      ],
      [
        'foo',
        {
          type: PartType.Property,
          node: document.createElement('textarea'),
          name: 'value',
          defaultValue: '',
        },
        PropertyPrimitive.instance,
      ],
      [
        'foo',
        {
          type: PartType.Text,
          node: document.createTextNode(''),
          precedingText: '',
          followingText: '',
        },
        TextPrimitive.instance,
      ],
    ] as const)('resolves the Primitive from an arbitrary part', (value, part, expectedPrimitive) => {
      const backend = new ServerBackend(document);

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
        ClassPrimitive.instance,
      ],
      [
        'foo',
        {
          type: PartType.Attribute,
          node: document.createElement('div'),
          name: ':ref',
        },
        BlackholePrimitive.instance,
      ],
      [
        {},
        {
          type: PartType.Attribute,
          node: document.createElement('div'),
          name: ':style',
        },
        StylePrimitive.instance,
      ],
      [
        null,
        {
          type: PartType.Attribute,
          node: document.createElement('div'),
          name: ':',
        },
        BlackholePrimitive.instance,
      ],
    ] as const)('resolves the Primitive from special attribute parts', (value, part, expectedPrimitive) => {
      const backend = new ServerBackend(document);

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
        StrictLayout.instance,
      ],
      [
        'foo',
        {
          type: PartType.ChildNode,
          node: document.createComment(''),
          anchorNode: null,
          namespaceURI: HTML_NAMESPACE_URI,
        },
        LooseLayout.instance,
      ],
      [
        'foo',
        {
          type: PartType.Element,
          node: document.createElement('div'),
        },
        StrictLayout.instance,
      ],
      [
        'foo',
        {
          type: PartType.Event,
          node: document.createElement('div'),
          name: 'click',
        },
        StrictLayout.instance,
      ],
      [
        'foo',
        {
          type: PartType.Live,
          node: document.createElement('textarea'),
          name: 'value',
          defaultValue: '',
        },
        StrictLayout.instance,
      ],
      [
        'foo',
        {
          type: PartType.Property,
          node: document.createElement('textarea'),
          name: 'value',
          defaultValue: '',
        },
        StrictLayout.instance,
      ],
      [
        'foo',
        {
          type: PartType.Text,
          node: document.createTextNode(''),
          precedingText: '',
          followingText: '',
        },
        StrictLayout.instance,
      ],
    ] as const)('resolves the Layout from an arbitrary part', (value, part, expectedLayout) => {
      const backend = new ServerBackend(document);

      expect(backend.resolveLayout(value, part)).toBe(expectedLayout);
    });
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
