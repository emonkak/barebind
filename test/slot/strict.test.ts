import { describe, expect, it, vi } from 'vitest';
import { DirectiveObject } from '../../src/directive.js';
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

      slot.reconcile(value2, context);
      slot.commit();

      expect(shouldBindSpy).toHaveBeenCalledOnce();
      expect(bindSpy).toHaveBeenCalledOnce();
      expect(bindSpy).toHaveBeenCalledWith(value2);
      expect(connectSpy).toHaveBeenCalledOnce();
      expect(connectSpy).toHaveBeenCalledWith(context);
      expect(commitSpy).toHaveBeenCalledOnce();
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

      slot.reconcile(value2, context);
      slot.commit();

      expect(shouldBindSpy).toHaveBeenCalledOnce();
      expect(bindSpy).not.toHaveBeenCalled();
      expect(connectSpy).not.toHaveBeenCalled();
      expect(commitSpy).not.toHaveBeenCalled();
    });

    it('throws the error if the directive is mismatched', () => {
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

      expect(() => {
        slot.reconcile(
          new DirectiveObject(new MockDirective(), value2),
          context,
        );
      }).toThrow(
        'The directive must be MockPrimitive in this slot, but got MockDirective.',
      );
    });
  });

  describe('commit()', () => {
    it('commits the binding if it is connected', () => {
      const value = 'foo';
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      } as const;
      const binding = new MockBinding(MockPrimitive, value, part);
      const slot = new StrictSlot(binding);
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

    it('commits the binding if it is hydrated', () => {
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
    it('rollback the binding it is disconnected', () => {
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

      slot.disconnect(context);
      slot.rollback();

      expect(disconnectSpy).toHaveBeenCalledOnce();
      expect(disconnectSpy).toHaveBeenCalledWith(context);
      expect(rollbackSpy).toHaveBeenCalledOnce();

      slot.rollback();

      expect(rollbackSpy).toHaveBeenCalledOnce();
    });
  });
});
