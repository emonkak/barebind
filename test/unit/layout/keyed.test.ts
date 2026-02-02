import { describe, expect, it, vi } from 'vitest';

import { DirectiveSpecifier } from '@/directive.js';
import { PartType } from '@/internal.js';
import { Keyed, KeyedLayout, KeyedSlot } from '@/layout/keyed.js';
import { HTML_NAMESPACE_URI } from '@/template/template.js';
import { MockBinding, MockDirective, MockPrimitive } from '../../mocks.js';
import { TestUpdater } from '../../test-updater.js';

describe('Keyed()', () => {
  it('creates a LayoutSpecifier with KeyedLayout', () => {
    const source = 'bar';
    const key = 123;
    const bindable = Keyed(source, key);

    expect(bindable.source).toBe(source);
    expect(bindable.layout).toBeInstanceOf(KeyedLayout);
    expect((bindable.layout as KeyedLayout<string>).key).toBe(key);
  });
});

describe('KeyedLayout', () => {
  it('returns the name of the class', () => {
    const layout = new KeyedLayout('foo');
    expect(layout.name).toBe(KeyedLayout.name);
  });

  describe('placeBinding()', () => {
    it('constructs a new KeyedSlot', () => {
      const value = 'foo';
      const key = 123;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new MockBinding(MockPrimitive, value, part);
      const slot = new KeyedLayout(key).placeBinding(binding);

      expect(slot.type).toBe(MockPrimitive);
      expect(slot.value).toBe(value);
      expect(slot.part).toBe(part);
    });
  });
});

