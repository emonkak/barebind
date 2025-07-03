import { describe, expect, it, vi } from 'vitest';

import { DirectiveObject } from '@/directive.js';
import { HydrationTree } from '@/hydration.js';
import { PartType } from '@/part.js';
import { Runtime } from '@/runtime.js';
import { LooseSlot, loose } from '@/slot/loose.js';
import {
  MockBinding,
  MockDirective,
  MockPrimitive,
  MockRenderHost,
} from '../../mocks.js';

describe('loose()', () => {
  it('creates a DirectiveInstance with LooseSlot', () => {
    const value = 'foo';
    const object = loose(value);

    expect(object.value).toBe(value);
    expect(object.slotType).toBe(LooseSlot);
  });
});

describe('LooseSlot', () => {
  describe('constructor()', () => {
    it('constructs a new LooseSlot from the binding', () => {
      const value = 'foo';
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      } as const;
      const binding = new MockBinding(MockPrimitive, value, part);
      const slot = new LooseSlot(binding);

      expect(slot.directive).toBe(MockPrimitive);
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
        childNode: null,
      } as const;
      const binding = new MockBinding(MockPrimitive, value1, part);
      const slot = new LooseSlot(binding);
      const runtime = new Runtime(new MockRenderHost());

      const shouldBindSpy = vi.spyOn(binding, 'shouldBind');
      const bindSpy = vi.spyOn(binding, 'bind');
      const connectSpy = vi.spyOn(binding, 'connect');
      const commitSpy = vi.spyOn(binding, 'commit');
      const debugValueSpy = vi.spyOn(runtime, 'debugValue');

      slot.reconcile(value2, runtime);
      slot.commit(runtime);

      expect(shouldBindSpy).toHaveBeenCalledOnce();
      expect(bindSpy).toHaveBeenCalledOnce();
      expect(bindSpy).toHaveBeenCalledWith(value2);
      expect(connectSpy).toHaveBeenCalledOnce();
      expect(connectSpy).toHaveBeenCalledWith(runtime);
      expect(commitSpy).toHaveBeenCalledOnce();
      expect(commitSpy).toHaveBeenCalledWith(runtime);
      expect(debugValueSpy).toHaveBeenCalledOnce();
      expect(debugValueSpy).toHaveBeenCalledWith(MockPrimitive, value2, part);
      expect(part.node.data).toBe(value2);
    });

    it('updates the binding with a different directive value', () => {
      const value1 = 'foo';
      const value2 = new DirectiveObject(new MockDirective(), 'bar');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      } as const;
      const binding = new MockBinding(MockPrimitive, value1, part);
      const slot = new LooseSlot(binding);
      const runtime = new Runtime(new MockRenderHost());

      const shouldBindSpy = vi.spyOn(binding, 'shouldBind');
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

      expect(shouldBindSpy).not.toHaveBeenCalled();
      expect(bindSpy).not.toHaveBeenCalled();
      expect(connectSpy).toHaveBeenCalledOnce();
      expect(connectSpy).toHaveBeenCalledWith(runtime);
      expect(disconnectSpy).toHaveBeenCalledOnce();
      expect(disconnectSpy).toHaveBeenCalledWith(runtime);
      expect(commitSpy).toHaveBeenCalledOnce();
      expect(commitSpy).toHaveBeenCalledWith(runtime);
      expect(rollbackSpy).toHaveBeenCalledOnce();
      expect(rollbackSpy).toHaveBeenCalledWith(runtime);
      expect(debugValueSpy).toHaveBeenCalledTimes(2);
      expect(debugValueSpy).toHaveBeenCalledWith(MockPrimitive, value1, part);
      expect(debugValueSpy).toHaveBeenCalledWith(
        value2.directive,
        value2.value,
        part,
      );
      expect(undebugValueSpy).toHaveBeenCalledOnce();
      expect(undebugValueSpy).toHaveBeenCalledWith(MockPrimitive, value1, part);
      expect(slot['_pendingBinding']).not.toBe(binding);
      expect(slot['_pendingBinding']).toBeInstanceOf(MockBinding);
      expect(slot['_pendingBinding']).toStrictEqual(
        expect.objectContaining({
          isConnected: true,
          isCommitted: true,
        }),
      );
      expect(part.node.data).toBe(value2.value);
    });

    it('does not updates the value of the binding if shouldBind() returns false', () => {
      const value1 = 'foo';
      const value2 = 'bar';
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      } as const;
      const binding = new MockBinding(MockPrimitive, value1, part);
      const slot = new LooseSlot(binding);
      const runtime = new Runtime(new MockRenderHost());

      const shouldBindSpy = vi
        .spyOn(binding, 'shouldBind')
        .mockReturnValue(false);
      const bindSpy = vi.spyOn(binding, 'bind');
      const connectSpy = vi.spyOn(binding, 'connect');
      const commitSpy = vi.spyOn(binding, 'commit');
      const debugValueSpy = vi.spyOn(runtime, 'debugValue');

      slot.reconcile(value2, runtime);
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
        childNode: null,
      } as const;
      const binding = new MockBinding(MockPrimitive, value, part);
      const slot = new LooseSlot(binding);
      const hydrationTree = new HydrationTree(document.createElement('div'));
      const runtime = new Runtime(new MockRenderHost());

      const hydrateSpy = vi.spyOn(binding, 'hydrate');
      const commitSpy = vi.spyOn(binding, 'commit');
      const debugValueSpy = vi.spyOn(runtime, 'debugValue');

      slot.hydrate(hydrationTree, runtime);
      slot.commit(runtime);

      expect(hydrateSpy).toHaveBeenCalledOnce();
      expect(hydrateSpy).toHaveBeenCalledWith(hydrationTree, runtime);
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

  describe('coonect()', () => {
    it('makes the binding able to commit', () => {
      const value = 'foo';
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      } as const;
      const binding = new MockBinding(MockPrimitive, value, part);
      const slot = new LooseSlot(binding);
      const runtime = new Runtime(new MockRenderHost());

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
      expect(part.node.data).toBe(value);
    });
  });

  describe('disconnect()', () => {
    it('makes the binding able to rollback', () => {
      const value = 'foo';
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      } as const;
      const binding = new MockBinding(MockPrimitive, value, part);
      const slot = new LooseSlot(binding);
      const runtime = new Runtime(new MockRenderHost());

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
      expect(part.node.data).toBe('');
    });

    it('not make the binding able to rollback if the binding is not committed', () => {
      const value = 'foo';
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      } as const;
      const binding = new MockBinding(MockPrimitive, value, part);
      const slot = new LooseSlot(binding);
      const runtime = new Runtime(new MockRenderHost());

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
