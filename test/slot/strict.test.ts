import { describe, expect, it, vi } from 'vitest';
import { createDirectiveObject } from '../../src/directive.js';
import { HydrationTree } from '../../src/hydration.js';
import { PartType } from '../../src/part.js';
import { StrictSlot, strict } from '../../src/slot/strict.js';
import { UpdateEngine } from '../../src/updateEngine.js';
import {
  MockBinding,
  MockDirective,
  MockPrimitive,
  MockRenderHost,
} from '../mocks.js';

describe('strcit()', () => {
  it('creates a SlotElement with StrictSlot', () => {
    const value = 'foo';
    const object = strict(value);

    expect(object.value).toBe(value);
    expect(object.slotType).toBe(StrictSlot);
  });
});

describe('StrictSlot', () => {
  describe('constructor()', () => {
    it('constructs a new StrictSlot from the binding', () => {
      const value = 'foo';
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      } as const;
      const binding = new MockBinding(MockPrimitive, value, part);
      const slot = new StrictSlot(binding);

      expect(slot.directive).toBe(MockPrimitive);
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
        childNode: null,
      } as const;
      const binding = new MockBinding(MockPrimitive, value1, part);
      const slot = new StrictSlot(binding);
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

    it('does not updates the binding with a new value if shouldUpdate() returns false', () => {
      const value1 = 'foo';
      const value2 = 'bar';
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      } as const;
      const binding = new MockBinding(MockPrimitive, value1, part);
      const slot = new StrictSlot(binding);
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

    it('throws the error if the directive is mismatched', () => {
      const value1 = 'foo';
      const value2 = createDirectiveObject(new MockDirective(), 'bar');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      } as const;
      const binding = new MockBinding(MockPrimitive, value1, part);
      const slot = new StrictSlot(binding);
      const context = new UpdateEngine(new MockRenderHost());

      expect(() => {
        slot.reconcile(value2, context);
      }).toThrow(
        'The directive must be MockPrimitive in this slot, but got MockDirective.',
      );
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
      const slot = new StrictSlot(binding);
      const context = new UpdateEngine(new MockRenderHost());
      const hydrationTree = new HydrationTree(document.createElement('div'));

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

  describe('connect()', () => {
    it('makes the binding able to commit', () => {
      const value = 'foo';
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      } as const;
      const binding = new MockBinding(MockPrimitive, value, part);
      const slot = new StrictSlot(binding);
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
      const slot = new StrictSlot(binding);
      const context = new UpdateEngine(new MockRenderHost());

      const disconnectSpy = vi.spyOn(binding, 'disconnect');
      const rollbackSpy = vi.spyOn(binding, 'rollback');
      const undebugValueSpy = vi.spyOn(context, 'undebugValue');

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
  });
});
