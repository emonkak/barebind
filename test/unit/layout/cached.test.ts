import { describe, expect, it, vi } from 'vitest';
import { PartType } from '@/internal.js';
import { Cached, CachedLayout, CachedSlot } from '@/layout/cached.js';
import { DefaultLayout } from '@/layout/layout.js';
import { HTML_NAMESPACE_URI } from '@/template/template.js';
import {
  MockBinding,
  MockLayout,
  MockPrimitive,
  MockSlot,
} from '../../mocks.js';
import { TestUpdater } from '../../test-updater.js';

describe('Cached()', () => {
  it('creates a new KeySpecifier with the source and the key', () => {
    const source = 'foo';
    const key = 123;
    const bindable = Cached(source, key);

    expect(bindable.source).toBe(source);
    expect(bindable.layout).toStrictEqual(new CachedLayout(key, DefaultLayout));
  });
});

describe('CachedLayout', () => {
  describe('name', () => {
    it('returns the name of the class', () => {
      const layout = new CachedLayout('foo', new MockLayout());
      expect(layout.name).toBe(CachedLayout.name);
    });
  });

  describe('compose()', () => {
    it('creates a new CachedLayout with the layout', () => {
      const layout = new CachedLayout('foo', DefaultLayout).compose(
        new MockLayout(),
      );
      expect(layout).toStrictEqual(new CachedLayout('foo', new MockLayout()));
    });
  });

  describe('placeBinding()', () => {
    it('constructs a new CachedSlot', () => {
      const value = 'foo';
      const key = 123;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new MockBinding(MockPrimitive, value, part);
      const slot = new CachedLayout(key, new MockLayout()).placeBinding(
        binding,
        new MockLayout(),
      );

      expect(slot.type).toBe(binding.type);
      expect(slot.value).toBe(binding.value);
      expect(slot.part).toBe(binding.part);
    });
  });
});

