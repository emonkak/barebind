import { describe, expect, it } from 'vitest';

import { PartType } from '@/part.js';
import { SpreadBinding, SpreadPrimitive } from '@/primitive/spread.js';
import { UpdateEngine } from '@/updateEngine.js';
import { MockRenderHost } from '../../mocks.js';

describe('SpreadPrimitive', () => {
  describe('name', () => {
    it('is a string that represents the primitive itself', () => {
      expect(SpreadPrimitive.name, 'SpreadPrimitive');
    });
  });

  describe('ensureValue()', () => {
    it('asserts the value is a object', () => {
      const part = {
        type: PartType.Element,
        node: document.createElement('div'),
      } as const;
      const ensureValue: (typeof SpreadPrimitive)['ensureValue'] =
        SpreadPrimitive.ensureValue;

      expect(() => {
        ensureValue({ class: 'foo' }, part);
      }).not.toThrow();
    });

    it.each([[null], [undefined], ['foo']])(
      'throws the error if the value is not object',
      (value) => {
        const part = {
          type: PartType.Element,
          node: document.createElement('div'),
        } as const;
        const ensureValue: (typeof SpreadPrimitive)['ensureValue'] =
          SpreadPrimitive.ensureValue;

        expect(() => {
          ensureValue(value, part);
        }).toThrow('The value of SpreadPrimitive must be object,');
      },
    );
  });

  describe('resolveBinding()', () => {
    it('constructs a new SpreadBinding', () => {
      const props = { color: 'red' };
      const part = {
        type: PartType.Element,
        node: document.createElement('div'),
      } as const;
      const context = new UpdateEngine(new MockRenderHost());
      const binding = SpreadPrimitive.resolveBinding(props, part, context);

      expect(binding.directive).toBe(SpreadPrimitive);
      expect(binding.value).toBe(props);
      expect(binding.part).toBe(part);
    });

    it('should throw the error if the part is not a element part', () => {
      const props = { class: 'foo' };
      const part = {
        type: PartType.Text,
        node: document.createTextNode(''),
        precedingText: '',
        followingText: '',
      } as const;
      const context = new UpdateEngine(new MockRenderHost());

      expect(() =>
        SpreadPrimitive.resolveBinding(props, part, context),
      ).toThrow('SpreadPrimitive must be used in an element part,');
    });
  });
});

