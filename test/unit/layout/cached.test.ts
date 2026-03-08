import { describe, expect, it, vi } from 'vitest';
import { PartType } from '@/core.js';
import { Cached, CachedLayout, CachedSlot } from '@/layout/cached.js';
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
    const capacity = 2;
    const bindable = Cached(source, key, capacity);

    expect(bindable.source).toBe(source);
    expect(bindable.layout).toStrictEqual(
      new CachedLayout(key, capacity, null),
    );
  });
});

describe('CachedLayout', () => {
  describe('name', () => {
    it('returns the name of the class', () => {
      const layout = new CachedLayout('foo', 2, new MockLayout());
      expect(layout.name).toBe(CachedLayout.name);
    });
  });

  describe('compose()', () => {
    it('creates a new CachedLayout with the layout', () => {
      const layout = new CachedLayout('foo', 2, null).compose(new MockLayout());
      expect(layout).toStrictEqual(
        new CachedLayout('foo', 2, new MockLayout()),
      );
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
      const slot = new CachedLayout(key, 2, new MockLayout()).placeBinding(
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
  it('can commit the binding after attaching', () => {
    const source = 'foo';
    const key = 123;
    const part = {
      type: PartType.ChildNode,
      node: document.createComment(''),
      anchorNode: null,
      namespaceURI: HTML_NAMESPACE_URI,
    };
    const binding = new MockBinding(MockPrimitive, source, part);
    const innerSlot = new MockSlot(binding);
    const slot = new CachedSlot(innerSlot, key, 2);
    const updater = new TestUpdater();

    const attachSpy = vi.spyOn(innerSlot, 'attach');
    const commitSpy = vi.spyOn(innerSlot, 'commit');

    SESSION1: {
      updater.startUpdate((session) => {
        slot.attach(session);
        slot.commit();
      });

      expect(attachSpy).toHaveBeenCalledOnce();
      expect(commitSpy).toHaveBeenCalledOnce();
      expect(part.node.nodeValue).toBe(source);
    }
  });

  it('can rollback the binding after detaching', () => {
    const source = 'foo';
    const key = 123;
    const part = {
      type: PartType.ChildNode,
      node: document.createComment(''),
      anchorNode: null,
      namespaceURI: HTML_NAMESPACE_URI,
    };
    const binding = new MockBinding(MockPrimitive, source, part);
    const innerSlot = new MockSlot(binding);
    const slot = new CachedSlot(innerSlot, key, 2);
    const updater = new TestUpdater();

    const detachSpy = vi.spyOn(innerSlot, 'detach');
    const rollbackSpy = vi.spyOn(innerSlot, 'rollback');

    SESSION1: {
      updater.startUpdate((session) => {
        slot.attach(session);
        slot.commit();
      });
    }

    SESSION2: {
      updater.startUpdate((session) => {
        slot.detach(session);
        slot.rollback();
      });

      expect(detachSpy).toHaveBeenCalledOnce();
      expect(rollbackSpy).toHaveBeenCalledOnce();
    }
  });

  describe('reconcile()', () => {
    it('reuses the binding when the key is the same', () => {
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
      const slot = new CachedSlot(innerSlot, key, 2);
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
      }

      SESSION2: {
        const dirty = updater.startUpdate((session) => {
          const dirty = slot.reconcile(Cached(source2, key, 2), session);
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
    });

    it('reuses the binding when it is cached', () => {
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
      const slot = new CachedSlot(innerSlot, key1, 2);
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
      }

      SESSION2: {
        const dirty = updater.startUpdate((session) => {
          const dirty = slot.reconcile(Cached(source2, key2, 2), session);
          slot.commit();
          return dirty;
        });

        expect(reconcileSpy).toHaveBeenCalledTimes(0);
        expect(attachSpy).toHaveBeenCalledTimes(1);
        expect(detachSpy).toHaveBeenCalledTimes(1);
        expect(commitSpy).toHaveBeenCalledTimes(1);
        expect(rollbackSpy).toHaveBeenCalledTimes(1);
        expect(dirty).toBe(true);
        expect(part.node.nodeValue).toBe(source2);
      }

      SESSION3: {
        const dirty = updater.startUpdate((session) => {
          const dirty = slot.reconcile(Cached(source1, key1, 2), session);
          slot.commit();
          return dirty;
        });

        expect(reconcileSpy).toHaveBeenCalledTimes(1);
        expect(attachSpy).toHaveBeenCalledTimes(1);
        expect(detachSpy).toHaveBeenCalledTimes(1);
        expect(commitSpy).toHaveBeenCalledTimes(2);
        expect(rollbackSpy).toHaveBeenCalledTimes(1);
        expect(dirty).toBe(true);
        expect(part.node.nodeValue).toBe(source1);
      }
    });

    it('does not reuse the binding when it is evicted by exceeding capacity', () => {
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
      const slot = new CachedSlot(innerSlot, key1, 2);
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
      }

      SESSION2: {
        const dirty = updater.startUpdate((session) => {
          const dirty = slot.reconcile(Cached(source2, key2, 2), session);
          slot.commit();
          return dirty;
        });

        expect(reconcileSpy).toHaveBeenCalledTimes(0);
        expect(attachSpy).toHaveBeenCalledTimes(1);
        expect(detachSpy).toHaveBeenCalledTimes(1);
        expect(commitSpy).toHaveBeenCalledTimes(1);
        expect(rollbackSpy).toHaveBeenCalledTimes(1);
        expect(dirty).toBe(true);
        expect(part.node.nodeValue).toBe(source2);
      }

      SESSION3: {
        const dirty = updater.startUpdate((session) => {
          const dirty = slot.reconcile(Cached(source1, key1, 0), session);
          slot.commit();
          return dirty;
        });

        expect(reconcileSpy).toHaveBeenCalledTimes(0);
        expect(attachSpy).toHaveBeenCalledTimes(1);
        expect(detachSpy).toHaveBeenCalledTimes(1);
        expect(commitSpy).toHaveBeenCalledTimes(1);
        expect(rollbackSpy).toHaveBeenCalledTimes(1);
        expect(dirty).toBe(true);
        expect(part.node.nodeValue).toBe(source1);
      }
    });

    it('resolves a new binding when the key changes to empty', () => {
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
      const slot = new CachedSlot(innerSlot, key, 2);
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
        expect(dirty).toBe(true);
        expect(part.node.nodeValue).toBe(source2);
      }
    });
  });
});
