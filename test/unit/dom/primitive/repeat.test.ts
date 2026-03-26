import { describe, expect, it } from 'vitest';
import { Directive, Primitive } from '@/core.js';
import { createChildNodePart, createElementPart } from '@/dom/part.js';
import { DOMRepeat, DOMRepeatBinding } from '@/dom/primitive/repeat.js';
import { createTestRuntime } from '../../../adapter.js';
import {
  allCombinations,
  createElement,
  permutations,
} from '../../../helpers.js';
import { SessionLauncher } from '../../../session-launcher.js';

const EMPTY_COMMENT = '<!---->';

describe('DOMRepeat', () => {
  describe('ensureValue()', () => {
    it('asserts values are iterable', () => {
      const part = createChildNodePart(document.createComment(''), null);

      expect(() => {
        DOMRepeat.ensureValue([], part);
        DOMRepeat.ensureValue(Iterator.from([]), part);
      }).not.toThrow();
    });

    it('throws an error when the value is not iterable', () => {
      const part = createChildNodePart(document.createComment(''), null);

      expect(() => {
        DOMRepeat.ensureValue({}, part);
      }).toThrow('Repeat values must be Iterable.');
    });
  });

  describe('resolveBinding()', () => {
    it('constructs a new DOMRepeatBinding', () => {
      const part = createChildNodePart(document.createComment(''), null);
      const runtime = createTestRuntime();
      const binding = DOMRepeat.resolveBinding([], part, runtime);

      expect(binding).toBeInstanceOf(DOMRepeatBinding);
      expect(binding.type).toBe(DOMRepeat);
      expect(binding.part).toBe(part);
    });

    it('throws the error when the part is not child node part', () => {
      const part = createElementPart(document.createElement('div'));
      const runtime = createTestRuntime();

      expect(() => DOMRepeat.resolveBinding([], part, runtime)).toThrow(
        'DOMRepeat must be used in ChildNodePart.',
      );
    });
  });
});

