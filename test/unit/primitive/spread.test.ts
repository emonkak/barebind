import { describe, expect, it } from 'vitest';

import { HydrationError, HydrationTree, PartType } from '@/core.js';
import { SpreadBinding, SpreadPrimitive } from '@/primitive/spread.js';
import { Runtime } from '@/runtime.js';
import { MockBackend, MockSlot } from '../../mocks.js';
import { createElement } from '../../test-utils.js';

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
      };
      const ensureValue: NonNullable<typeof SpreadPrimitive.ensureValue> =
        SpreadPrimitive.ensureValue!;

      expect(() => {
        ensureValue.call(SpreadPrimitive, { class: 'foo' }, part);
      }).not.toThrow();
    });

    it.for([null, undefined, 'foo'])(
      'throws an error if the value is not object',
      (value) => {
        const part = {
          type: PartType.Element,
          node: document.createElement('div'),
        };
        const ensureValue: NonNullable<typeof SpreadPrimitive.ensureValue> =
          SpreadPrimitive.ensureValue!;

        expect(() => {
          ensureValue.call(SpreadPrimitive, value, part);
        }).toThrow('The value of SpreadPrimitive must be an object,');
      },
    );
  });

  describe('resolveBinding()', () => {
    it('constructs a new SpreadBinding', () => {
      const props = { color: 'red' };
      const part = {
        type: PartType.Element,
        node: document.createElement('div'),
      };
      const runtime = Runtime.create(new MockBackend());
      const binding = SpreadPrimitive.resolveBinding(props, part, runtime);

      expect(binding.type).toBe(SpreadPrimitive);
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
      };
      const runtime = Runtime.create(new MockBackend());

      expect(() =>
        SpreadPrimitive.resolveBinding(props, part, runtime),
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
      };
      const binding = new SpreadBinding(props, part);

      expect(binding.shouldBind(props)).toBe(true);
    });

    it('returns true if the style has changed from the committed one', () => {
      const props1 = { class: 'foo' };
      const props2 = { id: 'bar' };
      const part = {
        type: PartType.Element,
        node: document.createElement('div'),
      };
      const binding = new SpreadBinding(props1, part);
      const runtime = Runtime.create(new MockBackend());

      binding.connect(runtime);
      binding.commit(runtime);

      expect(binding.shouldBind(props1)).toBe(false);
      expect(binding.shouldBind(props2)).toBe(true);
    });
  });

  describe('hydrate()', () => {
    it('hydrates the corresponding slots for each properties', () => {
      const props = {
        id: 'foo',
        class: 'bar',
        title: undefined,
        $open: true,
        '.innerHTML': '<div>foo</div>',
        '@click': () => {},
      };
      const part = {
        type: PartType.Element,
        node: document.createElement('dialog'),
      };
      const binding = new SpreadBinding(props, part);
      const runtime = Runtime.create(new MockBackend());
      const tree = new HydrationTree(createElement('div', {}, part.node));

      binding.hydrate(tree, runtime);

      const slots = Object.fromEntries(binding['_memoizedSlots'] ?? []);

      expect(slots).toStrictEqual(
        Object.fromEntries(
          Object.entries(props)
            .filter(([_key, value]) => value !== undefined)
            .map(([key]) => [key, expect.any(MockSlot)]),
        ),
      );
      expect(slots).toStrictEqual({
        id: expect.objectContaining({
          isConnected: true,
          isCommitted: false,
          part: {
            type: PartType.Attribute,
            name: 'id',
            node: expect.exact(part.node),
          },
          value: props.id,
        }),
        class: expect.objectContaining({
          isConnected: true,
          isCommitted: false,
          part: {
            type: PartType.Attribute,
            name: 'class',
            node: expect.exact(part.node),
          },
          value: props.class,
        }),
        $open: expect.objectContaining({
          isConnected: true,
          isCommitted: false,
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
          isCommitted: false,
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
          isCommitted: false,
          part: {
            type: PartType.Event,
            name: 'click',
            node: expect.exact(part.node),
          },
          value: props['@click'],
        }),
      });
    });

    it('should throw the error if the binding has already been initialized', () => {
      const props = {
        id: 'foo',
        class: 'bar',
        title: undefined,
        $open: true,
        '.innerHTML': '<div>foo</div>',
        '@click': () => {},
      };
      const part = {
        type: PartType.Element,
        node: document.createElement('dialog'),
      };
      const binding = new SpreadBinding(props, part);
      const runtime = Runtime.create(new MockBackend());
      const tree = new HydrationTree(createElement('div', {}, part.node));

      binding.connect(runtime);
      binding.commit(runtime);

      expect(() => {
        binding.hydrate(tree, runtime);
      }).toThrow(HydrationError);
    });
  });

  describe('connect()', () => {
    it('connects the corresponding slots for each properties', () => {
      const props1 = {
        id: 'foo',
        class: 'bar',
        title: undefined,
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
      };
      const binding = new SpreadBinding(props1, part);
      const runtime = Runtime.create(new MockBackend());

      binding.connect(runtime);
      binding.commit(runtime);

      const slots1 = Object.fromEntries(binding['_memoizedSlots'] ?? []);

      expect(slots1).toStrictEqual(
        Object.fromEntries(
          Object.entries(props1)
            .filter(([_key, value]) => value !== undefined)
            .map(([key]) => [key, expect.any(MockSlot)]),
        ),
      );
      expect(slots1).toStrictEqual({
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
      binding.connect(runtime);
      binding.commit(runtime);

      const slots2 = Object.fromEntries(binding['_memoizedSlots'] ?? []);

      expect(slots1).toStrictEqual({
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
      expect(slots2).toStrictEqual(
        Object.fromEntries(
          Object.entries(props2)
            .filter(([_key, value]) => value !== undefined)
            .map(([key]) => [key, expect.any(MockSlot)]),
        ),
      );
      expect(slots2).toStrictEqual({
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
      });
    });
  });

  describe('rollback()', () => {
    it('should do nothing if the committed properties does not exist', () => {
      const props = {};
      const part = {
        type: PartType.Element,
        node: document.createElement('div'),
      };
      const binding = new SpreadBinding(props, part);
      const runtime = Runtime.create(new MockBackend());

      binding.disconnect(runtime);
      binding.rollback(runtime);

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
      };
      const binding = new SpreadBinding(props, part);
      const runtime = Runtime.create(new MockBackend());

      binding.connect(runtime);
      binding.commit(runtime);

      const initialSlots = Object.fromEntries(binding['_memoizedSlots'] ?? []);

      expect(initialSlots).toStrictEqual(
        Object.fromEntries(
          Object.entries(props).map(([key]) => [key, expect.any(MockSlot)]),
        ),
      );
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

      binding.disconnect(runtime);
      binding.rollback(runtime);

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