describe('CachedSlot', () => {
  describe('reconcile()', () => {
    it('updates the binding with the same key', () => {
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
      const innerSlot = new MockSlot(binding);
      const slot = new CachedSlot(innerSlot, key);
      const updater = new TestUpdater();

      const reconcileSpy = vi.spyOn(innerSlot, 'reconcile');
      const attachSpy = vi.spyOn(innerSlot, 'attach');
      const detachSpy = vi.spyOn(innerSlot, 'detach');
      const commitSpy = vi.spyOn(innerSlot, 'commit');
      const rollbackSpy = vi.spyOn(innerSlot, 'rollback');

      SESSION1: {
        updater.startUpdate((session) => {
          slot.attach(session);
          slot.commit();
        });

        expect(reconcileSpy).toHaveBeenCalledTimes(0);
        expect(attachSpy).toHaveBeenCalledTimes(1);
        expect(detachSpy).toHaveBeenCalledTimes(0);
        expect(commitSpy).toHaveBeenCalledTimes(1);
        expect(rollbackSpy).toHaveBeenCalledTimes(0);
        expect(part.node.nodeValue).toBe(source1);
      }

      SESSION2: {
        const dirty = updater.startUpdate((session) => {
          const dirty = slot.reconcile(Cached(source2, key), session);
          slot.commit();
          return dirty;
        });

        expect(reconcileSpy).toHaveBeenCalledTimes(1);
        expect(attachSpy).toHaveBeenCalledTimes(1);
        expect(detachSpy).toHaveBeenCalledTimes(0);
        expect(commitSpy).toHaveBeenCalledTimes(2);
        expect(rollbackSpy).toHaveBeenCalledTimes(0);
        expect(dirty).toBe(true);
        expect(part.node.nodeValue).toBe(source2);
      }

      SESSION3: {
        updater.startUpdate((session) => {
          slot.detach(session);
          slot.rollback();
        });

        expect(reconcileSpy).toHaveBeenCalledTimes(1);
        expect(attachSpy).toHaveBeenCalledTimes(1);
        expect(detachSpy).toHaveBeenCalledTimes(1);
        expect(commitSpy).toHaveBeenCalledTimes(2);
        expect(rollbackSpy).toHaveBeenCalledTimes(1);
        expect(part.node.nodeValue).toBe('');
      }
    });

    it('updates the binding with different keys', () => {
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
      const innerSlot = new MockSlot(binding);
      const slot = new CachedSlot(innerSlot, key1);
      const updater = new TestUpdater();

      const reconcileSpy = vi.spyOn(innerSlot, 'reconcile');
      const attachSpy = vi.spyOn(innerSlot, 'attach');
      const detachSpy = vi.spyOn(innerSlot, 'detach');
      const commitSpy = vi.spyOn(innerSlot, 'commit');
      const rollbackSpy = vi.spyOn(innerSlot, 'rollback');

      SESSION1: {
        updater.startUpdate((session) => {
          slot.attach(session);
          slot.commit();
        });

        expect(reconcileSpy).toHaveBeenCalledTimes(0);
        expect(attachSpy).toHaveBeenCalledTimes(1);
        expect(detachSpy).toHaveBeenCalledTimes(0);
        expect(commitSpy).toHaveBeenCalledTimes(1);
        expect(rollbackSpy).toHaveBeenCalledTimes(0);
        expect(slot['_pendingSlot']).toBe(innerSlot);
        expect(slot['_pendingSlot']).toBeInstanceOf(MockSlot);
        expect(slot['_pendingSlot']).toStrictEqual(
          expect.objectContaining({
            value: source1,
            dirty: false,
            committed: true,
          }),
        );
        expect(part.node.nodeValue).toBe(source1);
      }

      SESSION2: {
        const dirty = updater.startUpdate((session) => {
          const dirty = slot.reconcile(Cached(source2, key2), session);
          slot.commit();
          return dirty;
        });

        expect(reconcileSpy).toHaveBeenCalledTimes(0);
        expect(attachSpy).toHaveBeenCalledTimes(1);
        expect(detachSpy).toHaveBeenCalledTimes(1);
        expect(commitSpy).toHaveBeenCalledTimes(1);
        expect(rollbackSpy).toHaveBeenCalledTimes(1);
        expect(slot['_pendingSlot']).not.toBe(innerSlot);
        expect(slot['_pendingSlot']).toBeInstanceOf(MockSlot);
        expect(slot['_pendingSlot']).toStrictEqual(
          expect.objectContaining({
            value: source2,
            dirty: false,
            committed: true,
          }),
        );
        expect(dirty).toBe(true);
        expect(part.node.nodeValue).toBe(source2);
      }

      SESSION3: {
        const dirty = updater.startUpdate((session) => {
          const dirty = slot.reconcile(Cached(source1, key1), session);
          slot.commit();
          return dirty;
        });

        expect(reconcileSpy).toHaveBeenCalledTimes(1);
        expect(attachSpy).toHaveBeenCalledTimes(1);
        expect(detachSpy).toHaveBeenCalledTimes(1);
        expect(commitSpy).toHaveBeenCalledTimes(2);
        expect(rollbackSpy).toHaveBeenCalledTimes(1);
        expect(slot['_pendingSlot']).toBe(innerSlot);
        expect(slot['_pendingSlot']).toBeInstanceOf(MockSlot);
        expect(slot['_pendingSlot']).toStrictEqual(
          expect.objectContaining({
            value: source1,
            dirty: false,
            committed: true,
          }),
        );
        expect(dirty).toBe(true);
        expect(part.node.nodeValue).toBe(source1);
      }

      SESSION4: {
        updater.startUpdate((session) => {
          slot.detach(session);
          slot.rollback();
        });

        expect(reconcileSpy).toHaveBeenCalledTimes(1);
        expect(attachSpy).toHaveBeenCalledTimes(1);
        expect(detachSpy).toHaveBeenCalledTimes(2);
        expect(commitSpy).toHaveBeenCalledTimes(2);
        expect(rollbackSpy).toHaveBeenCalledTimes(2);
        expect(part.node.nodeValue).toBe('');
      }
    });

    it('updates the binding without keys', () => {
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
      const innerSlot = new MockSlot(binding);
      const slot = new CachedSlot(innerSlot, key);
      const updater = new TestUpdater();

      const reconcileSpy = vi.spyOn(innerSlot, 'reconcile');
      const attachSpy = vi.spyOn(innerSlot, 'attach');
      const detachSpy = vi.spyOn(innerSlot, 'detach');
      const commitSpy = vi.spyOn(innerSlot, 'commit');
      const rollbackSpy = vi.spyOn(innerSlot, 'rollback');

      SESSION1: {
        updater.startUpdate((session) => {
          slot.attach(session);
          slot.commit();
        });

        expect(reconcileSpy).toHaveBeenCalledTimes(0);
        expect(attachSpy).toHaveBeenCalledTimes(1);
        expect(detachSpy).toHaveBeenCalledTimes(0);
        expect(commitSpy).toHaveBeenCalledTimes(1);
        expect(rollbackSpy).toHaveBeenCalledTimes(0);
        expect(slot['_pendingSlot']).toBe(innerSlot);
        expect(slot['_pendingSlot']).toBeInstanceOf(MockSlot);
        expect(slot['_pendingSlot']).toStrictEqual(
          expect.objectContaining({
            value: source1,
            dirty: false,
            committed: true,
          }),
        );
        expect(part.node.nodeValue).toBe(source1);
      }

      SESSION2: {
        const dirty = updater.startUpdate((session) => {
          const dirty = slot.reconcile(source2, session);
          slot.commit();
          return dirty;
        });

        expect(reconcileSpy).toHaveBeenCalledTimes(0);
        expect(attachSpy).toHaveBeenCalledTimes(1);
        expect(detachSpy).toHaveBeenCalledTimes(1);
        expect(commitSpy).toHaveBeenCalledTimes(1);
        expect(rollbackSpy).toHaveBeenCalledTimes(1);
        expect(slot['_pendingSlot']).not.toBe(innerSlot);
        expect(slot['_pendingSlot']).toBeInstanceOf(MockSlot);
        expect(slot['_pendingSlot']).toStrictEqual(
          expect.objectContaining({
            value: source2,
            dirty: false,
            committed: true,
          }),
        );
        expect(dirty).toBe(true);
        expect(part.node.nodeValue).toBe(source2);
      }

      SESSION3: {
        const dirty = updater.startUpdate((session) => {
          const dirty = slot.reconcile(Cached(source1, key), session);
          slot.commit();
          return dirty;
        });

        expect(reconcileSpy).toHaveBeenCalledTimes(1);
        expect(attachSpy).toHaveBeenCalledTimes(1);
        expect(detachSpy).toHaveBeenCalledTimes(1);
        expect(commitSpy).toHaveBeenCalledTimes(2);
        expect(rollbackSpy).toHaveBeenCalledTimes(1);
        expect(slot['_pendingSlot']).toBe(innerSlot);
        expect(slot['_pendingSlot']).toBeInstanceOf(MockSlot);
        expect(slot['_pendingSlot']).toStrictEqual(
          expect.objectContaining({
            value: source1,
            dirty: false,
            committed: true,
          }),
        );
        expect(dirty).toBe(true);
        expect(part.node.nodeValue).toBe(source1);
      }

      SESSION4: {
        updater.startUpdate((session) => {
          slot.detach(session);
          slot.rollback();
        });

        expect(reconcileSpy).toHaveBeenCalledTimes(1);
        expect(attachSpy).toHaveBeenCalledTimes(1);
        expect(detachSpy).toHaveBeenCalledTimes(2);
        expect(commitSpy).toHaveBeenCalledTimes(2);
        expect(rollbackSpy).toHaveBeenCalledTimes(2);
        expect(part.node.nodeValue).toBe('');
      }
    });
  });
});
