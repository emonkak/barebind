import { describe, expect, it, vi } from 'vitest';

import { Directive } from '@/core.js';
import { createChildNodePart, HTML_NAMESPACE_URI } from '@/dom.js';
import { Slot } from '@/slot.js';
import { MockBinding, MockType } from '../mocks.js';
import { TestUpdater } from '../test-updater.js';

describe('Slot', () => {
  describe('constructor()', () => {
    it('starts with pending binding', () => {
      const binding = new MockBinding(
        new MockType(),
        'a',
        createChildNodePart(document.createComment(''), HTML_NAMESPACE_URI),
      );
      const slot = new Slot(binding, 'key');

      expect(slot.part).toBe(binding.part);
      expect(slot.key).toBe('key');
    });
  });

  describe('reconcile()', () => {
    it('update the current binding when the type is the same', () => {
      const binding = new MockBinding(
        new MockType(),
        'a',
        createChildNodePart(document.createComment(''), HTML_NAMESPACE_URI),
      );
      const slot = new Slot(binding);
      const updater = new TestUpdater();

      const attachSpy = vi.spyOn(binding, 'attach');
      const detachSpy = vi.spyOn(binding, 'detach');
      const commitSpy = vi.spyOn(binding, 'commit');
      const rollbackSpy = vi.spyOn(binding, 'rollback');

      SESSION: {
        const dirty = updater.startUpdate((session) => {
          const dirty = slot.reconcile('b', session);
          slot.commit();
          return dirty;
        });

        expect(attachSpy).toHaveBeenCalledTimes(1);
        expect(detachSpy).toHaveBeenCalledTimes(0);
        expect(commitSpy).toHaveBeenCalledTimes(1);
        expect(rollbackSpy).toHaveBeenCalledTimes(0);
        expect(dirty).toBe(true);
      }
    });

    it('resolves a new binding when the type changes', () => {
      const binding = new MockBinding(
        new MockType('A'),
        'a',
        createChildNodePart(document.createComment(''), HTML_NAMESPACE_URI),
      );
      const slot = new Slot(binding);
      const updater = new TestUpdater();

      const attachSpy = vi.spyOn(binding, 'attach');
      const detachSpy = vi.spyOn(binding, 'detach');
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
          const dirty = slot.reconcile(
            new Directive(new MockType('B'), 'b'),
            session,
          );
          slot.commit();
          return dirty;
        });

        expect(attachSpy).toHaveBeenCalledTimes(1);
        expect(detachSpy).toHaveBeenCalledTimes(1);
        expect(commitSpy).toHaveBeenCalledTimes(1);
        expect(rollbackSpy).toHaveBeenCalledTimes(1);
        expect(dirty).toBe(true);
      }
    });

    it('resolves a new binding when the key changes', () => {
      const binding = new MockBinding(
        new MockType(),
        'a',
        createChildNodePart(document.createComment(''), HTML_NAMESPACE_URI),
      );
      const slot = new Slot(binding, 'key1');
      const updater = new TestUpdater();

      const attachSpy = vi.spyOn(binding, 'attach');
      const detachSpy = vi.spyOn(binding, 'detach');
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
          const dirty = slot.reconcile(
            new Directive(new MockType(), 'b', 'key2'),
            session,
          );
          slot.commit();
          return dirty;
        });

        expect(attachSpy).toHaveBeenCalledTimes(1);
        expect(detachSpy).toHaveBeenCalledTimes(1);
        expect(commitSpy).toHaveBeenCalledTimes(1);
        expect(rollbackSpy).toHaveBeenCalledTimes(1);
        expect(dirty).toBe(true);
      }
    });
  });

  describe('commit()', () => {
    it('commits pending bindings when attached', () => {
      const binding = new MockBinding(
        new MockType(),
        'foo',
        createChildNodePart(document.createComment(''), HTML_NAMESPACE_URI),
      );
      const slot = new Slot(binding);
      const updater = new TestUpdater();
      const commitSpy = vi.spyOn(binding, 'commit');

      SESSION: {
        updater.startUpdate((session) => {
          slot.attach(session);
          slot.commit();
        });

        expect(commitSpy).toHaveBeenCalledOnce();
      }
    });

    it('does nothing when pending bindings are not attached', () => {
      const binding = new MockBinding(
        new MockType(),
        'foo',
        createChildNodePart(document.createComment(''), HTML_NAMESPACE_URI),
      );
      const slot = new Slot(binding);
      const commitSpy = vi.spyOn(binding, 'commit');

      SESSION: {
        slot.commit();
        expect(commitSpy).not.toHaveBeenCalled();
      }
    });

    it('does nothing when pending bindings are detached', () => {
      const binding = new MockBinding(
        new MockType(),
        'foo',
        createChildNodePart(document.createComment(''), HTML_NAMESPACE_URI),
      );
      const slot = new Slot(binding);
      const updater = new TestUpdater();
      const commitSpy = vi.spyOn(binding, 'commit');

      SESSION: {
        updater.startUpdate((session) => {
          slot.detach(session);
          slot.commit();
        });
        expect(commitSpy).not.toHaveBeenCalled();
      }
    });
  });

  describe('rollback()', () => {
    it('rollbacks current bindings when detached', () => {
      const binding = new MockBinding(
        new MockType(),
        'foo',
        createChildNodePart(document.createComment(''), HTML_NAMESPACE_URI),
      );
      const slot = new Slot(binding);
      const updater = new TestUpdater();
      const rollbackSpy = vi.spyOn(binding, 'rollback');

      SESSION1: {
        updater.startUpdate((session) => {
          slot.attach(session);
          slot.commit();
        });
      }

      SESSION1: {
        updater.startUpdate((session) => {
          slot.detach(session);
          slot.rollback();
        });

        expect(rollbackSpy).toHaveBeenCalledOnce();
      }
    });

    it('does nothing when current bindings are not mounted', () => {
      const binding = new MockBinding(
        new MockType(),
        'foo',
        createChildNodePart(document.createComment(''), HTML_NAMESPACE_URI),
      );
      const slot = new Slot(binding);
      const rollbackSpy = vi.spyOn(binding, 'rollback');

      SESSION: {
        slot.rollback();
        expect(rollbackSpy).not.toHaveBeenCalled();
      }
    });

    it('does nothing when pending bindings are attached', () => {
      const binding = new MockBinding(
        new MockType(),
        'foo',
        createChildNodePart(document.createComment(''), HTML_NAMESPACE_URI),
      );
      const slot = new Slot(binding);
      const updater = new TestUpdater();
      const rollbackSpy = vi.spyOn(binding, 'rollback');

      SESSION1: {
        updater.startUpdate((session) => {
          slot.attach(session);
          slot.commit();
        });
      }

      SESSION3: {
        updater.startUpdate((session) => {
          slot.attach(session);
          slot.rollback();
        });
        expect(rollbackSpy).not.toHaveBeenCalled();
      }
    });
  });
});
