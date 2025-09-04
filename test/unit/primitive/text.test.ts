import { describe, expect, it, vi } from 'vitest';

import { PartType } from '@/internal.js';
import { TextBinding, TextPrimitive } from '@/primitive/text.js';
import { createRuntime, TestUpdater } from '../../test-helpers.js';

describe('TextPrimitive', () => {
  describe('name', () => {
    it('is a string that represents the primitive itself', () => {
      expect(TextPrimitive.name, 'TextPrimitive');
    });
  });

  describe('resolveBinding()', () => {
    it('constructs a new TextBinding', () => {
      const value = 'foo';
      const part = {
        type: PartType.Text,
        node: document.createTextNode(''),
        precedingText: '',
        followingText: '',
      };
      const runtime = createRuntime();
      const binding = TextPrimitive.resolveBinding(value, part, runtime);

      expect(binding.type).toBe(TextPrimitive);
      expect(binding.value).toBe(value);
      expect(binding.part).toBe(part);
    });

    it('should throw the error if the part is not a property part', () => {
      const value = '<div>foo</div>';
      const part = {
        type: PartType.Element,
        node: document.createElement('div'),
      };
      const runtime = createRuntime();

      expect(() => TextPrimitive.resolveBinding(value, part, runtime)).toThrow(
        'TextPrimitive must be used in a text part.',
      );
    });
  });
});

describe('TextBinding', () => {
  describe('shouldBind()', () => {
    it('returns true if the committed value does not exist', () => {
      const value = '<div>foo</div>';
      const part = {
        type: PartType.Text,
        node: document.createTextNode(''),
        precedingText: '',
        followingText: '',
      };
      const binding = new TextBinding(value, part);

      expect(binding.shouldBind(value)).toBe(true);
    });

    it('returns true if the committed value is different from the new one', () => {
      const value1 = 'foo';
      const value2 = 'bar';
      const part = {
        type: PartType.Text,
        node: document.createTextNode(''),
        precedingText: '',
        followingText: '',
      };
      const binding = new TextBinding(value1, part);
      const updater = new TestUpdater();

      SESSION: {
        updater.startUpdate((session) => {
          binding.connect(session);
          binding.commit();
        });

        expect(binding.shouldBind(value1)).toBe(false);
        expect(binding.shouldBind(value2)).toBe(true);
      }
    });
  });

  describe('commit()', () => {
    it('sets the string to the text node', () => {
      const value1 = 'foo';
      const value2 = null;
      const part = {
        type: PartType.Text,
        node: document.createTextNode(''),
        precedingText: '(',
        followingText: ')',
      };
      const binding = new TextBinding<string | null>(value1, part);
      const updater = new TestUpdater();

      SESSION1: {
        updater.startUpdate((session) => {
          binding.connect(session);
          binding.commit();
        });

        expect(part.node.data).toBe('(' + value1 + ')');
      }

      SESSION2: {
        updater.startUpdate((session) => {
          binding.value = value2;
          binding.connect(session);
          binding.commit();
        });

        expect(part.node.data).toBe('()');
      }
    });

    it('sets the string representation of the value to the text node', () => {
      const value1 = 123;
      const value2 = null;
      const part = {
        type: PartType.Text,
        node: document.createTextNode(''),
        precedingText: '(',
        followingText: ')',
      };
      const binding = new TextBinding<number | null>(value1, part);
      const updater = new TestUpdater();

      SESSION1: {
        updater.startUpdate((session) => {
          binding.connect(session);
          binding.commit();
        });

        expect(part.node.nodeValue).toBe('(123)');
      }

      SESSION2: {
        updater.startUpdate((session) => {
          binding.value = value2;
          binding.connect(session);
          binding.commit();
        });

        expect(part.node.nodeValue).toBe('()');
      }
    });
  });

  describe('rollback()', () => {
    it('sets an empty string if the committed value exists', () => {
      const value = 'foo';
      const part = {
        type: PartType.Text,
        node: document.createTextNode(''),
        precedingText: '',
        followingText: '',
      };
      const binding = new TextBinding(value, part);
      const updater = new TestUpdater();

      SESSION1: {
        updater.startUpdate((session) => {
          binding.connect(session);
          binding.commit();
        });

        expect(part.node.data).toBe(value);
      }

      SESSION2: {
        updater.startUpdate((session) => {
          binding.disconnect(session);
          binding.rollback();
        });

        expect(part.node.data).toBe('');
      }
    });

    it('should do nothing if the committed value does not exist', () => {
      const value = 'foo';
      const part = {
        type: PartType.Text,
        node: document.createTextNode(''),
        precedingText: '',
        followingText: '',
      };
      const binding = new TextBinding(value, part);
      const updater = new TestUpdater();

      const setNodeValueSpy = vi.spyOn(part.node, 'nodeValue', 'set');

      SESSION: {
        updater.startUpdate((session) => {
          binding.disconnect(session);
          binding.rollback();
        });

        expect(setNodeValueSpy).not.toHaveBeenCalled();
      }
    });
  });
});
