import { afterEach, describe, expect, it, vi } from 'vitest';
import { ServerBackend } from '@/backend/server.js';
import {
  type Effect,
  EffectQueue,
  PART_TYPE_TEXT,
  type Part,
  type Primitive,
} from '@/core.js';
import {
  createAttributePart,
  createChildNodePart,
  createElementPart,
  createEventPart,
  createLivePart,
  createPropertyPart,
  createTextPart,
  HTML_NAMESPACE_URI,
} from '@/dom.js';
import { SyncLane } from '@/lane.js';
import { AttributeType } from '@/primitive/attribute.js';
import { BlackholeType } from '@/primitive/blackhole.js';
import { ClassType } from '@/primitive/class.js';
import { CommentType } from '@/primitive/comment.js';
import { LiveType } from '@/primitive/live.js';
import { PropertyType } from '@/primitive/property.js';
import { SpreadType } from '@/primitive/spread.js';
import { StyleType } from '@/primitive/style.js';
import { TextType } from '@/primitive/text.js';
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

  describe('resolveType()', () => {
    it.each<[unknown, Part, Primitive<unknown>]>([
      [
        'foo',
        createAttributePart(document.createElement('div'), 'class'),
        AttributeType,
      ],
      [
        null,
        createChildNodePart(document.createComment(''), HTML_NAMESPACE_URI),
        BlackholeType,
      ],
      [
        undefined,
        createChildNodePart(document.createComment(''), HTML_NAMESPACE_URI),
        BlackholeType,
      ],
      [
        'foo',
        createChildNodePart(document.createComment(''), HTML_NAMESPACE_URI),
        CommentType,
      ],
      [{}, createElementPart(document.createElement('div')), SpreadType],
      [
        () => {},
        createEventPart(document.createElement('div'), 'click'),
        BlackholeType,
      ],
      [
        'foo',
        createLivePart(document.createElement('textarea'), 'value'),
        LiveType,
      ],
      [
        'foo',
        createPropertyPart(document.createElement('textarea'), 'value'),
        PropertyType,
      ],
      ['foo', createTextPart(document.createTextNode(''), '', ''), TextType],
    ])('resolves primitives from any parts', (source, part, expectedType) => {
      const backend = new ServerBackend(document);

      expect(backend.resolvePrimitive(source, part)).toStrictEqual(
        expectedType,
      );
    });

    it.each<[unknown, Part.AttributePart, Primitive<unknown>]>([
      [
        [],
        createAttributePart(document.createElement('div'), ':class'),
        ClassType,
      ],
      [
        'foo',
        createAttributePart(document.createElement('div'), ':ref'),
        BlackholeType,
      ],
      [
        {},
        createAttributePart(document.createElement('div'), ':style'),
        StyleType,
      ],
      [
        null,
        createAttributePart(document.createElement('div'), ':'),
        BlackholeType,
      ],
    ])('resolves primitives from attribute parts starting with ":"', (source, part, expectedType) => {
      const backend = new ServerBackend(document);

      expect(backend.resolvePrimitive(source, part)).toBe(expectedType);
      expect(
        backend.resolvePrimitive(source, { ...part, name: part.name }),
      ).toBe(expectedType);
    });
  });

  describe('resolveTemplate()', () => {
    it('creates a TaggedTemplate', () => {
      const [strings, ...exprs] =
        templateLiteral`<div>${'Hello'}, ${'World'}!</div>`;
      const backend = new ServerBackend(document);
      const template = backend.resolveTemplate(
        strings,
        exprs,
        'html',
        TEMPLATE_PLACEHOLDER,
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
