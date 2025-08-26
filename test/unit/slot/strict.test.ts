import { describe, expect, it, vi } from 'vitest';

import { DirectiveSpecifier } from '@/directive.js';
import { createHydrationTree } from '@/hydration.js';
import { PartType } from '@/internal.js';
import { Strict, StrictSlot } from '@/slot/strict.js';
import { HTML_NAMESPACE_URI } from '@/template/template.js';
import { MockBinding, MockDirective, MockPrimitive } from '../../mocks.js';
import { UpdateHelper } from '../../test-helpers.js';

describe('Strcit()', () => {
  it('creates a SlotElement with StrictSlot', () => {
    const value = 'foo';
    const bindable = Strict(value);

    expect(bindable.value).toBe(value);
    expect(bindable.type).toBe(StrictSlot);
  });
});

describe('StrictSlot', () => {
  describe('constructor()', () => {
    it('constructs a new StrictSlot from the binding', () => {
      const value = 'foo';
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new MockBinding(MockPrimitive, value, part);
      const slot = new StrictSlot(binding);

      expect(slot.type).toBe(MockPrimitive);
      expect(slot.value).toBe(value);
      expect(slot.part).toBe(part);
    });
  });

  describe('reconcile()', () => {
    it('updates the binding with a new value', () => {
      const value1 = 'foo';
      const value2 = 'bar';
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new MockBinding(MockPrimitive, value1, part);
      const slot = new StrictSlot(binding);
      const helper = new UpdateHelper();

      const shouldBindSpy = vi.spyOn(binding, 'shouldBind');
      const bindSpy = vi.spyOn(binding, 'bind');
      const connectSpy = vi.spyOn(binding, 'connect');
      const disconnectSpy = vi.spyOn(binding, 'disconnect');
      const commitSpy = vi.spyOn(binding, 'commit');
      const rollbackSpy = vi.spyOn(binding, 'rollback');

      SESSION1: {
        helper.startSession((context) => {
          slot.connect(context);
          slot.commit();
        });

        expect(shouldBindSpy).toHaveBeenCalledTimes(0);
        expect(bindSpy).toHaveBeenCalledTimes(0);
        expect(connectSpy).toHaveBeenCalledTimes(1);
        expect(disconnectSpy).toHaveBeenCalledTimes(0);
        expect(commitSpy).toHaveBeenCalledTimes(1);
        expect(rollbackSpy).toHaveBeenCalledTimes(0);
        expect(part.node.data).toBe('/MockPrimitive("foo")');
      }

      SESSION2: {
        const dirty = helper.startSession((context) => {
          const dirty = slot.reconcile(value2, context);
          slot.commit();
          slot.commit(); // ignore the second commit
          return dirty;
        });

        expect(shouldBindSpy).toHaveBeenCalledTimes(1);
        expect(bindSpy).toHaveBeenCalledTimes(1);
        expect(bindSpy).toHaveBeenCalledWith(value2);
        expect(connectSpy).toHaveBeenCalledTimes(2);
        expect(disconnectSpy).toHaveBeenCalledTimes(0);
        expect(commitSpy).toHaveBeenCalledTimes(2);
        expect(rollbackSpy).toHaveBeenCalledTimes(0);
        expect(part.node.data).toBe('/MockPrimitive("bar")');
        expect(dirty).toBe(true);
      }

      SESSION3: {
        helper.startSession((context) => {
          slot.disconnect(context);
          slot.rollback();
          slot.rollback(); // ignore the second rollback
        });

        expect(shouldBindSpy).toHaveBeenCalledTimes(1);
        expect(bindSpy).toHaveBeenCalledTimes(1);
        expect(bindSpy).toHaveBeenCalledWith(value2);
        expect(connectSpy).toHaveBeenCalledTimes(2);
        expect(disconnectSpy).toHaveBeenCalledTimes(1);
        expect(commitSpy).toHaveBeenCalledTimes(2);
        expect(rollbackSpy).toHaveBeenCalledTimes(1);
        expect(part.node.data).toBe('');
      }
    });

    it('updates the binding only if it is dirty', () => {
      const value = 'foo';
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new MockBinding(MockPrimitive, value, part);
      const slot = new StrictSlot(binding);
      const helper = new UpdateHelper();

      const shouldBindSpy = vi.spyOn(binding, 'shouldBind');
      const bindSpy = vi.spyOn(binding, 'bind');
      const connectSpy = vi.spyOn(binding, 'connect');
      const hydrateSpy = vi.spyOn(binding, 'hydrate');
      const commitSpy = vi.spyOn(binding, 'commit');

      SESSION1: {
        const target = createHydrationTree(document.createElement('div'));

        helper.startSession((context) => {
          slot.hydrate(target, context);
          slot.commit();
        });

        expect(shouldBindSpy).toHaveBeenCalledTimes(0);
        expect(bindSpy).toHaveBeenCalledTimes(0);
        expect(connectSpy).toHaveBeenCalledTimes(0);
        expect(hydrateSpy).toHaveBeenCalledTimes(1);
        expect(commitSpy).toHaveBeenCalledTimes(1);
        expect(part.node.data).toBe('/MockPrimitive("foo")');
      }

      SESSION2: {
        const dirty = helper.startSession((context) => {
          const dirty = slot.reconcile(value, context);
          slot.commit();
          return dirty;
        });

        expect(shouldBindSpy).toHaveBeenCalledTimes(1);
        expect(bindSpy).toHaveBeenCalledTimes(0);
        expect(connectSpy).toHaveBeenCalledTimes(0);
        expect(hydrateSpy).toHaveBeenCalledTimes(1);
        expect(commitSpy).toHaveBeenCalledTimes(1);
        expect(part.node.data).toBe('/MockPrimitive("foo")');
        expect(dirty).toBe(false);
      }
    });

    it('throws an error if the directive is mismatched', () => {
      const value1 = 'foo';
      const value2 = new DirectiveSpecifier(new MockDirective(), 'bar');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new MockBinding(MockPrimitive, value1, part);
      const slot = new StrictSlot(binding);
      const helper = new UpdateHelper();

      helper.startSession((context) => {
        slot.connect(context);
        slot.commit();
      });

      expect(() => {
        helper.startSession((context) => {
          slot.reconcile(value2, context);
        });
      }).toThrow(
        'The directive must be MockPrimitive in this slot, but got MockDirective.',
      );
    });
  });
});
