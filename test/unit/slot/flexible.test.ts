import { describe, expect, it, vi } from 'vitest';
import { DirectiveSpecifier } from '@/directive.js';
import { createHydrationTree } from '@/hydration.js';
import { PartType } from '@/internal.js';
import { Flexible, FlexibleSlot } from '@/slot/flexible.js';
import { HTML_NAMESPACE_URI } from '@/template/template.js';
import { MockBinding, MockDirective, MockPrimitive } from '../../mocks.js';
import { UpdateHelper } from '../../test-helpers.js';

describe('Flexible()', () => {
  it('creates a SlotElement with FlexibleSlot', () => {
    const value = 'foo';
    const bindable = Flexible(value);

    expect(bindable.value).toBe(value);
    expect(bindable.type).toBe(FlexibleSlot);
  });
});

describe('FlexibleSlot', () => {
  describe('constructor()', () => {
    it('constructs a new FlexibleSlot from the binding', () => {
      const value = 'foo';
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new MockBinding(MockPrimitive, value, part);
      const slot = new FlexibleSlot(binding);

      expect(slot.type).toBe(MockPrimitive);
      expect(slot.value).toBe(value);
      expect(slot.part).toBe(part);
    });
  });

  describe('reconcile()', () => {
    it('updates the binding with a same directive value', () => {
      const value1 = 'foo';
      const value2 = 'bar';
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new MockBinding(MockPrimitive, value1, part);
      const slot = new FlexibleSlot(binding);
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

    it('updates the binding with a different directive value', () => {
      const value1 = 'foo';
      const value2 = new DirectiveSpecifier(new MockDirective(), 'bar');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new MockBinding(MockPrimitive, value1, part);
      const slot = new FlexibleSlot(binding);
      const helper = new UpdateHelper();

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
      }

      SESSION2: {
        helper.startSession((context) => {
          slot.reconcile(value2, context);
          slot.commit();
        });
      }

      SESSION3: {
        helper.startSession((context) => {
          slot.reconcile(value1, context);
          slot.commit();
        });

        expect(bindSpy).toHaveBeenCalledOnce();
        expect(connectSpy).toHaveBeenCalledTimes(2);
        expect(disconnectSpy).toHaveBeenCalledOnce();
        expect(commitSpy).toHaveBeenCalledTimes(2);
        expect(rollbackSpy).toHaveBeenCalledOnce();
        expect(slot['_pendingBinding']).toBe(binding);
        expect(slot['_pendingBinding']).toStrictEqual(
          expect.objectContaining({
            isConnected: true,
            isCommitted: true,
          }),
        );
        expect(part.node.data).toBe('/MockPrimitive("foo")');
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
      const slot = new FlexibleSlot(binding);
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
  });
});
