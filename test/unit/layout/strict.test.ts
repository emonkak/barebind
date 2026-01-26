import { describe, expect, it, vi } from 'vitest';

import { DirectiveSpecifier } from '@/directive.js';
import { PartType } from '@/internal.js';
import { Strict, StrictLayout, StrictSlot } from '@/layout/strict.js';
import { HTML_NAMESPACE_URI } from '@/template/template.js';
import { MockBinding, MockDirective, MockPrimitive } from '../../mocks.js';
import { TestUpdater } from '../../test-updater.js';

describe('Strcit()', () => {
  it('creates a LayoutSpecifier with StrictSlot', () => {
    const value = 'foo';
    const bindable = Strict(value);

    expect(bindable.value).toBe(value);
    expect(bindable.layout).toBe(StrictLayout);
  });
});

describe('StrictLayout', () => {
  describe('resolveSlot', () => {
    it('constructs a new LooseSlot', () => {
      const value = 'foo';
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new MockBinding(MockPrimitive, value, part);
      const slot = StrictLayout.resolveSlot(binding);

      expect(slot.type).toBe(MockPrimitive);
      expect(slot.value).toBe(value);
      expect(slot.part).toBe(part);
    });
  });
});

describe('StrictSlot', () => {
  describe('reconcile()', () => {
    it('updates the binding with the same directive type', () => {
      const value1 = 'foo';
      const value2 = 'bar';
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new MockBinding(MockPrimitive, value1, part);
      const slot = new StrictSlot(binding);
      const updater = new TestUpdater();

      const shouldUpdateSpy = vi.spyOn(binding, 'shouldUpdate');
      const attachSpy = vi.spyOn(binding, 'attach');
      const detachSpy = vi.spyOn(binding, 'detach');
      const commitSpy = vi.spyOn(binding, 'commit');
      const rollbackSpy = vi.spyOn(binding, 'rollback');

      SESSION1: {
        updater.startUpdate((session) => {
          slot.attach(session);
          slot.commit();
        });

        expect(shouldUpdateSpy).toHaveBeenCalledTimes(0);
        expect(attachSpy).toHaveBeenCalledTimes(1);
        expect(detachSpy).toHaveBeenCalledTimes(0);
        expect(commitSpy).toHaveBeenCalledTimes(1);
        expect(rollbackSpy).toHaveBeenCalledTimes(0);
        expect(part.node.data).toBe('/MockPrimitive("foo")');
      }

      SESSION2: {
        const dirty = updater.startUpdate((session) => {
          const dirty = slot.reconcile(value2, session);
          slot.commit();
          slot.commit(); // ignore the second commit
          return dirty;
        });

        expect(shouldUpdateSpy).toHaveBeenCalledTimes(1);
        expect(attachSpy).toHaveBeenCalledTimes(2);
        expect(detachSpy).toHaveBeenCalledTimes(0);
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
        expect(detachSpy).toHaveBeenCalledTimes(1);
        expect(commitSpy).toHaveBeenCalledTimes(2);
        expect(rollbackSpy).toHaveBeenCalledTimes(1);
        expect(part.node.data).toBe('');
      }
    });

    it('updates the binding only if it is dirty', () => {
      const value = 'foo';
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new MockBinding(MockPrimitive, value, part);
      const slot = new StrictSlot(binding);
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
          slot.reconcile(value, session) && slot.commit();
        });

        expect(shouldUpdateSpy).toHaveBeenCalledTimes(1);
        expect(attachSpy).toHaveBeenCalledTimes(1);
        expect(commitSpy).toHaveBeenCalledTimes(1);
        expect(part.node.data).toBe('/MockPrimitive("foo")');
      }
    });

    it('throws an error if directive types are mismatched', () => {
      const value1 = 'foo';
      const value2 = new DirectiveSpecifier(new MockDirective(), 'bar');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new MockBinding(MockPrimitive, value1, part);
      const slot = new StrictSlot(binding);
      const updater = new TestUpdater();

      updater.startUpdate((session) => {
        slot.attach(session);
        slot.commit();
      });

      expect(() => {
        updater.startUpdate((session) => {
          slot.reconcile(value2, session);
        });
      }).toThrow(
        'The directive type must be MockPrimitive in this slot, but got MockDirective.',
      );
    });
  });
});
