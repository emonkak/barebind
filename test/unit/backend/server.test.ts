import { afterEach, describe, expect, it, vi } from 'vitest';
import { ServerBackend } from '@/backend/server.js';
import {
  type Effect,
  EffectQueue,
  PART_TYPE_TEXT,
  type Part,
  type Primitive,
} from '@/core.js';
import { SyncLane } from '@/lane.js';
import {
  createAttributePart,
  createChildNodePart,
  createElementPart,
  createEventPart,
  createLivePart,
  createPropertyPart,
  createTextPart,
  HTML_NAMESPACE_URI,
} from '@/part.js';
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
        createAttributePart(document.createElement('div'), 'class'),
        AttributePrimitive,
      ],
      [
        null,
        createChildNodePart(document.createComment(''), HTML_NAMESPACE_URI),
        BlackholePrimitive,
      ],
      [
        undefined,
        createChildNodePart(document.createComment(''), HTML_NAMESPACE_URI),
        BlackholePrimitive,
      ],
      [
        'foo',
        createChildNodePart(document.createComment(''), HTML_NAMESPACE_URI),
        CommentPrimitive,
      ],
      [{}, createElementPart(document.createElement('div')), SpreadPrimitive],
      [
        () => {},
        createEventPart(document.createElement('div'), 'click'),
        BlackholePrimitive,
      ],
      [
        'foo',
        createLivePart(document.createElement('textarea'), 'value'),
        LivePrimitive,
      ],
      [
        'foo',
        createPropertyPart(document.createElement('textarea'), 'value'),
        PropertyPrimitive,
      ],
      [
        'foo',
        createTextPart(document.createTextNode(''), '', ''),
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
        createAttributePart(document.createElement('div'), ':class'),
        ClassPrimitive,
      ],
      [
        'foo',
        createAttributePart(document.createElement('div'), ':ref'),
        BlackholePrimitive,
      ],
      [
        {},
        createAttributePart(document.createElement('div'), ':style'),
        StylePrimitive,
      ],
      [
        null,
        createAttributePart(document.createElement('div'), ':'),
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

  describe('resolveTemplate()', () => {
    it('creates a TaggedTemplate', () => {
      const [strings, ...values] =
        templateLiteral`<div>${'Hello'}, ${'World'}!</div>`;
      const backend = new ServerBackend(document);
      const template = backend.resolveTemplate(
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
