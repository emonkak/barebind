import { describe, expect, it, vi } from 'vitest';
import { DirectiveObject } from '../../src/directive.js';
import { HydrationTree } from '../../src/hydration.js';
import { PartType } from '../../src/part.js';
import { MemoSlot, memo } from '../../src/slot/memo.js';
import { UpdateEngine } from '../../src/updateEngine.js';
import {
  MockBinding,
  MockDirective,
  MockPrimitive,
  MockRenderHost,
} from '../mocks.js';

describe('loose()', () => {
  it('creates a SlotElement with MemoSlot', () => {
    const value = 'foo';
    const object = memo(value);

    expect(object.value).toBe(value);
    expect(object.slotType).toBe(MemoSlot);
  });
});

describe('MemoSlot', () => {
  describe('constructor()', () => {
    it('constructs a new MemoSlot from the binding', () => {
      const value = 'foo';
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      } as const;
      const binding = new MockBinding(MockPrimitive, value, part);
      const slot = new MemoSlot(binding);

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
      const slot = new MemoSlot(binding);
      const context = new UpdateEngine(new MockRenderHost());

      const shouldBindSpy = vi.spyOn(binding, 'shouldBind');
      const bindSpy = vi.spyOn(binding, 'bind');
      const connectSpy = vi.spyOn(binding, 'connect');
      const commitSpy = vi.spyOn(binding, 'commit');

      slot.reconcile(value2, context);
      slot.commit();

      expect(shouldBindSpy).toHaveBeenCalledOnce();
      expect(bindSpy).toHaveBeenCalledOnce();
      expect(bindSpy).toHaveBeenCalledWith(value2);
      expect(connectSpy).toHaveBeenCalledOnce();
      expect(connectSpy).toHaveBeenCalledWith(context);
      expect(commitSpy).toHaveBeenCalledOnce();
    });

    it('updates the binding with a different directive value', () => {
      const value1 = 'foo';
      const value2 = 'bar';
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      } as const;
      const binding = new MockBinding(MockPrimitive, value1, part);
      const slot = new MemoSlot(binding);
      const context = new UpdateEngine(new MockRenderHost());

      const shouldBindSpy = vi.spyOn(binding, 'shouldBind');
      const bindSpy = vi.spyOn(binding, 'bind');
      const connectSpy = vi.spyOn(binding, 'connect');
      const disconnectSpy = vi.spyOn(binding, 'disconnect');
      const commitSpy = vi.spyOn(binding, 'commit');
      const rollbackSpy = vi.spyOn(binding, 'rollback');

      slot.connect(context);
      slot.commit();

      slot.reconcile(new DirectiveObject(new MockDirective(), value2), context);
      slot.commit();

      slot.reconcile(value1, context);
      slot.commit();

      expect(shouldBindSpy).toHaveBeenCalledOnce();
      expect(bindSpy).toHaveBeenCalledOnce();
      expect(connectSpy).toHaveBeenCalledTimes(2);
      expect(connectSpy).toHaveBeenCalledWith(context);
      expect(disconnectSpy).toHaveBeenCalledOnce();
      expect(disconnectSpy).toHaveBeenCalledWith(context);
      expect(commitSpy).toHaveBeenCalledTimes(2);
      expect(rollbackSpy).toHaveBeenCalledOnce();
      expect(slot['_pendingBinding']).toBe(binding);
      expect(slot['_pendingBinding']).toStrictEqual(
        expect.objectContaining({
          isConnected: true,
          isCommitted: true,
        }),
      );
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
      const slot = new MemoSlot(binding);
      const context = new UpdateEngine(new MockRenderHost());

      const shouldBindSpy = vi
        .spyOn(binding, 'shouldBind')
        .mockReturnValue(false);
      const bindSpy = vi.spyOn(binding, 'bind');
      const connectSpy = vi.spyOn(binding, 'connect');
      const commitSpy = vi.spyOn(binding, 'commit');

      slot.reconcile(value2, context);
      slot.commit();

      expect(shouldBindSpy).toHaveBeenCalledOnce();
      expect(bindSpy).not.toHaveBeenCalled();
      expect(connectSpy).not.toHaveBeenCalled();
      expect(commitSpy).not.toHaveBeenCalled();
    });
  });

  describe('commit()', () => {
    it('commit the binding if it is hydrated', () => {
      const value = 'foo';
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      } as const;
      const binding = new MockBinding(MockPrimitive, value, part);
      const slot = new MemoSlot(binding);
      const hydrationTree = new HydrationTree(document.createElement('div'));
      const context = new UpdateEngine(new MockRenderHost());

      const hydrateSpy = vi.spyOn(binding, 'hydrate');
      const commitSpy = vi.spyOn(binding, 'commit');

      slot.hydrate(hydrationTree, context);
      slot.commit();

      expect(hydrateSpy).toHaveBeenCalledOnce();
      expect(hydrateSpy).toHaveBeenCalledWith(hydrationTree, context);
      expect(commitSpy).toHaveBeenCalledOnce();

      slot.commit();

      expect(commitSpy).toHaveBeenCalledOnce();
    });

    it('commit the binding if it is connected', () => {
      const value = 'foo';
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      } as const;
      const binding = new MockBinding(MockPrimitive, value, part);
      const slot = new MemoSlot(binding);
      const context = new UpdateEngine(new MockRenderHost());

      const connectSpy = vi.spyOn(binding, 'connect');
      const commitSpy = vi.spyOn(binding, 'commit');

      slot.connect(context);
      slot.commit();

      expect(connectSpy).toHaveBeenCalledOnce();
      expect(connectSpy).toHaveBeenCalledWith(context);
      expect(commitSpy).toHaveBeenCalledOnce();

      slot.commit();

      expect(commitSpy).toHaveBeenCalledOnce();
    });
  });

  describe('rollback()', () => {
    it('rollbacks the binding if it is committed', () => {
      const value = 'foo';
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      } as const;
      const binding = new MockBinding(MockPrimitive, value, part);
      const slot = new MemoSlot(binding);
      const context = new UpdateEngine(new MockRenderHost());

      const disconnectSpy = vi.spyOn(binding, 'disconnect');
      const rollbackSpy = vi.spyOn(binding, 'rollback');

      slot.connect(context);
      slot.commit();

      slot.disconnect(context);
      slot.rollback();

      expect(disconnectSpy).toHaveBeenCalledOnce();
      expect(disconnectSpy).toHaveBeenCalledWith(context);
      expect(rollbackSpy).toHaveBeenCalledOnce();

      slot.rollback();

      expect(rollbackSpy).toHaveBeenCalledOnce();
    });

    it('does not rollback the binding if it is not committed', () => {
      const value = 'foo';
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      } as const;
      const binding = new MockBinding(MockPrimitive, value, part);
      const slot = new MemoSlot(binding);
      const context = new UpdateEngine(new MockRenderHost());

      const disconnectSpy = vi.spyOn(binding, 'disconnect');
      const rollbackSpy = vi.spyOn(binding, 'rollback');

      slot.disconnect(context);
      slot.rollback();

      expect(disconnectSpy).toHaveBeenCalledOnce();
      expect(disconnectSpy).toHaveBeenCalledWith(context);
      expect(rollbackSpy).not.toHaveBeenCalled();
    });
  });
});