describe('KeyedSlot', () => {
  describe('reconcile()', () => {
    it('updates the binding with the same key and the same directive type', () => {
      const source1 = 'foo';
      const source2 = 'bar';
      const key = 123;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new MockBinding(MockPrimitive, source1, part);
      const slot = new KeyedSlot(binding, key);
      const updater = new TestUpdater();

      const shouldUpdateSpy = vi.spyOn(binding, 'shouldUpdate');
      const attachSpy = vi.spyOn(binding, 'attach');
      const requestRollbackSpy = vi.spyOn(binding, 'detach');
      const commitSpy = vi.spyOn(binding, 'commit');
      const rollbackSpy = vi.spyOn(binding, 'rollback');

      SESSION1: {
        updater.startUpdate((session) => {
          slot.attach(session);
          slot.commit();
        });

        expect(shouldUpdateSpy).toHaveBeenCalledTimes(0);
        expect(attachSpy).toHaveBeenCalledTimes(1);
        expect(requestRollbackSpy).toHaveBeenCalledTimes(0);
        expect(commitSpy).toHaveBeenCalledTimes(1);
        expect(rollbackSpy).toHaveBeenCalledTimes(0);
        expect(part.node.data).toBe('/MockPrimitive("foo")');
      }

      SESSION2: {
        const dirty = updater.startUpdate((session) => {
          const dirty = slot.reconcile(Keyed(source2, key), session);
          slot.commit();
          slot.commit(); // ignore the second commit
          return dirty;
        });

        expect(shouldUpdateSpy).toHaveBeenCalledTimes(1);
        expect(attachSpy).toHaveBeenCalledTimes(2);
        expect(requestRollbackSpy).toHaveBeenCalledTimes(0);
        expect(commitSpy).toHaveBeenCalledTimes(2);
        expect(rollbackSpy).toHaveBeenCalledTimes(0);
        expect(part.node.data).toBe('/MockPrimitive("bar")');
        expect(dirty).toBe(true);
      }

      SESSION3: {
        updater.startUpdate((session) => {
          slot.detach(session);
          slot.rollback();
          slot.rollback(); // ignore the second rollback
        });

        expect(shouldUpdateSpy).toHaveBeenCalledTimes(1);
        expect(attachSpy).toHaveBeenCalledTimes(2);
        expect(requestRollbackSpy).toHaveBeenCalledTimes(1);
        expect(commitSpy).toHaveBeenCalledTimes(2);
        expect(rollbackSpy).toHaveBeenCalledTimes(1);
        expect(part.node.data).toBe('');
      }
    });

    it('updates the binding with a different key', () => {
      const source1 = 'foo';
      const source2 = 'bar';
      const key1 = 123;
      const key2 = 456;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new MockBinding(MockPrimitive, source1, part);
      const slot = new KeyedSlot(binding, key1);
      const updater = new TestUpdater();

      const shouldUpdateSpy = vi.spyOn(binding, 'shouldUpdate');
      const attachSpy = vi.spyOn(binding, 'attach');
      const requestRollbackSpy = vi.spyOn(binding, 'detach');
      const commitSpy = vi.spyOn(binding, 'commit');
      const rollbackSpy = vi.spyOn(binding, 'rollback');

      SESSION1: {
        updater.startUpdate((session) => {
          slot.attach(session);
          slot.commit();
        });
      }

      SESSION2: {
        const dirty = updater.startUpdate((session) => {
          const dirty = slot.reconcile(Keyed(source2, key2), session);
          slot.commit();
          return dirty;
        });

        expect(shouldUpdateSpy).not.toHaveBeenCalled();
        expect(attachSpy).toHaveBeenCalledOnce();
        expect(requestRollbackSpy).toHaveBeenCalledOnce();
        expect(commitSpy).toHaveBeenCalledOnce();
        expect(rollbackSpy).toHaveBeenCalledOnce();
        expect(slot['_pendingBinding']).not.toBe(binding);
        expect(slot['_pendingBinding']).toBeInstanceOf(MockBinding);
        expect(slot['_pendingBinding']).toStrictEqual(
          expect.objectContaining({
            dirty: false,
            committed: true,
          }),
        );
        expect(part.node.data).toBe('/MockPrimitive("bar")');
        expect(dirty).toBe(true);
      }
    });

    it('updates the binding only if it is dirty', () => {
      const source = 'foo';
      const key = 123;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new MockBinding(MockPrimitive, source, part);
      const slot = new KeyedSlot(binding, key);
      const updater = new TestUpdater();

      const shouldUpdateSpy = vi.spyOn(binding, 'shouldUpdate');
      const attachSpy = vi.spyOn(binding, 'attach');
      const commitSpy = vi.spyOn(binding, 'commit');

      SESSION1: {
        updater.startUpdate((session) => {
          slot.attach(session);
          slot.commit();
        });

        expect(shouldUpdateSpy).toHaveBeenCalledTimes(0);
        expect(attachSpy).toHaveBeenCalledTimes(1);
        expect(commitSpy).toHaveBeenCalledTimes(1);
        expect(part.node.data).toBe('/MockPrimitive("foo")');
      }

      SESSION2: {
        updater.startUpdate((session) => {
          slot.reconcile(Keyed(source, key), session) && slot.commit();
        });

        expect(shouldUpdateSpy).toHaveBeenCalledTimes(1);
        expect(attachSpy).toHaveBeenCalledTimes(1);
        expect(commitSpy).toHaveBeenCalledTimes(1);
        expect(part.node.data).toBe('/MockPrimitive("foo")');
      }
    });

    it('throws an error if the keys match but the directive types are missmatched', () => {
      const source1 = 'bar';
      const source2 = new DirectiveSpecifier(new MockDirective(), 'baz');
      const key = 'foo';
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new MockBinding(MockPrimitive, source1, part);
      const slot = new KeyedSlot(binding, key);
      const updater = new TestUpdater();

      updater.startUpdate((session) => {
        slot.attach(session);
        slot.commit();
      });

      expect(() => {
        updater.startUpdate((session) => {
          slot.reconcile(Keyed(source2, key), session);
        });
      }).toThrow(
        'The directive type must be MockPrimitive in the slot, but got MockDirective.',
      );
    });
  });
});
