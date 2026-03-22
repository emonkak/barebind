import { describe, expect, it } from 'vitest';
import {
  PART_TYPE_ATTRIBUTE,
  PART_TYPE_EVENT,
  PART_TYPE_LIVE,
  PART_TYPE_PROPERTY,
} from '@/core.js';
import { createChildNodePart, createElementPart } from '@/part.js';
import { SpreadBinding, SpreadPrimitive } from '@/primitive/spread.js';
import { SLOT_STATUS_IDLE } from '@/slot.js';
import { createRuntime } from '../../mocks.js';
import { TestUpdater } from '../../test-updater.js';

describe('SpreadPrimitive', () => {
  describe('ensureValue()', () => {
    it('asserts the value is a object', () => {
      const part = createElementPart(document.createElement('div'));

      expect(() => {
        SpreadPrimitive.ensureValue!.call(
          SpreadPrimitive,
          { class: 'foo' },
          part,
        );
      }).not.toThrow();
    });

    it.for([
      null,
      undefined,
      'foo',
    ])('throws an error if the value is not object', (value) => {
      const part = createElementPart(document.createElement('div'));

      expect(() => {
        SpreadPrimitive.ensureValue!.call(SpreadPrimitive, value, part);
      }).toThrow('The value of SpreadPrimitive must be an object.');
    });
  });

  describe('resolveBinding()', () => {
    it('constructs a new SpreadBinding', () => {
      const props = { color: 'red' };
      const part = createElementPart(document.createElement('div'));
      const runtime = createRuntime();
      const binding = SpreadPrimitive.resolveBinding(props, part, runtime);

      expect(binding).toBeInstanceOf(SpreadBinding);
      expect(binding.type).toBe(SpreadPrimitive);
      expect(binding.value).toBe(props);
      expect(binding.part).toBe(part);
    });

    it('should throw the error if the part is not a element part', () => {
      const props = { class: 'foo' };
      const part = createChildNodePart(document.createComment(''), null);
      const runtime = createRuntime();

      expect(() =>
        SpreadPrimitive.resolveBinding(props, part, runtime),
      ).toThrow('SpreadPrimitive must be used in ElementPart.');
    });
  });
});

