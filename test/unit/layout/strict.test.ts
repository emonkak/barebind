import { describe, expect, it, vi } from 'vitest';
import { PartType } from '@/core.js';
import { DirectiveSpecifier } from '@/directive.js';
import { Strict, StrictLayout, StrictSlot } from '@/layout/strict.js';
import { HTML_NAMESPACE_URI } from '@/template/template.js';
import {
  MockBinding,
  MockDirective,
  MockLayout,
  MockPrimitive,
} from '../../mocks.js';
import { TestUpdater } from '../../test-updater.js';

describe('Strcit()', () => {
  it('creates a LayoutModifier with StrictSlot', () => {
    const source = 'foo';
    const bindable = Strict(source);

    expect(bindable.source).toBe(source);
    expect(bindable.layout).toBe(StrictLayout);
  });
});

describe('StrictLayout', () => {
  describe('compose()', () => {
    it('returns itself', () => {
      const layout = StrictLayout.compose(new MockLayout());
      expect(layout).toBe(StrictLayout);
    });
  });

  describe('placeBinding()', () => {
    it('constructs a new LooseSlot', () => {
      const value = 'foo';
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new MockBinding(MockPrimitive, value, part);
      const slot = StrictLayout.placeBinding(binding, new MockLayout());

      expect(slot.type).toBe(binding.type);
      expect(slot.value).toBe(binding.value);
      expect(slot.part).toBe(binding.part);
    });
  });
});

describe('StrictSlot', () => {
  describe('attach()', () => {
    it('commits the binding only after attaching', () => {
      const source = 'foo';
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new MockBinding(MockPrimitive, source, part);
      const slot = new StrictSlot(binding);
      const updater = new TestUpdater();

      const attachSpy = vi.spyOn(binding, 'attach');
      const commitSpy = vi.spyOn(binding, 'commit');

      SESSION1: {
        updater.startUpdate((session) => {
          slot.attach(session);
          slot.commit();
          slot.commit(); // should not be committed
        });

        expect(attachSpy).toHaveBeenCalledOnce();
        expect(commitSpy).toHaveBeenCalledOnce();
        expect(part.node.data).toBe('/MockPrimitive("foo")');
      }
    });
  });

  describe('detach()', () => {
    it('rollbacks the binding only after detaching', () => {
      const source = 'foo';
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new MockBinding(MockPrimitive, source, part);
      const slot = new StrictSlot(binding);
      const updater = new TestUpdater();

      const detachSpy = vi.spyOn(binding, 'detach');
      const rollbackSpy = vi.spyOn(binding, 'rollback');

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
          slot.rollback(); // should not be rollbacked
        });

        expect(detachSpy).toHaveBeenCalledOnce();
        expect(rollbackSpy).toHaveBeenCalledOnce();
        expect(part.node.data).toBe('');
      }
    });
  });

  describe('reconcile()', () => {
    it('resuse the binding when the directive type is the same', () => {
      const source1 = 'foo';
      const source2 = 'bar';
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new MockBinding(MockPrimitive, source1, part);
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
      }

      SESSION2: {
        const dirty = updater.startUpdate((session) => {
          const dirty = slot.reconcile(source2, session);
          slot.commit();
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
    });

    it('commits the binding only if it is dirty', () => {
      const source = 'foo';
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new MockBinding(MockPrimitive, source, part);
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
      }

      SESSION2: {
        const dirty = updater.startUpdate((session) => {
          const dirty = slot.reconcile(source, session);
          slot.commit();
          return dirty;
        });

        expect(shouldUpdateSpy).toHaveBeenCalledTimes(1);
        expect(attachSpy).toHaveBeenCalledTimes(1);
        expect(commitSpy).toHaveBeenCalledTimes(1);
        expect(dirty).toBe(false);
        expect(part.node.data).toBe('/MockPrimitive("foo")');
      }
    });

    it('throws DirectiveError when directive types are mismatched', () => {
      const source1 = 'foo';
      const source2 = new DirectiveSpecifier(new MockDirective(), 'bar');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new MockBinding(MockPrimitive, source1, part);
      const slot = new StrictSlot(binding);
      const updater = new TestUpdater();

      SESSION1: {
        updater.startUpdate((session) => {
          slot.attach(session);
          slot.commit();
        });
      }

      SESSION2: {
        expect(() => {
          updater.startUpdate((session) => {
            slot.reconcile(source2, session);
          });
        }).toThrow(
          'The directive type must be MockPrimitive in the slot, but got MockDirective.',
        );
      }
    });
  });
});
