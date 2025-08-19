import { describe, expect, it, vi } from 'vitest';
import { DirectiveSpecifier } from '@/directive.js';
import { createHydrationTree } from '@/hydration.js';
import { PartType } from '@/internal.js';
import { Runtime } from '@/runtime.js';
import { Flexible, FlexibleSlot } from '@/slot/flexible.js';
import { HTML_NAMESPACE_URI } from '@/template/template.js';
import {
  MockBackend,
  MockBinding,
  MockDirective,
  MockPrimitive,
} from '../../mocks.js';

describe('Flexible()', () => {
  it('creates a SlotElement with FlexibleSlot', () => {
    const value = 'foo';
    const bindable = Flexible(value);

    expect(bindable.value).toBe(value);
    expect(bindable.slotType).toBe(FlexibleSlot);
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
      const value1 = new DirectiveSpecifier(new MockDirective(), 'foo');
      const value2 = new DirectiveSpecifier(new MockDirective(), 'bar');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new MockBinding(value1.type, value1.value, part);
      const slot = new FlexibleSlot(binding);
      const runtime = Runtime.create(new MockBackend());

      const shouldBindSpy = vi.spyOn(binding, 'shouldBind');
      const bindSpy = vi.spyOn(binding, 'bind');
      const connectSpy = vi.spyOn(binding, 'connect');
      const commitSpy = vi.spyOn(binding, 'commit');
      const debugValueSpy = vi.spyOn(runtime, 'debugValue');

      slot.reconcile(value2, runtime);
      slot.commit(runtime);

      expect(shouldBindSpy).toHaveBeenCalledOnce();
      expect(bindSpy).toHaveBeenCalledOnce();
      expect(bindSpy).toHaveBeenCalledWith(value2.value);
      expect(connectSpy).toHaveBeenCalledOnce();
      expect(connectSpy).toHaveBeenCalledWith(runtime);
      expect(commitSpy).toHaveBeenCalledOnce();
      expect(commitSpy).toHaveBeenCalledWith(runtime);
      expect(debugValueSpy).toHaveBeenCalledOnce();
      expect(debugValueSpy).toHaveBeenCalledWith(
        value2.type,
        value2.value,
        part,
      );
      expect(part.node.data).toBe(value2.value);
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
      const runtime = Runtime.create(new MockBackend());

      const bindSpy = vi.spyOn(binding, 'bind');
      const connectSpy = vi.spyOn(binding, 'connect');
      const disconnectSpy = vi.spyOn(binding, 'disconnect');
      const commitSpy = vi.spyOn(binding, 'commit');
      const rollbackSpy = vi.spyOn(binding, 'rollback');
      const debugValueSpy = vi.spyOn(runtime, 'debugValue');
      const undebugValueSpy = vi.spyOn(runtime, 'undebugValue');

      slot.connect(runtime);
      slot.commit(runtime);

      slot.reconcile(value2, runtime);
      slot.commit(runtime);

      slot.reconcile(value1, runtime);
      slot.commit(runtime);

      expect(bindSpy).toHaveBeenCalledOnce();
      expect(connectSpy).toHaveBeenCalledTimes(2);
      expect(connectSpy).toHaveBeenCalledWith(runtime);
      expect(disconnectSpy).toHaveBeenCalledOnce();
      expect(disconnectSpy).toHaveBeenCalledWith(runtime);
      expect(commitSpy).toHaveBeenCalledTimes(2);
      expect(commitSpy).toHaveBeenCalledWith(runtime);
      expect(rollbackSpy).toHaveBeenCalledOnce();
      expect(rollbackSpy).toHaveBeenCalledWith(runtime);
      expect(debugValueSpy).toHaveBeenCalledTimes(3);
      expect(debugValueSpy).toHaveBeenCalledWith(MockPrimitive, value1, part);
      expect(debugValueSpy).toHaveBeenCalledWith(
        value2.type,
        value2.value,
        part,
      );
      expect(undebugValueSpy).toHaveBeenCalledTimes(2);
      expect(undebugValueSpy).toHaveBeenCalledWith(MockPrimitive, value1, part);
      expect(undebugValueSpy).toHaveBeenCalledWith(
        value2.type,
        value2.value,
        part,
      );
      expect(slot['_pendingBinding']).toBe(binding);
      expect(slot['_pendingBinding']).toStrictEqual(
        expect.objectContaining({
          isConnected: true,
          isCommitted: true,
        }),
      );
      expect(part.node.data).toBe(value1);
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
      const runtime = Runtime.create(new MockBackend());

      const shouldBindSpy = vi
        .spyOn(binding, 'shouldBind')
        .mockReturnValue(false);
      const bindSpy = vi.spyOn(binding, 'bind');
      const connectSpy = vi.spyOn(binding, 'connect');
      const commitSpy = vi.spyOn(binding, 'commit');
      const debugValueSpy = vi.spyOn(runtime, 'debugValue');

      expect(slot.reconcile(value, runtime)).toBe(false);
      slot.commit(runtime);

      expect(shouldBindSpy).toHaveBeenCalledOnce();
      expect(bindSpy).not.toHaveBeenCalled();
      expect(connectSpy).not.toHaveBeenCalled();
      expect(commitSpy).not.toHaveBeenCalled();
      expect(debugValueSpy).not.toHaveBeenCalled();
      expect(part.node.data).toBe('');
    });
  });

  describe('hydrate()', () => {
    it('makes the binding able to commit', () => {
      const value = 'foo';
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new MockBinding(MockPrimitive, value, part);
      const slot = new FlexibleSlot(binding);
      const tree = createHydrationTree(document.createElement('div'));
      const runtime = Runtime.create(new MockBackend());

      const hydrateSpy = vi.spyOn(binding, 'hydrate');
      const commitSpy = vi.spyOn(binding, 'commit');
      const debugValueSpy = vi.spyOn(runtime, 'debugValue');

      slot.hydrate(tree, runtime);
      slot.commit(runtime);

      expect(hydrateSpy).toHaveBeenCalledOnce();
      expect(hydrateSpy).toHaveBeenCalledWith(tree, runtime);
      expect(commitSpy).toHaveBeenCalledOnce();
      expect(commitSpy).toHaveBeenCalledWith(runtime);
      expect(debugValueSpy).toHaveBeenCalledOnce();
      expect(debugValueSpy).toHaveBeenCalledWith(MockPrimitive, value, part);

      slot.commit(runtime);

      expect(commitSpy).toHaveBeenCalledOnce();
      expect(part.node.data).toBe(value);
    });
  });

  describe('connect()', () => {
    it('makes the binding able to commit', () => {
      const value = 'foo';
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new MockBinding(MockPrimitive, value, part);
      const slot = new FlexibleSlot(binding);
      const runtime = Runtime.create(new MockBackend());

      const connectSpy = vi.spyOn(binding, 'connect');
      const commitSpy = vi.spyOn(binding, 'commit');
      const debugValueSpy = vi.spyOn(runtime, 'debugValue');

      slot.connect(runtime);
      slot.commit(runtime);

      expect(connectSpy).toHaveBeenCalledOnce();
      expect(connectSpy).toHaveBeenCalledWith(runtime);
      expect(commitSpy).toHaveBeenCalledOnce();
      expect(commitSpy).toHaveBeenCalledWith(runtime);
      expect(debugValueSpy).toHaveBeenCalledOnce();
      expect(debugValueSpy).toHaveBeenCalledWith(MockPrimitive, value, part);

      slot.commit(runtime);

      expect(commitSpy).toHaveBeenCalledOnce();
      expect(debugValueSpy).toHaveBeenCalledOnce();
      expect(part.node.data).toBe(value);
    });
  });

  describe('disconnect()', () => {
    it('makes the binding able to rollback', () => {
      const value = 'foo';
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new MockBinding(MockPrimitive, value, part);
      const slot = new FlexibleSlot(binding);
      const runtime = Runtime.create(new MockBackend());

      const disconnectSpy = vi.spyOn(binding, 'disconnect');
      const rollbackSpy = vi.spyOn(binding, 'rollback');
      const undebugValueSpy = vi.spyOn(runtime, 'undebugValue');

      slot.connect(runtime);
      slot.commit(runtime);

      slot.disconnect(runtime);
      slot.rollback(runtime);

      expect(disconnectSpy).toHaveBeenCalledOnce();
      expect(disconnectSpy).toHaveBeenCalledWith(runtime);
      expect(rollbackSpy).toHaveBeenCalledOnce();
      expect(rollbackSpy).toHaveBeenCalledWith(runtime);
      expect(undebugValueSpy).toHaveBeenCalledOnce();
      expect(undebugValueSpy).toHaveBeenCalledWith(MockPrimitive, value, part);

      slot.rollback(runtime);

      expect(rollbackSpy).toHaveBeenCalledOnce();
      expect(undebugValueSpy).toHaveBeenCalledOnce();
      expect(part.node.data).toBe('');
    });

    it('not make the binding able to rollback if the binding is not committed', () => {
      const value = 'foo';
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new MockBinding(MockPrimitive, value, part);
      const slot = new FlexibleSlot(binding);
      const runtime = Runtime.create(new MockBackend());

      const disconnectSpy = vi.spyOn(binding, 'disconnect');
      const rollbackSpy = vi.spyOn(binding, 'rollback');
      const undebugValueSpy = vi.spyOn(runtime, 'undebugValue');

      slot.disconnect(runtime);
      slot.rollback(runtime);

      expect(disconnectSpy).toHaveBeenCalledOnce();
      expect(disconnectSpy).toHaveBeenCalledWith(runtime);
      expect(rollbackSpy).not.toHaveBeenCalled();
      expect(undebugValueSpy).not.toHaveBeenCalled();
      expect(part.node.data).toBe('');
    });
  });
});
