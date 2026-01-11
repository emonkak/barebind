import { describe, expect, it } from 'vitest';

import { DirectiveSpecifier } from '@/directive.js';
import { createTreeWalker } from '@/hydration.js';
import { BoundaryType, createScope, type Part, PartType } from '@/internal.js';
import {
  Repeat,
  RepeatBinding,
  RepeatDirective,
  type RepeatProps,
} from '@/repeat.js';
import { HTML_NAMESPACE_URI } from '@/template/template.js';
import { TextTemplate } from '@/template/text.js';
import {
  allCombinations,
  createElement,
  createRuntime,
  permutations,
  TestUpdater,
} from '../test-helpers.js';

const TEXT_TEMPLATE = new TextTemplate<string>();

const EMPTY_COMMENT = '<!---->';

type KeyValuePair = { key: string; value: string };

describe('Repeat()', () => {
  it('returns a new DirectiveSpecifier with RepeatDirective', () => {
    const props: RepeatProps<string> = {
      items: ['foo', 'bar', 'baz'],
    };
    const bindable = Repeat(props);

    expect(bindable.type).toBe(RepeatDirective);
    expect(bindable.value).toBe(props);
  });
});

describe('RepeatDirective', () => {
  describe('resolveBinding()', () => {
    it('constructs a new RepeatBinding', () => {
      const props: RepeatProps<string> = { items: ['foo', 'bar', 'baz'] };
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const runtime = createRuntime();
      const binding = RepeatDirective.resolveBinding(props, part, runtime);

      expect(binding.type).toBe(RepeatDirective);
      expect(binding.value).toBe(props);
      expect(binding.part).toBe(part);
    });

    it('should throw the error if the part is not a child node part', () => {
      const props: RepeatProps<string> = { items: ['foo', 'bar', 'baz'] };
      const part = {
        type: PartType.Element,
        node: document.createElement('div'),
      };
      const runtime = createRuntime();

      expect(() =>
        RepeatDirective.resolveBinding(props, part, runtime),
      ).toThrow('RepeatDirective must be used in ChildNodePart.');
    });
  });
});

