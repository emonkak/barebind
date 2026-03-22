import { describe, expect, it, vi } from 'vitest';
import { createPropertyPart } from '@/part.js';
import { PropertyBinding, PropertyType } from '@/primitive/property.js';
import { createRuntime } from '../../mocks.js';
import { TestUpdater } from '../../test-updater.js';

describe('PropertyType', () => {
  describe('resolveBinding()', () => {
    it('constructs a new PropertyBinding', () => {
      const value = '<div>foo</div>';
      const part = createPropertyPart(
        document.createElement('div'),
        'innerHTML',
      );
      const runtime = createRuntime();
      const binding = PropertyType.resolveBinding(value, part, runtime);

      expect(binding).toBeInstanceOf(PropertyBinding);
      expect(binding.type).toBe(PropertyType);
      expect(binding.value).toBe(value);
      expect(binding.part).toBe(part);
    });
  });
});

describe('PropertyBinding', () => {
  describe('shouldUpdate()', () => {
    it('returns true if the committed value does not exist', () => {
      const value = '<div>foo</div>';
      const part = createPropertyPart(
        document.createElement('div'),
        'innerHTML',
      );
      const binding = new PropertyBinding(value, part);

      expect(binding.shouldUpdate(value)).toBe(true);
    });

    it('returns true if the committed value is different from the new one', () => {
      const value1 = '<div>foo</div>';
      const value2 = '<div>bar</div>';
      const part = createPropertyPart(
        document.createElement('div'),
        'innerHTML',
      );
      const binding = new PropertyBinding(value1, part);
      const updater = new TestUpdater();

      SESSION: {
        updater.startUpdate((session) => {
          binding.attach(session);
          binding.commit();
        });

        expect(binding.shouldUpdate(value1)).toBe(false);
        expect(binding.shouldUpdate(value2)).toBe(true);
      }
    });
  });

  describe('commit()', () => {
    it('sets the value for the property', () => {
      const value1 = '<div>foo</div>';
      const value2 = '<div>foo</div>';
      const part = createPropertyPart(
        document.createElement('div'),
        'innerHTML',
      );
      const binding = new PropertyBinding(value1, part);
      const updater = new TestUpdater();

      SESSION1: {
        updater.startUpdate((session) => {
          binding.attach(session);
          binding.commit();
        });

        expect(part.node.innerHTML).toBe(value1);
      }

      SESSION2: {
        updater.startUpdate((session) => {
          binding.value = value2;
          binding.attach(session);
          binding.commit();
        });

        expect(part.node.innerHTML).toBe(value2);
      }
    });
  });

  describe('rollback()', () => {
    it('restores the property to the initial value of the part', () => {
      const value = '<div>foo</div>';
      const part = createPropertyPart(
        document.createElement('div'),
        'innerHTML',
      );
      const binding = new PropertyBinding(value, part);
      const updater = new TestUpdater();

      SESSION1: {
        updater.startUpdate((session) => {
          binding.attach(session);
          binding.commit();
        });

        expect(part.node.innerHTML).toBe(value);
      }

      SESSION2: {
        updater.startUpdate((session) => {
          binding.detach(session);
          binding.rollback();
        });

        expect(part.node.innerHTML).toBe('');
      }
    });

    it('should do nothing if the committed value does not exist', () => {
      const value = '<div>foo</div>';
      const part = createPropertyPart(
        document.createElement('div'),
        'innerHTML',
      );
      const binding = new PropertyBinding(value, part);
      const updater = new TestUpdater();

      const setInnerHTMLSpy = vi.spyOn(part.node, 'innerHTML', 'set');

      SESSION: {
        updater.startUpdate((session) => {
          binding.detach(session);
          binding.rollback();
        });

        expect(setInnerHTMLSpy).not.toHaveBeenCalled();
      }
    });
  });
});
