import { describe, expect, it, vi } from 'vitest';

import { DirectiveSpecifier } from '@/directive.js';
import { PartType } from '@/internal.js';
import { Flexible, FlexibleLayout, FlexibleSlot } from '@/layout/flexible.js';
import { HTML_NAMESPACE_URI } from '@/template/template.js';
import {
  MockBinding,
  MockDirective,
  MockLayout,
  MockPrimitive,
} from '../../mocks.js';
import { TestUpdater } from '../../test-updater.js';

describe('Flexible()', () => {
  it('creates a LayoutSpecifier with FlexibleSlot', () => {
    const source = 'foo';
    const bindable = Flexible(source);

    expect(bindable.source).toBe(source);
    expect(bindable.layout).toBe(FlexibleLayout);
  });
});

describe('FlexibleLayout', () => {
  describe('compose()', () => {
    it('returns itself', () => {
      const layout = FlexibleLayout.compose(new MockLayout());
      expect(layout).toBe(FlexibleLayout);
    });
  });

  describe('placeBinding()', () => {
    it('constructs a new FlexibleSlot', () => {
      const value = 'foo';
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new MockBinding(MockPrimitive, value, part);
      const slot = FlexibleLayout.placeBinding(binding, new MockLayout());

      expect(slot.type).toBe(binding.type);
      expect(slot.value).toBe(binding.value);
      expect(slot.part).toBe(binding.part);
    });
  });
});

describe('FlexibleSlot', () => {
  describe('reconcile()', () => {
    it('updates the binding with the same directive type', () => {
      const source1 = 'foo';
      const source2 = 'bar';
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new MockBinding(MockPrimitive, source1, part);
      const slot = new FlexibleSlot(binding);
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
          const dirty = slot.reconcile(source2, session);
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

    it('updates the binding with a different directive type', () => {
      const source1 = 'foo';
      const source2 = new DirectiveSpecifier(new MockDirective(), 'bar');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new MockBinding(MockPrimitive, source1, part);
      const slot = new FlexibleSlot(binding);
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
        updater.startUpdate((session) => {
          slot.reconcile(source2, session);
          slot.commit();
        });
      }

      SESSION3: {
        updater.startUpdate((session) => {
          slot.reconcile(source1, session);
          slot.commit();
        });

        expect(attachSpy).toHaveBeenCalledTimes(2);
        expect(detachSpy).toHaveBeenCalledOnce();
        expect(commitSpy).toHaveBeenCalledTimes(2);
        expect(rollbackSpy).toHaveBeenCalledOnce();
        expect(slot['_pendingBinding']).toBe(binding);
        expect(slot['_pendingBinding']).toStrictEqual(
          expect.objectContaining({
            dirty: false,
            committed: true,
          }),
        );
        expect(part.node.data).toBe('/MockPrimitive("foo")');
      }
    });

    it('updates the binding only if it is dirty', () => {
      const source = 'foo';
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new MockBinding(MockPrimitive, source, part);
      const slot = new FlexibleSlot(binding);
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
          slot.reconcile(source, session) && slot.commit();
        });

        expect(shouldUpdateSpy).toHaveBeenCalledTimes(1);
        expect(attachSpy).toHaveBeenCalledTimes(1);
        expect(commitSpy).toHaveBeenCalledTimes(1);
        expect(part.node.data).toBe('/MockPrimitive("foo")');
      }
    });
  });
});
