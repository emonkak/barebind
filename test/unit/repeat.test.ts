import { describe, expect, it } from 'vitest';
import {
  BOUNDARY_TYPE_HYDRATION,
  Directive,
  Primitive,
  Scope,
} from '@/core.js';
import {
  createChildNodePart,
  createElementPart,
  createTreeWalker,
  HTML_NAMESPACE_URI,
} from '@/dom.js';
import { Repeat, RepeatBinding } from '@/repeat.js';
import { createRuntime } from '../mocks.js';
import {
  allCombinations,
  createElement,
  permutations,
} from '../test-helpers.js';
import { TestUpdater } from '../test-updater.js';

const EMPTY_COMMENT = '<!---->';

describe('Repeat()', () => {
  it('returns a new directive element with Repeat', () => {
    const source = ['A'];
    const bindable = Repeat(source);

    expect(bindable.type).toBe(Repeat);
    expect(bindable.value).toBe(source);
  });
});

describe('RepeatDirective', () => {
  describe('resolveBinding()', () => {
    it('constructs a new RepeatBinding', () => {
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );
      const runtime = createRuntime();
      const binding = Repeat.resolveBinding([], part, runtime);

      expect(binding).toBeInstanceOf(RepeatBinding);
      expect(binding.type).toBe(Repeat);
      expect(binding.part).toBe(part);
    });

    it('throws the error when the part is not child node part', () => {
      const part = createElementPart(document.createElement('div'));
      const runtime = createRuntime();

      expect(() => Repeat.resolveBinding([], part, runtime)).toThrow(
        'Repeat must be used in ChildNodePart.',
      );
    });
  });
});

