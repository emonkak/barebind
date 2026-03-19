import { afterEach, describe, expect, it, vi } from 'vitest';
import { ServerBackend } from '@/backend/server.js';
import {
  type Effect,
  EffectQueue,
  type Layout,
  PART_TYPE_ATTRIBUTE,
  PART_TYPE_CHILD_NODE,
  PART_TYPE_ELEMENT,
  PART_TYPE_EVENT,
  PART_TYPE_LIVE,
  PART_TYPE_PROPERTY,
  PART_TYPE_TEXT,
  type Part,
  type Primitive,
} from '@/core.js';
import { SyncLane } from '@/lane.js';
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

      backend.flushEffects(mutationEffects, 'mutation');
      backend.flushEffects(layoutEffects, 'layout');
      backend.flushEffects(passiveEffects, 'passive');

      expect(mutationEffect.commit).toHaveBeenCalledTimes(4);
      expect(layoutEffect.commit).toHaveBeenCalledTimes(0);
      expect(passiveEffect.commit).toHaveBeenCalledTimes(0);
    });
  });

  describe('getDefaultLanes()', () => {
    it('returns SyncLane', () => {
      const backend = new ServerBackend(document);

      expect(backend.getDefaultLanes()).toBe(SyncLane);
    });
  });

  describe('getUpdatePriority()', () => {
    it('returns "user-visible"', () => {
      const backend = new ServerBackend(document);
      expect(backend.getUpdatePriority()).toBe('user-visible');
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
    it.each<[unknown, Part, Primitive<unknown>]>([
      [
        'foo',
        {
          type: PART_TYPE_ATTRIBUTE,
          node: document.createElement('div'),
          name: 'class',
        },
        AttributePrimitive,
      ],
      [
        null,
        {
          type: PART_TYPE_CHILD_NODE,
          node: document.createComment(''),
          anchorNode: null,
          namespaceURI: HTML_NAMESPACE_URI,
        },
        BlackholePrimitive,
      ],
      [
        undefined,
        {
          type: PART_TYPE_CHILD_NODE,
          node: document.createComment(''),
          anchorNode: null,
          namespaceURI: HTML_NAMESPACE_URI,
        },
        BlackholePrimitive,
      ],
      [
        'foo',
        {
          type: PART_TYPE_CHILD_NODE,
          node: document.createComment(''),
          anchorNode: null,
          namespaceURI: HTML_NAMESPACE_URI,
        },
        CommentPrimitive,
      ],
      [
        {},
        {
          type: PART_TYPE_ELEMENT,
          node: document.createElement('div'),
        },
        SpreadPrimitive,
      ],
      [
        () => {},
        {
          type: PART_TYPE_EVENT,
          node: document.createElement('div'),
          name: 'click',
        },
        BlackholePrimitive,
      ],
      [
        'foo',
        {
          type: PART_TYPE_LIVE,
          node: document.createElement('textarea'),
          name: 'value',
          defaultValue: '',
        },
        LivePrimitive,
      ],
      [
        'foo',
        {
          type: PART_TYPE_PROPERTY,
          node: document.createElement('textarea'),
          name: 'value',
          defaultValue: '',
        },
        PropertyPrimitive,
      ],
      [
        'foo',
        {
          type: PART_TYPE_TEXT,
          node: document.createTextNode(''),
          precedingText: '',
          followingText: '',
        },
        TextPrimitive,
      ],
    ])('resolves primitives from any parts', (source, part, expectedPrimitive) => {
      const backend = new ServerBackend(document);

      expect(backend.resolvePrimitive(source, part)).toStrictEqual(
        expectedPrimitive,
      );
    });

    it.each<[unknown, Part.AttributePart, Primitive<unknown>]>([
      [
        [],
        {
          type: PART_TYPE_ATTRIBUTE,
          node: document.createElement('div'),
          name: ':class',
        },
        ClassPrimitive,
      ],
      [
        'foo',
        {
          type: PART_TYPE_ATTRIBUTE,
          node: document.createElement('div'),
          name: ':ref',
        },
        BlackholePrimitive,
      ],
      [
        {},
        {
          type: PART_TYPE_ATTRIBUTE,
          node: document.createElement('div'),
          name: ':style',
        },
        StylePrimitive,
      ],
      [
        null,
        {
          type: PART_TYPE_ATTRIBUTE,
          node: document.createElement('div'),
          name: ':',
        },
        BlackholePrimitive,
      ],
    ])('resolves primitives from attribute parts starting with ":"', (source, part, expectedPrimitive) => {
      const backend = new ServerBackend(document);

      expect(backend.resolvePrimitive(source, part)).toBe(expectedPrimitive);
      expect(
        backend.resolvePrimitive(source, { ...part, name: part.name }),
      ).toBe(expectedPrimitive);
    });
  });

  describe('resolveLayout()', () => {
    it.each<[unknown, Part, Layout]>([
      [
        'foo',
        {
          type: PART_TYPE_ATTRIBUTE,
          node: document.createElement('div'),
          name: 'class',
        },
        StrictLayout,
      ],
      [
        'foo',
        {
          type: PART_TYPE_CHILD_NODE,
          node: document.createComment(''),
          anchorNode: null,
          namespaceURI: HTML_NAMESPACE_URI,
        },
        LooseLayout,
      ],
      [
        'foo',
        {
          type: PART_TYPE_ELEMENT,
          node: document.createElement('div'),
        },
        StrictLayout,
      ],
      [
        'foo',
        {
          type: PART_TYPE_EVENT,
          node: document.createElement('div'),
          name: 'click',
        },
        StrictLayout,
      ],
      [
        'foo',
        {
          type: PART_TYPE_LIVE,
          node: document.createElement('textarea'),
          name: 'value',
          defaultValue: '',
        },
        StrictLayout,
      ],
      [
        'foo',
        {
          type: PART_TYPE_PROPERTY,
          node: document.createElement('textarea'),
          name: 'value',
          defaultValue: '',
        },
        StrictLayout,
      ],
      [
        'foo',
        {
          type: PART_TYPE_TEXT,
          node: document.createTextNode(''),
          precedingText: '',
          followingText: '',
        },
        StrictLayout,
      ],
    ])('resolves the Layout from an arbitrary part', (source, part, expectedLayout) => {
      const backend = new ServerBackend(document);

      expect(backend.resolveLayout(source, part)).toBe(expectedLayout);
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