describe('SpreadBinding', () => {
  describe('shouldUpdate', () => {
    it('returns true if the committed value does not exist', () => {
      const props = { class: 'foo' };
      const part = createElementPart(document.createElement('div'));
      const binding = new SpreadBinding(props, part);

      expect(binding.shouldUpdate(props)).toBe(true);
    });

    it('returns true if the style has changed from the committed one', () => {
      const props1 = { class: 'foo' };
      const props2 = { id: 'bar' };
      const part = createElementPart(document.createElement('div'));
      const binding = new SpreadBinding(props1, part);
      const updater = new TestUpdater();

      updater.startUpdate((session) => {
        binding.attach(session);
        binding.commit();
      });

      expect(binding.shouldUpdate(props1)).toBe(false);
      expect(binding.shouldUpdate(props2)).toBe(true);
    });
  });

  describe('attach()', () => {
    it('request commits the corresponding slots for each properties', () => {
      const props1 = {
        id: 'foo',
        class: 'bar',
        title: undefined,
        $hidden: true,
      };
      const props2 = {
        id: undefined,
        class: 'bar',
        '.innerHTML': '<div>foo</div>',
        '@click': () => {},
      };
      const part = createElementPart(document.createElement('div'));
      const binding = new SpreadBinding(props1, part);
      const updater = new TestUpdater();

      SESSION1: {
        updater.startUpdate((session) => {
          binding.attach(session);
          binding.commit();
        });

        const slots = Object.fromEntries(binding['_memoizedSlots'] ?? []);

        expect(slots).toStrictEqual({
          id: expect.objectContaining({
            part: {
              type: PART_TYPE_ATTRIBUTE,
              name: 'id',
              node: expect.exact(part.node),
            },
            value: props1.id,
            status: SLOT_STATUS_IDLE,
          }),
          class: expect.objectContaining({
            part: {
              type: PART_TYPE_ATTRIBUTE,
              name: 'class',
              node: expect.exact(part.node),
            },
            value: props1.class,
            status: SLOT_STATUS_IDLE,
          }),
          $hidden: expect.objectContaining({
            part: {
              type: PART_TYPE_LIVE,
              name: 'hidden',
              node: expect.exact(part.node),
              defaultValue: false,
            },
            value: props1.$hidden,
            status: SLOT_STATUS_IDLE,
          }),
        });
      }

      SESSION2: {
        const oldSlots = Object.fromEntries(binding['_memoizedSlots'] ?? []);

        updater.startUpdate((session) => {
          binding.value = props2;
          binding.attach(session);
          binding.commit();
        });

        const newSlots = Object.fromEntries(binding['_memoizedSlots'] ?? []);

        expect(oldSlots).toStrictEqual({
          id: expect.objectContaining({
            status: SLOT_STATUS_IDLE,
          }),
          class: expect.objectContaining({
            part: {
              type: PART_TYPE_ATTRIBUTE,
              name: 'class',
              node: expect.exact(part.node),
            },
            value: props1.class,
            status: SLOT_STATUS_IDLE,
          }),
          $hidden: expect.objectContaining({
            status: SLOT_STATUS_IDLE,
          }),
        });
        expect(newSlots).toStrictEqual({
          class: expect.objectContaining({
            part: {
              type: PART_TYPE_ATTRIBUTE,
              name: 'class',
              node: part.node,
            },
            value: props1.class,
            status: SLOT_STATUS_IDLE,
          }),
          '.innerHTML': expect.objectContaining({
            part: {
              type: PART_TYPE_PROPERTY,
              name: 'innerHTML',
              node: expect.exact(part.node),
              defaultValue: '',
            },
            value: props2['.innerHTML'],
            status: SLOT_STATUS_IDLE,
          }),
          '@click': expect.objectContaining({
            part: {
              type: PART_TYPE_EVENT,
              name: 'click',
              node: expect.exact(part.node),
            },
            value: props2['@click'],
            status: SLOT_STATUS_IDLE,
          }),
        });
      }
    });
  });

  describe('detach()', () => {
    it('should do nothing if the committed properties does not exist', () => {
      const props = {};
      const part = createElementPart(document.createElement('div'));
      const binding = new SpreadBinding(props, part);
      const updater = new TestUpdater();

      SESSION: {
        updater.startUpdate((session) => {
          binding.detach(session);
          binding.rollback();
        });

        expect(binding['_memoizedSlots']).toBe(null);
      }
    });

    it('rollbacks the committed properties', () => {
      const props = {
        id: 'foo',
        class: 'bar',
        $hidden: true,
        '.innerHTML': '<div>foo</div>',
        '@click': () => {},
      };
      const part = createElementPart(document.createElement('div'));
      const binding = new SpreadBinding(props, part);
      const updater = new TestUpdater();

      SESSION1: {
        updater.startUpdate((session) => {
          binding.attach(session);
          binding.commit();
        });

        const slots = Object.fromEntries(binding['_memoizedSlots'] ?? []);

        expect(slots).toStrictEqual({
          id: expect.objectContaining({
            part: {
              type: PART_TYPE_ATTRIBUTE,
              name: 'id',
              node: expect.exact(part.node),
            },
            value: props.id,
            status: SLOT_STATUS_IDLE,
          }),
          class: expect.objectContaining({
            part: {
              type: PART_TYPE_ATTRIBUTE,
              name: 'class',
              node: expect.exact(part.node),
            },
            value: props.class,
            status: SLOT_STATUS_IDLE,
          }),
          $hidden: expect.objectContaining({
            part: {
              type: PART_TYPE_LIVE,
              name: 'hidden',
              node: expect.exact(part.node),
              defaultValue: false,
            },
            value: props.$hidden,
            status: SLOT_STATUS_IDLE,
          }),
          '.innerHTML': expect.objectContaining({
            part: {
              type: PART_TYPE_PROPERTY,
              name: 'innerHTML',
              node: expect.exact(part.node),
              defaultValue: '',
            },
            value: props['.innerHTML'],
            status: SLOT_STATUS_IDLE,
          }),
          '@click': expect.objectContaining({
            part: {
              type: PART_TYPE_EVENT,
              name: 'click',
              node: expect.exact(part.node),
            },
            value: props['@click'],
            status: SLOT_STATUS_IDLE,
          }),
        });
      }

      SESSION2: {
        const slots = Object.fromEntries(binding['_memoizedSlots'] ?? []);

        updater.startUpdate((session) => {
          binding.detach(session);
          binding.rollback();
        });

        expect(slots).toStrictEqual({
          id: expect.objectContaining({
            status: SLOT_STATUS_IDLE,
          }),
          class: expect.objectContaining({
            status: SLOT_STATUS_IDLE,
          }),
          $hidden: expect.objectContaining({
            status: SLOT_STATUS_IDLE,
          }),
          '.innerHTML': expect.objectContaining({
            status: SLOT_STATUS_IDLE,
          }),
          '@click': expect.objectContaining({
            status: SLOT_STATUS_IDLE,
          }),
        });
        expect(binding['_memoizedSlots']).toBe(null);
      }
    });
  });
});