describe('DOMRepeatBinding', () => {
  const launcher = new SessionLauncher(createTestRuntime());

  describe('shouldUpdate()', () => {
    it('returns true when there are no current items', () => {
      const source = ['A'];
      const part = createChildNodePart(document.createComment(''), null);
      const binding = new DOMRepeatBinding(source, part);

      expect(binding.shouldUpdate(source)).toBe(true);
      expect(binding.shouldUpdate('A')).toBe(true);
      expect(binding.shouldUpdate('B')).toBe(true);
    });

    it('returns true when the new source reference differs from the current one', () => {
      const source = ['A'];
      const part = createChildNodePart(document.createComment(''), null);
      const binding = new DOMRepeatBinding(source, part);

      launcher.launchSession((session) => {
        binding.attach(session);
        binding.commit();
      });

      expect(binding.shouldUpdate(source)).toBe(false);
      expect(binding.shouldUpdate(['A'])).toBe(true);
      expect(binding.shouldUpdate(['B'])).toBe(true);
    });
  });

  describe('commit()', () => {
    it('updates items according to keys', () => {
      const source = [
        new Directive(Primitive, '1', 'A'),
        new Directive(Primitive, '2', 'B'),
        new Directive(Primitive, '3', 'C'),
        new Directive(Primitive, '4', 'D'),
      ];

      for (const combination1 of allCombinations(source)) {
        for (const combination2 of allCombinations(source)) {
          const part = createChildNodePart(document.createComment(''), null);
          const container = createElement('div', {}, part.node);
          const binding = new DOMRepeatBinding(combination1, part);

          launcher.launchSession((session) => {
            binding.attach(session);
            binding.commit();
          });

          expect(container.innerHTML).toBe(
            combination1.map(({ value }) => toCommentString(value)).join('') +
              '<!---->',
          );
          expect(part.node.nodeValue).toBe(combination1[0]?.value);

          launcher.launchSession((session) => {
            binding.value = combination2;
            binding.attach(session);
            binding.commit();
          });

          expect(container.innerHTML).toBe(
            combination2.map(({ value }) => toCommentString(value)).join('') +
              EMPTY_COMMENT,
          );
          expect(part.node.nodeValue).toBe(combination2[0]?.value);
        }
      }
    });

    it('updates items according to indexes', () => {
      const source = [
        new Directive(Primitive, '1'),
        new Directive(Primitive, '2'),
        new Directive(Primitive, '3'),
        new Directive(Primitive, '4'),
      ];

      for (const combination1 of allCombinations(source)) {
        for (const combination2 of allCombinations(source)) {
          const part = createChildNodePart(document.createComment(''), null);
          const container = createElement('div', {}, part.node);
          const binding = new DOMRepeatBinding(combination1, part);

          launcher.launchSession((session) => {
            binding.attach(session);
            binding.commit();
          });

          expect(container.innerHTML).toBe(
            combination1.map(({ value }) => toCommentString(value)).join('') +
              '<!---->',
          );
          expect(part.node.nodeValue).toBe(combination1[0]?.value);

          launcher.launchSession((session) => {
            binding.value = combination2;
            binding.attach(session);
            binding.commit();
          });

          expect(container.innerHTML).toBe(
            combination2.map(({ value }) => toCommentString(value)).join('') +
              EMPTY_COMMENT,
          );
          expect(part.node.nodeValue).toBe(combination2[0]?.value);
        }
      }
    });

    it('updates items containing duplicate keys', () => {
      const source1 = [
        new Directive(Primitive, '1', 'A'),
        new Directive(Primitive, '2', 'B'),
        new Directive(Primitive, '3', 'C'),
        new Directive(Primitive, '4', 'C'),
        new Directive(Primitive, '5', 'C'),
      ];
      const source2 = [
        new Directive(Primitive, '3', 'A'),
        new Directive(Primitive, '2', 'B'),
        new Directive(Primitive, '1', 'C'),
      ];

      for (const permutation1 of permutations(source1)) {
        for (const permutation2 of permutations(source2)) {
          const part = createChildNodePart(document.createComment(''), null);
          const container = createElement('div', {}, part.node);
          const binding = new DOMRepeatBinding(permutation1, part);

          launcher.launchSession((session) => {
            binding.attach(session);
            binding.commit();
          });

          expect(container.innerHTML).toBe(
            permutation1.map(({ value }) => toCommentString(value)).join('') +
              EMPTY_COMMENT,
          );
          expect(part.node.nodeValue).toBe(permutation1[0]?.value);

          launcher.launchSession((session) => {
            binding.value = permutation2;
            binding.attach(session);
            binding.commit();
          });

          expect(container.innerHTML).toBe(
            permutation2.map(({ value }) => toCommentString(value)).join('') +
              EMPTY_COMMENT,
          );
          expect(part.node.nodeValue).toBe(permutation2[0]?.value);

          launcher.launchSession((session) => {
            binding.value = permutation1;
            binding.attach(session);
            binding.commit();
          });

          expect(container.innerHTML).toBe(
            permutation1.map(({ value }) => toCommentString(value)).join('') +
              EMPTY_COMMENT,
          );
          expect(part.node.nodeValue).toBe(permutation1[0]?.value);
        }
      }
    });

    it('swaps items according to keys', () => {
      const source1 = [
        new Directive(Primitive, '1', 'A'),
        new Directive(Primitive, '2', 'B'),
        new Directive(Primitive, '3', 'C'),
      ];
      const source2 = [
        new Directive(Primitive, '3', 'A'),
        new Directive(Primitive, '2', 'B'),
        new Directive(Primitive, '1', 'C'),
      ];

      for (const permutation1 of permutations(source1)) {
        for (const permutation2 of permutations(source2)) {
          const part = createChildNodePart(document.createComment(''), null);
          const container = createElement('div', {}, part.node);
          const binding = new DOMRepeatBinding(permutation1, part);

          launcher.launchSession((session) => {
            binding.attach(session);
            binding.commit();
          });

          expect(container.innerHTML).toBe(
            permutation1.map(({ value }) => toCommentString(value)).join('') +
              EMPTY_COMMENT,
          );

          launcher.launchSession((session) => {
            binding.value = permutation2;
            binding.attach(session);
            binding.commit();
          });

          expect(container.innerHTML).toBe(
            permutation2.map(({ value }) => toCommentString(value)).join('') +
              EMPTY_COMMENT,
          );

          launcher.launchSession((session) => {
            binding.value = permutation1;
            binding.attach(session);
            binding.commit();
          });

          expect(container.innerHTML).toBe(
            permutation1.map(({ value }) => toCommentString(value)).join('') +
              EMPTY_COMMENT,
          );
        }
      }
    });
  });

  describe('rollback()', () => {
    it('removes current items when it exists', () => {
      const source = ['A', 'B', 'C'];
      const part = createChildNodePart(document.createComment(''), null);
      const container = createElement('div', {}, part.node);
      const binding = new DOMRepeatBinding(source, part);

      launcher.launchSession((session) => {
        binding.attach(session);
        binding.commit();
      });

      launcher.launchSession((session) => {
        binding.detach(session);
        binding.rollback();
      });

      expect(container.innerHTML).toBe(EMPTY_COMMENT);
    });
  });
});

function toCommentString(content: string): string {
  const node = document.createComment(content);
  return new XMLSerializer().serializeToString(node);
}