describe('RepeatBinding', () => {
  describe('shouldUpdate()', () => {
    it('returns true when there is no current slots', () => {
      const source = ['A'];
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );
      const binding = new RepeatBinding(source, part);

      expect(binding.shouldUpdate(source)).toBe(true);
    });

    it('returns true when the new source is different', () => {
      const source1 = ['A'];
      const source2 = ['B'];
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );
      const binding = new RepeatBinding(source1, part);
      const updater = new TestUpdater();

      SESSION: {
        updater.startUpdate((session) => {
          binding.attach(session);
          binding.commit();
        });

        expect(binding.shouldUpdate(source1)).toBe(false);
        expect(binding.shouldUpdate(source2)).toBe(true);
      }
    });
  });

  describe('attach()', () => {
    it('updates slots according to keys', () => {
      const source = [
        new Directive(Primitive, '1', 'A'),
        new Directive(Primitive, '2', 'B'),
        new Directive(Primitive, '3', 'C'),
        new Directive(Primitive, '4', 'D'),
      ];

      for (const combination1 of allCombinations(source)) {
        for (const combination2 of allCombinations(source)) {
          const part = createChildNodePart(
            document.createComment(''),
            HTML_NAMESPACE_URI,
          );
          const container = createElement('div', {}, part.node);
          const binding = new RepeatBinding(combination1, part);
          const updater = new TestUpdater();

          SESSION1: {
            updater.startUpdate((session) => {
              binding.attach(session);
              binding.commit();
            });

            expect(container.innerHTML).toBe(
              combination1.map(({ value }) => toCommentString(value)).join('') +
                '<!---->',
            );
            expect(part.node.nodeValue).toBe(combination1[0]?.value);
          }

          SESSION2: {
            updater.startUpdate((session) => {
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
      }
    });

    it('updates slots according to indexes', () => {
      const source = [
        new Directive(Primitive, '1'),
        new Directive(Primitive, '2'),
        new Directive(Primitive, '3'),
        new Directive(Primitive, '4'),
      ];

      for (const combination1 of allCombinations(source)) {
        for (const combination2 of allCombinations(source)) {
          const part = createChildNodePart(
            document.createComment(''),
            HTML_NAMESPACE_URI,
          );
          const container = createElement('div', {}, part.node);
          const binding = new RepeatBinding(combination1, part);
          const updater = new TestUpdater();

          SESSION1: {
            updater.startUpdate((session) => {
              binding.attach(session);
              binding.commit();
            });

            expect(container.innerHTML).toBe(
              combination1.map(({ value }) => toCommentString(value)).join('') +
                '<!---->',
            );
            expect(part.node.nodeValue).toBe(combination1[0]?.value);
          }

          SESSION2: {
            updater.startUpdate((session) => {
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
      }
    });

    it('updates slots containing duplicate keys', () => {
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
          const part = createChildNodePart(
            document.createComment(''),
            HTML_NAMESPACE_URI,
          );
          const container = createElement('div', {}, part.node);
          const binding = new RepeatBinding(permutation1, part);
          const updater = new TestUpdater();

          SESSION1: {
            updater.startUpdate((session) => {
              binding.attach(session);
              binding.commit();
            });

            expect(container.innerHTML).toBe(
              permutation1.map(({ value }) => toCommentString(value)).join('') +
                EMPTY_COMMENT,
            );
            expect(part.node.nodeValue).toBe(permutation1[0]?.value);
          }

          SESSION2: {
            updater.startUpdate((session) => {
              binding.value = permutation2;
              binding.attach(session);
              binding.commit();
            });

            expect(container.innerHTML).toBe(
              permutation2.map(({ value }) => toCommentString(value)).join('') +
                EMPTY_COMMENT,
            );
            expect(part.node.nodeValue).toBe(permutation2[0]?.value);
          }

          SESSION3: {
            updater.startUpdate((session) => {
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
      }
    });

    it('swaps slots according to keys', () => {
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
          const part = createChildNodePart(
            document.createComment(''),
            HTML_NAMESPACE_URI,
          );
          const container = createElement('div', {}, part.node);
          const binding = new RepeatBinding(permutation1, part);
          const updater = new TestUpdater();

          SESSION1: {
            updater.startUpdate((session) => {
              binding.attach(session);
              binding.commit();
            });

            expect(container.innerHTML).toBe(
              permutation1.map(({ value }) => toCommentString(value)).join('') +
                EMPTY_COMMENT,
            );
          }

          SESSION2: {
            updater.startUpdate((session) => {
              binding.value = permutation2;
              binding.attach(session);
              binding.commit();
            });

            expect(container.innerHTML).toBe(
              permutation2.map(({ value }) => toCommentString(value)).join('') +
                EMPTY_COMMENT,
            );
          }

          SESSION3: {
            updater.startUpdate((session) => {
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
      }
    });

    it('hydrates targets when the origin scope has a hydration boundary', () => {
      const source = ['A', 'B', 'C'];
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );
      const binding = new RepeatBinding(source, part);
      const container = createElement(
        'div',
        {},
        document.createComment('A'),
        document.createComment('B'),
        document.createComment('C'),
        part.sentinelNode,
      );
      const scope = new Scope();
      const hydrationTarget = createTreeWalker(container);
      const updater = new TestUpdater(scope);

      scope.boundary = {
        type: BOUNDARY_TYPE_HYDRATION,
        next: scope.boundary,
        target: hydrationTarget,
      };

      updater.startUpdate((session) => {
        binding.attach(session);
      });

      binding.commit();

      expect(part.node).toBe(container.firstChild);
      expect(container.innerHTML).toBe(
        source.map((item) => toCommentString(item)).join('') + EMPTY_COMMENT,
      );
    });
  });

  describe('detach()', () => {
    it('detaches current slots when it exists', () => {
      const source = ['foo', 'bar', 'baz'];
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );
      const container = createElement('div', {}, part.node);
      const binding = new RepeatBinding(source, part);
      const updater = new TestUpdater();

      SESSION1: {
        updater.startUpdate((session) => {
          binding.attach(session);
          binding.commit();
        });

        expect(container.innerHTML).toBe(
          source.map(toCommentString).join('') + EMPTY_COMMENT,
        );
      }

      SESSION2: {
        updater.startUpdate((session) => {
          binding.detach(session);
          binding.rollback();
        });

        expect(container.innerHTML).toBe(EMPTY_COMMENT);
      }

      SESSION3: {
        updater.startUpdate((session) => {
          binding.attach(session);
          binding.commit();
        });

        expect(container.innerHTML).toBe(
          source.map(toCommentString).join('') + EMPTY_COMMENT,
        );
      }
    });
  });
});

function toCommentString(content: string): string {
  const node = document.createComment(content);
  return new XMLSerializer().serializeToString(node);
}
