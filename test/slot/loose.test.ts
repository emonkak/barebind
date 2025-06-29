import { describe, expect, it, vi } from 'vitest';
import { createDirectiveObject } from '../../src/directive.js';
import { HydrationTree } from '../../src/hydration.js';
import { PartType } from '../../src/part.js';
import { LooseSlot, loose } from '../../src/slot/loose.js';
import { UpdateEngine } from '../../src/updateEngine.js';
import {
  MockBinding,
  MockDirective,
  MockPrimitive,
  MockRenderHost,
} from '../mocks.js';

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
      const context = new UpdateEngine(new MockRenderHost());

      const shouldBindSpy = vi.spyOn(binding, 'shouldBind');
      const bindSpy = vi.spyOn(binding, 'bind');
      const connectSpy = vi.spyOn(binding, 'connect');
      const commitSpy = vi.spyOn(binding, 'commit');
      const debugValueSpy = vi.spyOn(context, 'debugValue');

      slot.reconcile(value2, context);
      slot.commit(context);

      expect(shouldBindSpy).toHaveBeenCalledOnce();
      expect(bindSpy).toHaveBeenCalledOnce();
      expect(bindSpy).toHaveBeenCalledWith(value2);
      expect(connectSpy).toHaveBeenCalledOnce();
      expect(connectSpy).toHaveBeenCalledWith(context);
      expect(commitSpy).toHaveBeenCalledOnce();
      expect(commitSpy).toHaveBeenCalledWith(context);
      expect(debugValueSpy).toHaveBeenCalledOnce();
      expect(debugValueSpy).toHaveBeenCalledWith(MockPrimitive, value2, part);
      expect(part.node.data).toBe(value2);
    });

    it('updates the binding with a different directive value', () => {
      const value1 = 'foo';
      const value2 = createDirectiveObject(new MockDirective(), 'bar');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      } as const;
      const binding = new MockBinding(MockPrimitive, value1, part);
      const slot = new LooseSlot(binding);
      const context = new UpdateEngine(new MockRenderHost());

      const shouldBindSpy = vi.spyOn(binding, 'shouldBind');
      const bindSpy = vi.spyOn(binding, 'bind');
      const connectSpy = vi.spyOn(binding, 'connect');
      const disconnectSpy = vi.spyOn(binding, 'disconnect');
      const commitSpy = vi.spyOn(binding, 'commit');
      const rollbackSpy = vi.spyOn(binding, 'rollback');
      const debugValueSpy = vi.spyOn(context, 'debugValue');
      const undebugValueSpy = vi.spyOn(context, 'undebugValue');

      slot.connect(context);
      slot.commit(context);

      slot.reconcile(value2, context);
      slot.commit(context);

      expect(shouldBindSpy).not.toHaveBeenCalled();
      expect(bindSpy).not.toHaveBeenCalled();
      expect(connectSpy).toHaveBeenCalledOnce();
      expect(connectSpy).toHaveBeenCalledWith(context);
      expect(disconnectSpy).toHaveBeenCalledOnce();
      expect(disconnectSpy).toHaveBeenCalledWith(context);
      expect(commitSpy).toHaveBeenCalledOnce();
      expect(commitSpy).toHaveBeenCalledWith(context);
      expect(rollbackSpy).toHaveBeenCalledOnce();
      expect(rollbackSpy).toHaveBeenCalledWith(context);
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
      expect(slot['_pendingBinding']).toStrictEqual(
        expect.objectContaining({
          isConnected: true,
          isCommitted: true,
        }),
      );
      expect(part.node.data).toBe(value2.value);
    });

    it('does not updates the value of the binding if shouldUpdate() returns false', () => {
      const value1 = 'foo';
      const value2 = 'bar';
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      } as const;
      const binding = new MockBinding(MockPrimitive, value1, part);
      const slot = new LooseSlot(binding);
      const context = new UpdateEngine(new MockRenderHost());

      const shouldBindSpy = vi
        .spyOn(binding, 'shouldBind')
        .mockReturnValue(false);
      const bindSpy = vi.spyOn(binding, 'bind');
      const connectSpy = vi.spyOn(binding, 'connect');
      const commitSpy = vi.spyOn(binding, 'commit');
      const debugValueSpy = vi.spyOn(context, 'debugValue');

      slot.reconcile(value2, context);
      slot.commit(context);

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
      const context = new UpdateEngine(new MockRenderHost());

      const hydrateSpy = vi.spyOn(binding, 'hydrate');
      const commitSpy = vi.spyOn(binding, 'commit');
      const debugValueSpy = vi.spyOn(context, 'debugValue');

      slot.hydrate(hydrationTree, context);
      slot.commit(context);

      expect(hydrateSpy).toHaveBeenCalledOnce();
      expect(hydrateSpy).toHaveBeenCalledWith(hydrationTree, context);
      expect(commitSpy).toHaveBeenCalledOnce();
      expect(commitSpy).toHaveBeenCalledWith(context);
      expect(debugValueSpy).toHaveBeenCalledOnce();
      expect(debugValueSpy).toHaveBeenCalledWith(MockPrimitive, value, part);

      slot.commit(context);

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
      const context = new UpdateEngine(new MockRenderHost());

      const connectSpy = vi.spyOn(binding, 'connect');
      const commitSpy = vi.spyOn(binding, 'commit');
      const debugValueSpy = vi.spyOn(context, 'debugValue');

      slot.connect(context);
      slot.commit(context);

      expect(connectSpy).toHaveBeenCalledOnce();
      expect(connectSpy).toHaveBeenCalledWith(context);
      expect(commitSpy).toHaveBeenCalledOnce();
      expect(commitSpy).toHaveBeenCalledWith(context);
      expect(debugValueSpy).toHaveBeenCalledOnce();
      expect(debugValueSpy).toHaveBeenCalledWith(MockPrimitive, value, part);

      slot.commit(context);

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
      const context = new UpdateEngine(new MockRenderHost());

      const disconnectSpy = vi.spyOn(binding, 'disconnect');
      const rollbackSpy = vi.spyOn(binding, 'rollback');
      const undebugValueSpy = vi.spyOn(context, 'undebugValue');

      slot.connect(context);
      slot.commit(context);

      slot.disconnect(context);
      slot.rollback(context);

      expect(disconnectSpy).toHaveBeenCalledOnce();
      expect(disconnectSpy).toHaveBeenCalledWith(context);
      expect(rollbackSpy).toHaveBeenCalledOnce();
      expect(rollbackSpy).toHaveBeenCalledWith(context);
      expect(undebugValueSpy).toHaveBeenCalledOnce();
      expect(undebugValueSpy).toHaveBeenCalledWith(MockPrimitive, value, part);

      slot.rollback(context);

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
      const context = new UpdateEngine(new MockRenderHost());

      const disconnectSpy = vi.spyOn(binding, 'disconnect');
      const rollbackSpy = vi.spyOn(binding, 'rollback');
      const undebugValueSpy = vi.spyOn(context, 'undebugValue');

      slot.disconnect(context);
      slot.rollback(context);

      expect(disconnectSpy).toHaveBeenCalledOnce();
      expect(disconnectSpy).toHaveBeenCalledWith(context);
      expect(rollbackSpy).not.toHaveBeenCalled();
      expect(undebugValueSpy).not.toHaveBeenCalled();
      expect(part.node.data).toBe('');
    });
  });
});
