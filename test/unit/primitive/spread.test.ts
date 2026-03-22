import { describe, expect, it } from 'vitest';
import { createElementPart } from '@/part.js';
import { SpreadBinding, SpreadType } from '@/primitive/spread.js';
import { createRuntime } from '../../mocks.js';
import { TestUpdater } from '../../test-updater.js';

describe('SpreadType', () => {
  describe('ensureValue()', () => {
    it('asserts the value is a object', () => {
      const part = createElementPart(document.createElement('div'));

      expect(() => {
        SpreadType.ensureValue!.call(SpreadType, { class: 'foo' }, part);
      }).not.toThrow();
    });

    it.for([
      null,
      undefined,
      'foo',
    ])('throws an error if the value is not object', (value) => {
      const part = createElementPart(document.createElement('div'));

      expect(() => {
        SpreadType.ensureValue!.call(SpreadType, value, part);
      }).toThrow('SpreadType values must be object.');
    });
  });

  describe('resolveBinding()', () => {
    it('constructs a new SpreadBinding', () => {
      const props = { color: 'red' };
      const part = createElementPart(document.createElement('div'));
      const runtime = createRuntime();
      const binding = SpreadType.resolveBinding(props, part, runtime);

      expect(binding).toBeInstanceOf(SpreadBinding);
      expect(binding.type).toBe(SpreadType);
      expect(binding.value).toBe(props);
      expect(binding.part).toBe(part);
    });
  });
});

describe('SpreadBinding', () => {
  describe('shouldUpdate', () => {
    it('returns true if the committed value does not exist', () => {
      const props = { class: 'foo' };
      const part = createElementPart(document.createElement('div'));
      const binding = new SpreadBinding(props, part);

      expect(binding.shouldUpdate(props)).toBe(true);
    });

    it('returns true if the style has changed from the committed one', () => {
      const props1 = { class: 'foo' };
      const props2 = { id: 'bar' };
      const part = createElementPart(document.createElement('div'));
      const binding = new SpreadBinding(props1, part);
      const updater = new TestUpdater();

      updater.startUpdate((session) => {
        binding.attach(session);
        binding.commit();
      });

      expect(binding.shouldUpdate(props1)).toBe(false);
      expect(binding.shouldUpdate(props2)).toBe(true);
    });
  });

  describe('commit()', () => {
    it('commits pending properties', () => {
      const props1 = {
        id: 'foo',
        class: 'bar',
        title: undefined,
        $hidden: true,
      };
      const props2 = {
        id: undefined,
        class: 'bar',
        '.innerHTML': '<div>foo</div>',
        '@click': () => {},
      };
      const part = createElementPart(document.createElement('div'));
      const binding = new SpreadBinding(props1, part);
      const updater = new TestUpdater();

      SESSION1: {
        updater.startUpdate((session) => {
          binding.attach(session);
          binding.commit();
        });

        expect(part.node.outerHTML).toBe(
          '<div id="foo" class="bar" hidden=""></div>',
        );
      }

      SESSION2: {
        updater.startUpdate((session) => {
          binding.value = props2;
          binding.attach(session);
          binding.commit();
        });

        expect(part.node.outerHTML).toBe(
          '<div class="bar"><div>foo</div></div>',
        );
      }
    });
  });

  describe('rollback()', () => {
    it('rollbacks current properties', () => {
      const props = {
        id: 'foo',
        class: 'bar',
        $hidden: true,
        '.innerHTML': '<div>foo</div>',
        '@click': () => {},
      };
      const part = createElementPart(document.createElement('div'));
      const binding = new SpreadBinding(props, part);
      const updater = new TestUpdater();

      SESSION1: {
        updater.startUpdate((session) => {
          binding.attach(session);
          binding.commit();
        });

        expect(part.node.outerHTML).toBe(
          '<div id="foo" class="bar" hidden=""><div>foo</div></div>',
        );
      }

      SESSION2: {
        updater.startUpdate((session) => {
          binding.detach(session);
          binding.rollback();
        });

        expect(part.node.outerHTML).toBe('<div></div>');
      }
    });

    it('does nothing if there are no current properties', () => {
      const props = {};
      const part = createElementPart(document.createElement('div'));
      const binding = new SpreadBinding(props, part);
      const updater = new TestUpdater();

      SESSION: {
        updater.startUpdate((session) => {
          binding.detach(session);
          binding.rollback();
        });

        expect(part.node.outerHTML).toBe('<div></div>');
      }
    });
  });
});