describe('SpreadBinding', () => {
  describe('shouldBind', () => {
    it('returns true if the committed value does not exist', () => {
      const props = { class: 'foo' };
      const part = {
        type: PartType.Element,
        node: document.createElement('div'),
      } as const;
      const binding = new SpreadBinding(props, part);

      expect(binding.shouldBind(props)).toBe(true);
    });

    it('returns true if the style has changed from the committed one', () => {
      const props1 = { class: 'foo' };
      const props2 = { id: 'bar' };
      const part = {
        type: PartType.Element,
        node: document.createElement('div'),
      } as const;
      const binding = new SpreadBinding(props1, part);
      const context = new UpdateEngine(new MockRenderHost());

      binding.connect(context);
      binding.commit(context);

      expect(binding.shouldBind(props1)).toBe(false);
      expect(binding.shouldBind(props2)).toBe(true);
    });
  });

  describe('commit()', () => {
    it('commits the corresponding slots for each properties', () => {
      const props1 = {
        id: 'foo',
        class: 'bar',
        $open: true,
        '.innerHTML': '<div>foo</div>',
        '@click': () => {},
      };
      const props2 = {
        id: undefined,
        class: 'bar',
      };
      const part = {
        type: PartType.Element,
        node: document.createElement('dialog'),
      } as const;
      const binding = new SpreadBinding(props1, part);
      const context = new UpdateEngine(new MockRenderHost());

      binding.connect(context);
      binding.commit(context);

      const initialSlots = Object.fromEntries(binding['_memoizedSlots'] ?? []);

      expect(initialSlots).toStrictEqual({
        id: expect.objectContaining({
          isConnected: true,
          isCommitted: true,
          part: {
            type: PartType.Attribute,
            name: 'id',
            node: expect.exact(part.node),
          },
          value: props1.id,
        }),
        class: expect.objectContaining({
          isConnected: true,
          isCommitted: true,
          part: {
            type: PartType.Attribute,
            name: 'class',
            node: expect.exact(part.node),
          },
          value: props1.class,
        }),
        $open: expect.objectContaining({
          isConnected: true,
          isCommitted: true,
          part: {
            type: PartType.Live,
            name: 'open',
            node: expect.exact(part.node),
            defaultValue: false,
          },
          value: props1.$open,
        }),
        '.innerHTML': expect.objectContaining({
          isConnected: true,
          isCommitted: true,
          part: {
            type: PartType.Property,
            name: 'innerHTML',
            node: expect.exact(part.node),
            defaultValue: '',
          },
          value: props1['.innerHTML'],
        }),
        '@click': expect.objectContaining({
          isConnected: true,
          isCommitted: true,
          part: {
            type: PartType.Event,
            name: 'click',
            node: expect.exact(part.node),
          },
          value: props1['@click'],
        }),
      });

      binding.bind(props2);
      binding.connect(context);
      binding.commit(context);

      expect(initialSlots).toStrictEqual({
        id: expect.objectContaining({
          isConnected: false,
          isCommitted: false,
        }),
        class: expect.objectContaining({
          isConnected: true,
          isCommitted: true,
          part: {
            type: PartType.Attribute,
            name: 'class',
            node: expect.exact(part.node),
          },
          value: props1.class,
        }),
        $open: expect.objectContaining({
          isConnected: false,
          isCommitted: false,
        }),
        '.innerHTML': expect.objectContaining({
          isConnected: false,
          isCommitted: false,
        }),
        '@click': expect.objectContaining({
          isConnected: false,
          isCommitted: false,
        }),
      });
      expect(Object.fromEntries(binding['_memoizedSlots'] ?? [])).toStrictEqual(
        {
          class: expect.objectContaining({
            isConnected: true,
            isCommitted: true,
            part: {
              type: PartType.Attribute,
              name: 'class',
              node: part.node,
            },
            value: props1.class,
          }),
        },
      );
    });
  });

  describe('rollback()', () => {
    it('should do nothing if the committed properties does not exist', () => {
      const props = {};
      const part = {
        type: PartType.Element,
        node: document.createElement('div'),
      } as const;
      const binding = new SpreadBinding(props, part);
      const context = new UpdateEngine(new MockRenderHost());

      binding.disconnect(context);
      binding.rollback(context);

      expect(binding['_memoizedSlots']).toBe(null);
    });

    it('rollbacks the committed properties', () => {
      const props = {
        id: 'foo',
        class: 'bar',
        $open: true,
        '.innerHTML': '<div>foo</div>',
        '@click': () => {},
      };
      const part = {
        type: PartType.Element,
        node: document.createElement('dialog'),
      } as const;
      const binding = new SpreadBinding(props, part);
      const context = new UpdateEngine(new MockRenderHost());

      binding.connect(context);
      binding.commit(context);

      const initialSlots = Object.fromEntries(binding['_memoizedSlots'] ?? []);

      expect(initialSlots).toStrictEqual({
        id: expect.objectContaining({
          isConnected: true,
          isCommitted: true,
          part: {
            type: PartType.Attribute,
            name: 'id',
            node: expect.exact(part.node),
          },
          value: props.id,
        }),
        class: expect.objectContaining({
          isConnected: true,
          isCommitted: true,
          part: {
            type: PartType.Attribute,
            name: 'class',
            node: expect.exact(part.node),
          },
          value: props.class,
        }),
        $open: expect.objectContaining({
          isConnected: true,
          isCommitted: true,
          part: {
            type: PartType.Live,
            name: 'open',
            node: expect.exact(part.node),
            defaultValue: false,
          },
          value: props.$open,
        }),
        '.innerHTML': expect.objectContaining({
          isConnected: true,
          isCommitted: true,
          part: {
            type: PartType.Property,
            name: 'innerHTML',
            node: expect.exact(part.node),
            defaultValue: '',
          },
          value: props['.innerHTML'],
        }),
        '@click': expect.objectContaining({
          isConnected: true,
          isCommitted: true,
          part: {
            type: PartType.Event,
            name: 'click',
            node: expect.exact(part.node),
          },
          value: props['@click'],
        }),
      });

      binding.disconnect(context);
      binding.rollback(context);

      expect(initialSlots).toStrictEqual({
        id: expect.objectContaining({
          isConnected: false,
          isCommitted: false,
        }),
        class: expect.objectContaining({
          isConnected: false,
          isCommitted: false,
        }),
        $open: expect.objectContaining({
          isConnected: false,
          isCommitted: false,
        }),
        '.innerHTML': expect.objectContaining({
          isConnected: false,
          isCommitted: false,
        }),
        '@click': expect.objectContaining({
          isConnected: false,
          isCommitted: false,
        }),
      });
      expect(binding['_memoizedSlots']).toBe(null);
    });
  });
});