describe('RepeatBinding', () => {
  describe('shouldUpdate()', () => {
    it('returns true if committed slots does not exist', () => {
      const props: RepeatProps<string> = { items: ['foo', 'bar', 'baz'] };
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new RepeatBinding(props, part);

      expect(binding.shouldUpdate(props)).toBe(true);
    });

    it('returns true if the props is different from the new one', () => {
      const props1: RepeatProps<string> = { items: ['foo', 'bar', 'baz'] };
      const props2: RepeatProps<string> = { items: ['baz', 'bar', 'foo'] };
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new RepeatBinding(props1, part);
      const updater = new TestUpdater();

      SESSION: {
        updater.startUpdate((session) => {
          binding.attach(session);
          binding.commit();
        });

        expect(binding.shouldUpdate(props1)).toBe(false);
        expect(binding.shouldUpdate({ ...props1 })).toBe(false);
        expect(binding.shouldUpdate(props2)).toBe(true);
      }
    });
  });

  describe('attach()', () => {
    it('updates slots according to keys', () => {
      const items: KeyValuePair[] = [
        { key: 'one', value: 'foo' },
        { key: 'two', value: 'bar' },
        { key: 'three', value: 'baz' },
        { key: 'four', value: 'qux' },
      ];

      for (const combinations1 of allCombinations(items)) {
        for (const combinations2 of allCombinations(items)) {
          const props1: RepeatProps<KeyValuePair> = {
            items: combinations1,
            keySelector: ({ key }) => key,
            valueSelector: ({ value }) => textTemplate(value),
          };
          const props2: RepeatProps<KeyValuePair> = {
            items: combinations2,
            keySelector: ({ key }) => key,
            valueSelector: ({ value }) => textTemplate(value),
          };
          const part: Part.ChildNodePart = {
            type: PartType.ChildNode,
            node: document.createComment(''),
            anchorNode: null,
            namespaceURI: HTML_NAMESPACE_URI,
          };
          const container = createElement('div', {}, part.node);
          const binding = new RepeatBinding(props1, part);
          const updater = new TestUpdater();

          SESSION1: {
            updater.startUpdate((session) => {
              binding.attach(session);
              binding.commit();
            });

            expect(container.innerHTML).toBe(
              combinations1.map(({ value }) => value + EMPTY_COMMENT).join('') +
                '<!---->',
            );
            expect(part.anchorNode?.nodeValue).toBe(combinations1[0]?.value);
          }

          SESSION2: {
            updater.startUpdate((session) => {
              binding.value = props2;
              binding.attach(session);
              binding.commit();
            });

            expect(container.innerHTML).toBe(
              combinations2.map(({ value }) => value + EMPTY_COMMENT).join('') +
                EMPTY_COMMENT,
            );
            expect(part.anchorNode?.nodeValue).toBe(combinations2[0]?.value);
          }
        }
      }
    });

    it('updates slots containing duplicate keys', () => {
      const items1: KeyValuePair[] = [
        { key: 'one', value: 'foo' },
        { key: 'two', value: 'bar' },
        { key: 'three', value: 'baz' },
        { key: 'three', value: 'qux' },
        { key: 'three', value: 'quux' },
      ];
      const items2: KeyValuePair[] = [
        { key: 'one', value: 'foo' },
        { key: 'two', value: 'bar' },
        { key: 'three', value: 'baz' },
      ];

      for (const permutation1 of permutations(items1)) {
        for (const permutation2 of permutations(items2)) {
          const props1: RepeatProps<KeyValuePair> = {
            items: permutation1,
            keySelector: ({ key }) => key,
            valueSelector: ({ value }) => textTemplate(value),
          };
          const props2: RepeatProps<KeyValuePair> = {
            items: permutation2,
            keySelector: ({ key }) => key,
            valueSelector: ({ value }) => textTemplate(value),
          };
          const part: Part.ChildNodePart = {
            type: PartType.ChildNode,
            node: document.createComment(''),
            anchorNode: null,
            namespaceURI: HTML_NAMESPACE_URI,
          };
          const container = createElement('div', {}, part.node);
          const binding = new RepeatBinding(props1, part);
          const updater = new TestUpdater();

          SESSION1: {
            updater.startUpdate((session) => {
              binding.attach(session);
              binding.commit();
            });

            expect(container.innerHTML).toBe(
              permutation1.map(({ value }) => value + EMPTY_COMMENT).join('') +
                EMPTY_COMMENT,
            );
            expect(part.anchorNode?.nodeValue).toBe(permutation1[0]?.value);
          }

          SESSION2: {
            updater.startUpdate((session) => {
              binding.value = props2;
              binding.attach(session);
              binding.commit();
            });

            expect(container.innerHTML).toBe(
              permutation2.map(({ value }) => value + EMPTY_COMMENT).join('') +
                EMPTY_COMMENT,
            );
            expect(part.anchorNode?.nodeValue).toBe(permutation2[0]?.value);
          }

          SESSION3: {
            updater.startUpdate((session) => {
              binding.value = props1;
              binding.attach(session);
              binding.commit();
            });

            expect(container.innerHTML).toBe(
              permutation1.map(({ value }) => value + EMPTY_COMMENT).join('') +
                EMPTY_COMMENT,
            );
            expect(part.anchorNode?.nodeValue).toBe(permutation1[0]?.value);
          }
        }
      }
    });

    it('hydrates the tree by slots', () => {
      const items = ['foo', 'bar', 'baz'];
      const props: RepeatProps<string> = {
        items,
        valueSelector: textTemplate,
      };
      const part: Part.ChildNodePart = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new RepeatBinding(props, part);
      const container = createElement(
        'div',
        {},
        'foo',
        document.createComment(''),
        'bar',
        document.createComment(''),
        'baz',
        document.createComment(''),
        document.createComment(''),
      );
      const scope = createScope();
      const targetTree = createTreeWalker(container);
      const updater = new TestUpdater();

      scope.boundary = {
        type: BoundaryType.Hydration,
        next: scope.boundary,
        targetTree,
      };

      updater.startUpdate(
        (session) => {
          binding.attach(session);
        },
        { scope },
      );

      expect(part.anchorNode).toBe(container.firstChild);
      expect(container.innerHTML).toBe(
        items.map((element) => element + EMPTY_COMMENT).join('') +
          EMPTY_COMMENT,
      );

      binding.commit();

      expect(part.anchorNode).toBe(container.firstChild);
      expect(container.innerHTML).toBe(
        items.map((element) => element + EMPTY_COMMENT).join('') +
          EMPTY_COMMENT,
      );
    });

    it('swaps slots according to keys', () => {
      const items1: KeyValuePair[] = [
        { key: 'one', value: 'foo' },
        { key: 'two', value: 'bar' },
        { key: 'three', value: 'baz' },
      ];
      const items2: KeyValuePair[] = [
        { key: 'one', value: 'baz' },
        { key: 'two', value: 'bar' },
        { key: 'three', value: 'foo' },
      ];

      for (const permutation1 of permutations(items1)) {
        for (const permutation2 of permutations(items2)) {
          const props1: RepeatProps<KeyValuePair> = {
            items: permutation1,
            keySelector: ({ key }) => key,
            valueSelector: ({ value }) => value,
          };
          const props2: RepeatProps<KeyValuePair> = {
            items: permutation2,
            keySelector: ({ key }) => key,
            valueSelector: ({ value }) => value,
          };
          const part: Part.ChildNodePart = {
            type: PartType.ChildNode,
            node: document.createComment(''),
            anchorNode: null,
            namespaceURI: HTML_NAMESPACE_URI,
          };
          const container = createElement('div', {}, part.node);
          const binding = new RepeatBinding(props1, part);
          const updater = new TestUpdater();

          SESSION1: {
            updater.startUpdate((session) => {
              binding.attach(session);
              binding.commit();
            });

            expect(container.innerHTML).toBe(
              permutation1.map(({ value }) => `<!--${value}-->`).join('') +
                EMPTY_COMMENT,
            );
            expect(part.anchorNode?.nodeValue).toBe(permutation1[0]?.value);
          }

          SESSION2: {
            updater.startUpdate((session) => {
              binding.value = props2;
              binding.attach(session);
              binding.commit();
            });

            expect(container.innerHTML).toBe(
              permutation2.map(({ value }) => `<!--${value}-->`).join('') +
                EMPTY_COMMENT,
            );
            expect(part.anchorNode?.nodeValue).toBe(permutation2[0]?.value);
          }

          SESSION3: {
            updater.startUpdate((session) => {
              binding.value = props1;
              binding.attach(session);
              binding.commit();
            });

            expect(container.innerHTML).toBe(
              permutation1.map(({ value }) => `<!--${value}-->`).join('') +
                EMPTY_COMMENT,
            );
            expect(part.anchorNode?.nodeValue).toBe(permutation1[0]?.value);
          }
        }
      }
    });

    it.each([
      [
        ['foo', 'bar', 'baz'],
        ['qux', 'baz', 'bar', 'foo'],
      ],
      [
        ['foo', 'bar', 'baz'],
        ['bar', 'foo'],
      ],
      [['foo', 'bar', 'baz'], []],
    ])('updates slots with a iterator according to indexes', (items1, items2) => {
      const props1: RepeatProps<string> = {
        items: { [Symbol.iterator]: () => Iterator.from(items1) },
      };
      const props2: RepeatProps<string> = {
        items: { [Symbol.iterator]: () => Iterator.from(items2) },
      };
      const part: Part.ChildNodePart = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const container = createElement('div', {}, part.node);
      const binding = new RepeatBinding(props1, part);
      const updater = new TestUpdater();

      SESSION1: {
        updater.startUpdate((session) => {
          binding.attach(session);
          binding.commit();
        });

        expect(container.innerHTML).toBe(
          items1.map(toCommentString).join('') + EMPTY_COMMENT,
        );
        expect(part.anchorNode?.nodeValue).toBe(items1[0]);
      }

      SESSION2: {
        updater.startUpdate((session) => {
          binding.value = props2;
          binding.attach(session);
          binding.commit();
        });

        expect(container.innerHTML).toBe(
          items2.map(toCommentString).join('') + EMPTY_COMMENT,
        );
        expect(part.anchorNode?.nodeValue).toBe(items2[0]);
      }

      SESSION3: {
        updater.startUpdate((session) => {
          binding.value = props1;
          binding.attach(session);
          binding.commit();
        });

        expect(container.innerHTML).toBe(
          items1.map(toCommentString).join('') + EMPTY_COMMENT,
        );
        expect(part.anchorNode?.nodeValue).toBe(items1[0]);
      }
    });
  });

  describe('detach()', () => {
    it('should restore rollbacked slots', () => {
      const items = ['foo', 'bar', 'baz'];
      const props: RepeatProps<string> = {
        items,
      };
      const part: Part.ChildNodePart = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const container = createElement('div', {}, part.node);
      const binding = new RepeatBinding(props, part);
      const updater = new TestUpdater();

      SESSION1: {
        updater.startUpdate((session) => {
          binding.attach(session);
          binding.commit();
        });

        expect(container.innerHTML).toBe(
          items.map(toCommentString).join('') + EMPTY_COMMENT,
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
          items.map(toCommentString).join('') + EMPTY_COMMENT,
        );
      }
    });
  });
});

function textTemplate(content: string): DirectiveSpecifier<readonly [string]> {
  return new DirectiveSpecifier(TEXT_TEMPLATE, [content]);
}

function toCommentString(content: string): string {
  const node = document.createComment(content);
  return new XMLSerializer().serializeToString(node);
}
