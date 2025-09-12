import { describe, expect, it } from 'vitest';
import { PartType } from '@/internal.js';
import { SpreadBinding, SpreadPrimitive } from '@/primitive/spread.js';
import { MockSlot } from '../../mocks.js';
import { createRuntime, TestUpdater } from '../../test-helpers.js';

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
        }).toThrow('The value of SpreadPrimitive must be an object.');
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
      const runtime = createRuntime();
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
      const runtime = createRuntime();

      expect(() =>
        SpreadPrimitive.resolveBinding(props, part, runtime),
      ).toThrow('SpreadPrimitive must be used in an element part.');
    });
  });
});

describe('SpreadBinding', () => {
  describe('shouldUpdate', () => {
    it('returns true if the committed value does not exist', () => {
      const props = { class: 'foo' };
      const part = {
        type: PartType.Element,
        node: document.createElement('div'),
      };
      const binding = new SpreadBinding(props, part);

      expect(binding.shouldUpdate(props)).toBe(true);
    });

    it('returns true if the style has changed from the committed one', () => {
      const props1 = { class: 'foo' };
      const props2 = { id: 'bar' };
      const part = {
        type: PartType.Element,
        node: document.createElement('div'),
      };
      const binding = new SpreadBinding(props1, part);
      const updater = new TestUpdater();

      updater.startUpdate((session) => {
        binding.connect(session);
        binding.commit();
      });

      expect(binding.shouldUpdate(props1)).toBe(false);
      expect(binding.shouldUpdate(props2)).toBe(true);
    });
  });

  describe('connect()', () => {
    it('connects the corresponding slots for each properties', () => {
      const props1 = {
        id: 'foo',
        class: 'bar',
        title: undefined,
        $open: true,
      };
      const props2 = {
        id: undefined,
        class: 'bar',
        '.innerHTML': '<div>foo</div>',
        '@click': () => {},
      };
      const part = {
        type: PartType.Element,
        node: document.createElement('dialog'),
      };
      const binding = new SpreadBinding(props1, part);
      const updater = new TestUpdater();

      SESSION1: {
        updater.startUpdate((session) => {
          binding.connect(session);
          binding.commit();
        });

        const slots = Object.fromEntries(binding['_memoizedSlots'] ?? []);

        expect(slots).toStrictEqual(
          Object.fromEntries(
            Object.entries(props1)
              .filter(([_key, value]) => value !== undefined)
              .map(([key]) => [key, expect.any(MockSlot)]),
          ),
        );
        expect(slots).toStrictEqual({
          id: expect.objectContaining({
            dirty: false,
            committed: true,
            part: {
              type: PartType.Attribute,
              name: 'id',
              node: expect.exact(part.node),
            },
            value: props1.id,
          }),
          class: expect.objectContaining({
            dirty: false,
            committed: true,
            part: {
              type: PartType.Attribute,
              name: 'class',
              node: expect.exact(part.node),
            },
            value: props1.class,
          }),
          $open: expect.objectContaining({
            dirty: false,
            committed: true,
            part: {
              type: PartType.Live,
              name: 'open',
              node: expect.exact(part.node),
              defaultValue: false,
            },
            value: props1.$open,
          }),
        });
      }

      SESSION2: {
        const oldSlots = Object.fromEntries(binding['_memoizedSlots'] ?? []);

        updater.startUpdate((session) => {
          binding.value = props2;
          binding.connect(session);
          binding.commit();
        });

        const newSlots = Object.fromEntries(binding['_memoizedSlots'] ?? []);

        expect(oldSlots).toStrictEqual({
          id: expect.objectContaining({
            dirty: false,
            committed: false,
          }),
          class: expect.objectContaining({
            dirty: false,
            committed: true,
            part: {
              type: PartType.Attribute,
              name: 'class',
              node: expect.exact(part.node),
            },
            value: props1.class,
          }),
          $open: expect.objectContaining({
            dirty: false,
            committed: false,
          }),
        });
        expect(newSlots).toStrictEqual(
          Object.fromEntries(
            Object.entries(props2)
              .filter(([_key, value]) => value !== undefined)
              .map(([key]) => [key, expect.any(MockSlot)]),
          ),
        );
        expect(newSlots).toStrictEqual({
          class: expect.objectContaining({
            dirty: false,
            committed: true,
            part: {
              type: PartType.Attribute,
              name: 'class',
              node: part.node,
            },
            value: props1.class,
          }),
          '.innerHTML': expect.objectContaining({
            dirty: false,
            committed: true,
            part: {
              type: PartType.Property,
              name: 'innerHTML',
              node: expect.exact(part.node),
              defaultValue: '',
            },
            value: props2['.innerHTML'],
          }),
          '@click': expect.objectContaining({
            dirty: false,
            committed: true,
            part: {
              type: PartType.Event,
              name: 'click',
              node: expect.exact(part.node),
            },
            value: props2['@click'],
          }),
        });
      }
    });
  });

  describe('disconnect()', () => {
    it('should do nothing if the committed properties does not exist', () => {
      const props = {};
      const part = {
        type: PartType.Element,
        node: document.createElement('div'),
      };
      const binding = new SpreadBinding(props, part);
      const updater = new TestUpdater();

      SESSION: {
        updater.startUpdate((session) => {
          binding.disconnect(session);
          binding.rollback();
        });

        expect(binding['_memoizedSlots']).toBe(null);
      }
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
      const updater = new TestUpdater();

      SESSION1: {
        updater.startUpdate((session) => {
          binding.connect(session);
          binding.commit();
        });

        const slots = Object.fromEntries(binding['_memoizedSlots'] ?? []);

        expect(slots).toStrictEqual(
          Object.fromEntries(
            Object.entries(props).map(([key]) => [key, expect.any(MockSlot)]),
          ),
        );
        expect(slots).toStrictEqual({
          id: expect.objectContaining({
            dirty: false,
            committed: true,
            part: {
              type: PartType.Attribute,
              name: 'id',
              node: expect.exact(part.node),
            },
            value: props.id,
          }),
          class: expect.objectContaining({
            dirty: false,
            committed: true,
            part: {
              type: PartType.Attribute,
              name: 'class',
              node: expect.exact(part.node),
            },
            value: props.class,
          }),
          $open: expect.objectContaining({
            dirty: false,
            committed: true,
            part: {
              type: PartType.Live,
              name: 'open',
              node: expect.exact(part.node),
              defaultValue: false,
            },
            value: props.$open,
          }),
          '.innerHTML': expect.objectContaining({
            dirty: false,
            committed: true,
            part: {
              type: PartType.Property,
              name: 'innerHTML',
              node: expect.exact(part.node),
              defaultValue: '',
            },
            value: props['.innerHTML'],
          }),
          '@click': expect.objectContaining({
            dirty: false,
            committed: true,
            part: {
              type: PartType.Event,
              name: 'click',
              node: expect.exact(part.node),
            },
            value: props['@click'],
          }),
        });
      }

      SESSION2: {
        const slots = Object.fromEntries(binding['_memoizedSlots'] ?? []);

        updater.startUpdate((session) => {
          binding.disconnect(session);
          binding.rollback();
        });

        expect(slots).toStrictEqual({
          id: expect.objectContaining({
            dirty: false,
            committed: false,
          }),
          class: expect.objectContaining({
            dirty: false,
            committed: false,
          }),
          $open: expect.objectContaining({
            dirty: false,
            committed: false,
          }),
          '.innerHTML': expect.objectContaining({
            dirty: false,
            committed: false,
          }),
          '@click': expect.objectContaining({
            dirty: false,
            committed: false,
          }),
        });
        expect(binding['_memoizedSlots']).toBe(null);
      }
    });
  });
});
