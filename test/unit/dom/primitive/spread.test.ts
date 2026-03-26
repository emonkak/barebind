import { describe, expect, it, vi } from 'vitest';
import { createElementPart } from '@/dom/part.js';
import {
  DOMSpread,
  DOMSpreadBinding,
  type SpreadProps,
} from '@/dom/primitive/spread.js';
import { createTestRuntime } from '../../../adapter.js';
import { createElement } from '../../../helpers.js';
import { SessionLauncher } from '../../../session-launcher.js';

describe('DOMSpread', () => {
  describe('ensureValue()', () => {
    it('asserts the value is object', () => {
      const part = createElementPart(document.createElement('div'));

      expect(() => {
        DOMSpread.ensureValue({ id: 'a' }, part);
      }).not.toThrow();
    });

    it('throws an error when the value is not object', () => {
      const part = createElementPart(document.createElement('div'));

      expect(() => {
        DOMSpread.ensureValue(null, part);
      }).toThrow('Spread values must be object.');
    });
  });

  describe('resolveBinding()', () => {
    it('constructs a new binding with DOMSpread type', () => {
      const props = { id: 'a' };
      const part = createElementPart(document.createElement('div'));
      const runtime = createTestRuntime();
      const binding = DOMSpread.resolveBinding(props, part, runtime);

      expect(binding.type).toBe(DOMSpread);
      expect(binding.value).toBe(props);
      expect(binding.part).toBe(part);
    });
  });
});

describe('DOMSpreadBinding', () => {
  const launcher = new SessionLauncher(createTestRuntime());

  describe('shouldUpdate', () => {
    it('returns true when there is no current value', () => {
      const props = { id: 'a' };
      const part = createElementPart(document.createElement('div'));
      const binding = new DOMSpreadBinding(props, part);

      expect(binding.shouldUpdate(props)).toBe(true);
    });

    it('returns true when the properties differs from the current one', () => {
      const props = { id: 'a' };
      const part = createElementPart(document.createElement('div'));
      const binding = new DOMSpreadBinding(props, part);

      launcher.launchSession((session) => {
        binding.attach(session);
        binding.commit();
      });

      expect(binding.shouldUpdate(props)).toBe(false);
      expect(binding.shouldUpdate({ id: 'a' })).toBe(true);
      expect(binding.shouldUpdate({ id: 'b' })).toBe(true);
    });
  });

  describe('commit/rollback()', () => {
    it.each<[SpreadProps, string]>([
      [{ id: null }, '<div></div>'],
      [{ id: undefined }, '<div></div>'],
      [{ id: 'a' }, '<div id="a"></div>'],
      [{ id: 'a', class: 'b' }, '<div id="a" class="b"></div>'],
      [{ $hidden: true }, '<div hidden=""></div>'],
      [{ '.innerHTML': '<span>a</span>' }, '<div><span>a</span></div>'],
      [{ '@click': () => {} }, '<div></div>'],
    ])('updates the element from %s to %s and resets', (props, expectedHTML) => {
      const part = createElementPart(document.createElement('div'));
      const binding = new DOMSpreadBinding(props, part);

      launcher.launchSession((session) => {
        binding.attach(session);
        binding.commit();
      });

      expect(part.node.outerHTML).toBe(expectedHTML);

      launcher.launchSession((session) => {
        binding.detach(session);
        binding.rollback();
      });

      expect(part.node.outerHTML).toBe('<div></div>');
    });
  });

  describe('commit()', () => {
    it.each<[SpreadProps, SpreadProps, string]>([
      [{}, { id: 'a' }, '<div id="a"></div>'],
      [{ id: 'a' }, {}, '<div></div>'],
      [{ id: 'a' }, { id: undefined }, '<div></div>'],
      [{ id: 'a' }, { id: null }, '<div></div>'],
      [{ id: 'a' }, { id: 'a', class: 'b' }, '<div id="a" class="b"></div>'],
      [{ id: 'a' }, { class: 'b' }, '<div class="b"></div>'],
    ])('updates properties from %s to %s, resulting in "%s"', (props1, props2, expectedHTML) => {
      const part = createElementPart(document.createElement('div'));
      const binding = new DOMSpreadBinding(props1, part);

      launcher.launchSession((session) => {
        binding.attach(session);
        binding.commit();
      });

      launcher.launchSession((session) => {
        binding.value = props2;
        binding.attach(session);
        binding.commit();
      });

      expect(part.node.outerHTML).toBe(expectedHTML);
    });

    it('preserves existing properties', () => {
      const part = createElementPart(createElement('div', { id: 'a' }));
      const binding = new DOMSpreadBinding({ class: 'b' }, part);

      launcher.launchSession((session) => {
        binding.attach(session);
        binding.commit();
      });

      expect(part.node.outerHTML).toBe('<div id="a" class="b"></div>');

      launcher.launchSession((session) => {
        binding.detach(session);
        binding.rollback();
      });

      expect(part.node.outerHTML).toBe('<div id="a"></div>');
    });
  });

  describe('rollback()', () => {
    it('does nothing when there are no current properties', () => {
      const part = createElementPart(document.createElement('div'));
      const binding = new DOMSpreadBinding({ id: 'a' }, part);
      const setAttributeSpy = vi.spyOn(part.node, 'setAttribute');

      launcher.launchSession((session) => {
        binding.detach(session);
        binding.rollback();
      });

      expect(setAttributeSpy).not.toHaveBeenCalled();
    });
  });
});
