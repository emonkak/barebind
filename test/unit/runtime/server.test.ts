import { afterEach, describe, expect, it, vi } from 'vitest';

import { CommitPhase, type Effect, EffectQueue, PartType } from '@/internal.js';
import { LooseLayout } from '@/layout/loose.js';
import { StrictLayout } from '@/layout/strict.js';
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
import { TaggedTemplate } from '@/template/tagged.js';
import { HTML_NAMESPACE_URI } from '@/template/template.js';
import { templateLiteral } from '../../test-helpers.js';

const TEMPLATE_PLACEHOLDER = '__test__';

describe('ServerBackend', () => {
  describe('flushEffects()', () => {
    it('commits only mutation effects in order from child to parent', () => {
      const mutationEffects = new EffectQueue();
      const layoutEffects = new EffectQueue();
      const passiveEffects = new EffectQueue();
      const backend = new ServerBackend(document);

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

      backend.flushEffects(mutationEffects, CommitPhase.Mutation);
      backend.flushEffects(layoutEffects, CommitPhase.Layout);
      backend.flushEffects(passiveEffects, CommitPhase.Passive);

      expect(mutationEffect.commit).toHaveBeenCalledTimes(4);
      expect(layoutEffect.commit).toHaveBeenCalledTimes(0);
      expect(passiveEffect.commit).toHaveBeenCalledTimes(0);
    });
  });

  describe('getUpdatePriority()', () => {
    it('always returns "user-blocking"', () => {
      const backend = new ServerBackend(document);
      expect(backend.getUpdatePriority()).toBe('user-blocking');
    });
  });

  describe('parseTemplate()', () => {
    it('creates a TaggedTemplate', () => {
      const [strings, ...values] =
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
        ClassPrimitive,
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
