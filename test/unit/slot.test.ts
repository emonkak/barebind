import { describe, expect, it, vi } from 'vitest';

import { Directive } from '@/core.js';
import { createChildNodePart } from '@/dom/part.js';
import { Slot } from '@/slot.js';
import {
  createMockRuntime,
  MockBinding,
  MockPrimitive,
  MockType,
} from '../mocks.js';
import { SessionLauncher } from '../session-launcher.js';

describe('Slot', () => {
  const launcher = new SessionLauncher(createMockRuntime());

  describe('constructor()', () => {
    it('starts with pending binding', () => {
      const type = new MockType();
      const value = 'a';
      const part = createChildNodePart(document.createComment(''), null);
      const binding = new MockBinding(type, value, part);
      const slot = new Slot(binding, 'key');

      expect(slot.type).toBe(type);
      expect(slot.value).toBe(value);
      expect(slot.part).toBe(part);
      expect(slot.key).toBe('key');
    });
  });

  describe('update()', () => {
    it('update the current binding when the type is the same', () => {
      const binding = new MockBinding(
        MockPrimitive,
        'a',
        createChildNodePart(document.createComment(''), null),
      );
      const slot = new Slot(binding);
      const attachSpy = vi.spyOn(binding, 'attach');
      const detachSpy = vi.spyOn(binding, 'detach');
      const commitSpy = vi.spyOn(binding, 'commit');
      const rollbackSpy = vi.spyOn(binding, 'rollback');

      launcher.launchSession((session) => {
        slot.attach(session);
        slot.commit();
      });

      const dirty = launcher.launchSession((session) => {
        const dirty = slot.update('b', session);
        slot.commit();
        return dirty;
      });

      expect(attachSpy).toHaveBeenCalledTimes(2);
      expect(detachSpy).toHaveBeenCalledTimes(0);
      expect(commitSpy).toHaveBeenCalledTimes(2);
      expect(rollbackSpy).toHaveBeenCalledTimes(0);
      expect(dirty).toBe(true);
    });

    it('resolves a new binding when the type changes', () => {
      const binding = new MockBinding(
        new MockType('A'),
        'a',
        createChildNodePart(document.createComment(''), null),
      );
      const slot = new Slot(binding);
      const attachSpy = vi.spyOn(binding, 'attach');
      const detachSpy = vi.spyOn(binding, 'detach');
      const commitSpy = vi.spyOn(binding, 'commit');
      const rollbackSpy = vi.spyOn(binding, 'rollback');

      launcher.launchSession((session) => {
        slot.attach(session);
        slot.commit();
      });

      const dirty = launcher.launchSession((session) => {
        const dirty = slot.update(
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
    });

    it('resolves a new binding when the key changes', () => {
      const binding = new MockBinding(
        new MockType(),
        'a',
        createChildNodePart(document.createComment(''), null),
      );
      const slot = new Slot(binding, 'key1');
      const attachSpy = vi.spyOn(binding, 'attach');
      const detachSpy = vi.spyOn(binding, 'detach');
      const commitSpy = vi.spyOn(binding, 'commit');
      const rollbackSpy = vi.spyOn(binding, 'rollback');

      launcher.launchSession((session) => {
        slot.attach(session);
        slot.commit();
      });

      const dirty = launcher.launchSession((session) => {
        const dirty = slot.update(
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
    });
  });

  describe('commit()', () => {
    it('commits the pending binding when attached', () => {
      const binding = new MockBinding(
        new MockType(),
        'foo',
        createChildNodePart(document.createComment(''), null),
      );
      const slot = new Slot(binding);
      const commitSpy = vi.spyOn(binding, 'commit');

      launcher.launchSession((session) => {
        slot.attach(session);
        slot.commit();
      });

      expect(commitSpy).toHaveBeenCalledOnce();
    });

    it('does nothing when the pending binding is not attached', () => {
      const binding = new MockBinding(
        new MockType(),
        'foo',
        createChildNodePart(document.createComment(''), null),
      );
      const slot = new Slot(binding);
      const commitSpy = vi.spyOn(binding, 'commit');

      slot.commit();

      expect(commitSpy).not.toHaveBeenCalled();
    });

    it('does nothing when the pending binding is detached', () => {
      const binding = new MockBinding(
        new MockType(),
        'foo',
        createChildNodePart(document.createComment(''), null),
      );
      const slot = new Slot(binding);
      const commitSpy = vi.spyOn(binding, 'commit');

      launcher.launchSession((session) => {
        slot.detach(session);
        slot.commit();
      });

      expect(commitSpy).not.toHaveBeenCalled();
    });
  });

  describe('rollback()', () => {
    it('rollbacks the current binding when detached', () => {
      const binding = new MockBinding(
        new MockType(),
        'foo',
        createChildNodePart(document.createComment(''), null),
      );
      const slot = new Slot(binding);
      const rollbackSpy = vi.spyOn(binding, 'rollback');

      launcher.launchSession((session) => {
        slot.attach(session);
        slot.commit();
      });

      launcher.launchSession((session) => {
        slot.detach(session);
        slot.rollback();
      });

      expect(rollbackSpy).toHaveBeenCalledOnce();
    });

    it('does nothing when the current binding are not mounted', () => {
      const binding = new MockBinding(
        new MockType(),
        'foo',
        createChildNodePart(document.createComment(''), null),
      );
      const slot = new Slot(binding);
      const rollbackSpy = vi.spyOn(binding, 'rollback');

      slot.rollback();

      expect(rollbackSpy).not.toHaveBeenCalled();
    });

    it('does nothing when the pending binding is attached', () => {
      const binding = new MockBinding(
        new MockType(),
        'foo',
        createChildNodePart(document.createComment(''), null),
      );
      const slot = new Slot(binding);
      const rollbackSpy = vi.spyOn(binding, 'rollback');

      launcher.launchSession((session) => {
        slot.attach(session);
        slot.commit();
      });

      launcher.launchSession((session) => {
        slot.attach(session);
        slot.rollback();
      });

      expect(rollbackSpy).not.toHaveBeenCalled();
    });
  });
});
