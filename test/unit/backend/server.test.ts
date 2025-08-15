import { afterEach, describe, expect, it, vi } from 'vitest';
import { ServerBackend } from '@/backend/server.js';
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
import { LooseSlot } from '@/slot/loose.js';
import { StrictSlot } from '@/slot/strict.js';
import { HTML_NAMESPACE_URI } from '@/template/template.js';
import { OptimizedTemplateFactory } from '@/template-factory.js';
import { MockCommitContext } from '../../mocks.js';

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

  describe('getCurrentPriority()', () => {
    it('always returns "user-blocking"', () => {
      const backend = new ServerBackend(document);
      expect(backend.getCurrentPriority()).toBe('user-blocking');
    });
  });

  describe('getTemplateFactory()', () => {
    it('returns a OptimizedTemplateFactory', () => {
      const backend = new ServerBackend(document);

      expect(backend.getTemplateFactory()).toBeInstanceOf(
        OptimizedTemplateFactory,
      );
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
