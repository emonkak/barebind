import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HydrationError, HydrationTree, type Part, PartType } from '@/core.js';
import { DirectiveSpecifier } from '@/directive.js';
import {
  moveChildNodes,
  RepeatBinding,
  RepeatDirective,
  type RepeatProps,
  repeat,
} from '@/repeat.js';
import { Runtime } from '@/runtime.js';
import { HTML_NAMESPACE_URI } from '@/template/template.js';
import { TextTemplate } from '@/template/text.js';
import { MockBackend } from '../mocks.js';
import { allCombinations, createElement, permutations } from '../test-utils.js';

const TEXT_TEMPLATE = new TextTemplate<string>();

const EMPTY_COMMENT = '<!---->';

type KeyValuePair = { key: string; value: string };

describe('repeat()', () => {
  it('returns a new DirectiveSpecifier with RepeatDirective', () => {
    const props: RepeatProps<string> = {
      source: ['foo', 'bar', 'baz'],
    };
    const bindable = repeat(props);

    expect(bindable.type).toBe(RepeatDirective);
    expect(bindable.value).toBe(props);
  });
});

describe('RepeatDirective', () => {
  describe('name', () => {
    it('is a string that represents the primitive itself', () => {
      expect(RepeatDirective.name, 'RepeatDirective');
    });
  });

  describe('resolveBinding()', () => {
    it('constructs a new RepeatBinding', () => {
      const props: RepeatProps<string> = { source: ['foo', 'bar', 'baz'] };
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const runtime = Runtime.create(new MockBackend());
      const binding = RepeatDirective.resolveBinding(props, part, runtime);

      expect(binding.type).toBe(RepeatDirective);
      expect(binding.value).toBe(props);
      expect(binding.part).toBe(part);
    });

    it('should throw the error if the part is not an attribute part', () => {
      const props: RepeatProps<string> = { source: ['foo', 'bar', 'baz'] };
      const part = {
        type: PartType.Element,
        node: document.createElement('div'),
      };
      const runtime = Runtime.create(new MockBackend());

      expect(() =>
        RepeatDirective.resolveBinding(props, part, runtime),
      ).toThrow('RepeatDirective must be used in a child part,');
    });
  });
});

describe('RepeatBinding', () => {
  describe('shouldBind()', () => {
    it('returns true if committed items does not exist', () => {
      const props: RepeatProps<string> = { source: ['foo', 'bar', 'baz'] };
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new RepeatBinding(props, part);

      expect(binding.shouldBind(props)).toBe(true);
    });

    it('returns true if the props is different from the new one', () => {
      const props1: RepeatProps<string> = { source: ['foo', 'bar', 'baz'] };
      const props2: RepeatProps<string> = { source: ['baz', 'bar', 'foo'] };
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new RepeatBinding(props1, part);
      const runtime = Runtime.create(new MockBackend());

      binding.connect(runtime);
      binding.commit(runtime);

      expect(binding.shouldBind(props1)).toBe(false);
      expect(binding.shouldBind({ ...props1 })).toBe(false);
      expect(binding.shouldBind(props2)).toBe(true);
    });
  });

  describe('hydrate()', () => {
    it('hydrates the tree by items', () => {
      const source = ['foo', 'bar', 'baz'];
      const props: RepeatProps<string> = {
        source,
        valueSelector: textTemplate,
      };
      const part: Part.ChildNodePart = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
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
      const tree = new HydrationTree(container);
      const binding = new RepeatBinding(props, part);
      const runtime = Runtime.create(new MockBackend());

      binding.hydrate(tree, runtime);
      binding.commit(runtime);

      expect(container.innerHTML).toBe(
        source.map((element) => element + EMPTY_COMMENT).join('') +
          EMPTY_COMMENT,
      );
    });

    it('should throw the error if the items has already been initialized', () => {
      const source = ['foo', 'bar', 'baz'];
      const props: RepeatProps<string> = {
        source,
        valueSelector: textTemplate,
      };
      const part: Part.ChildNodePart = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
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
      const tree = new HydrationTree(container);
      const binding = new RepeatBinding(props, part);
      const runtime = Runtime.create(new MockBackend());

      binding.connect(runtime);
      binding.commit(runtime);

      expect(() => {
        binding.hydrate(tree, runtime);
      }).toThrow(HydrationError);
    });
  });

  describe('connect()', () => {
    it('updates items according to keys', () => {
      const source: KeyValuePair[] = [
        { key: 'one', value: 'foo' },
        { key: 'two', value: 'bar' },
        { key: 'three', value: 'baz' },
        { key: 'four', value: 'qux' },
      ];

      for (const combinations1 of allCombinations(source)) {
        for (const combinations2 of allCombinations(source)) {
          const props1: RepeatProps<KeyValuePair> = {
            source: combinations1,
            keySelector: ({ key }) => key,
            valueSelector: ({ value }) => textTemplate(value),
          };
          const props2: RepeatProps<KeyValuePair> = {
            source: combinations2,
            keySelector: ({ key }) => key,
            valueSelector: ({ value }) => textTemplate(value),
          };
          const part: Part.ChildNodePart = {
            type: PartType.ChildNode,
            node: document.createComment(''),
            childNode: null,
            namespaceURI: HTML_NAMESPACE_URI,
          };
          const container = createElement('div', {}, part.node);
          const binding = new RepeatBinding(props1, part);
          const runtime = Runtime.create(new MockBackend());

          binding.connect(runtime);
          binding.commit(runtime);

          expect(container.innerHTML).toBe(
            combinations1.map(({ value }) => value + EMPTY_COMMENT).join('') +
              '<!---->',
          );
          expect(part.childNode?.nodeValue).toBe(combinations1[0]?.value);

          binding.bind(props2);
          binding.connect(runtime);
          binding.commit(runtime);

          expect(container.innerHTML).toBe(
            combinations2.map(({ value }) => value + EMPTY_COMMENT).join('') +
              EMPTY_COMMENT,
          );
          expect(part.childNode?.nodeValue).toBe(combinations2[0]?.value);
        }
      }
    });

    it('updates items containing duplicate keys', () => {
      const source1: KeyValuePair[] = [
        { key: 'one', value: 'foo' },
        { key: 'two', value: 'bar' },
        { key: 'three', value: 'baz' },
        { key: 'three', value: 'qux' },
        { key: 'three', value: 'quux' },
      ];
      const source2: KeyValuePair[] = [
        { key: 'one', value: 'foo' },
        { key: 'two', value: 'bar' },
        { key: 'three', value: 'baz' },
      ];

      for (const permutation1 of permutations(source1)) {
        for (const permutation2 of permutations(source2)) {
          const props1: RepeatProps<KeyValuePair> = {
            source: permutation1,
            keySelector: ({ key }) => key,
            valueSelector: ({ value }) => textTemplate(value),
          };
          const props2: RepeatProps<KeyValuePair> = {
            source: permutation2,
            keySelector: ({ key }) => key,
            valueSelector: ({ value }) => textTemplate(value),
          };
          const part: Part.ChildNodePart = {
            type: PartType.ChildNode,
            node: document.createComment(''),
            childNode: null,
            namespaceURI: HTML_NAMESPACE_URI,
          };
          const container = createElement('div', {}, part.node);
          const binding = new RepeatBinding(props1, part);
          const runtime = Runtime.create(new MockBackend());

          binding.connect(runtime);
          binding.commit(runtime);

          expect(container.innerHTML).toBe(
            permutation1.map(({ value }) => value + EMPTY_COMMENT).join('') +
              EMPTY_COMMENT,
          );
          expect(part.childNode?.nodeValue).toBe(permutation1[0]?.value);

          binding.bind(props2);
          binding.connect(runtime);
          binding.commit(runtime);

          expect(container.innerHTML).toBe(
            permutation2.map(({ value }) => value + EMPTY_COMMENT).join('') +
              EMPTY_COMMENT,
          );
          expect(part.childNode?.nodeValue).toBe(permutation2[0]?.value);

          binding.bind(props1);
          binding.connect(runtime);
          binding.commit(runtime);

          expect(container.innerHTML).toBe(
            permutation1.map(({ value }) => value + EMPTY_COMMENT).join('') +
              EMPTY_COMMENT,
          );
          expect(part.childNode?.nodeValue).toBe(permutation1[0]?.value);
        }
      }
    });

    it('swaps items according to keys', () => {
      const source1: KeyValuePair[] = [
        { key: 'one', value: 'foo' },
        { key: 'two', value: 'bar' },
        { key: 'three', value: 'baz' },
      ];
      const source2: KeyValuePair[] = [
        { key: 'one', value: 'baz' },
        { key: 'two', value: 'bar' },
        { key: 'three', value: 'foo' },
      ];

      for (const permutation1 of permutations(source1)) {
        for (const permutation2 of permutations(source2)) {
          const props1: RepeatProps<KeyValuePair> = {
            source: permutation1,
            keySelector: ({ key }) => key,
            valueSelector: ({ value }) => value,
          };
          const props2: RepeatProps<KeyValuePair> = {
            source: permutation2,
            keySelector: ({ key }) => key,
            valueSelector: ({ value }) => value,
          };
          const part: Part.ChildNodePart = {
            type: PartType.ChildNode,
            node: document.createComment(''),
            childNode: null,
            namespaceURI: HTML_NAMESPACE_URI,
          };
          const container = createElement('div', {}, part.node);
          const binding = new RepeatBinding(props1, part);
          const runtime = Runtime.create(new MockBackend());

          binding.connect(runtime);
          binding.commit(runtime);

          expect(container.innerHTML).toBe(
            permutation1.map(({ value }) => `<!--${value}-->`).join('') +
              EMPTY_COMMENT,
          );
          expect(part.childNode?.nodeValue).toBe(permutation1[0]?.value);

          binding.bind(props2);
          binding.connect(runtime);
          binding.commit(runtime);

          expect(container.innerHTML).toBe(
            permutation2.map(({ value }) => `<!--${value}-->`).join('') +
              EMPTY_COMMENT,
          );
          expect(part.childNode?.nodeValue).toBe(permutation2[0]?.value);

          binding.bind(props1);
          binding.connect(runtime);
          binding.commit(runtime);

          expect(container.innerHTML).toBe(
            permutation1.map(({ value }) => `<!--${value}-->`).join('') +
              EMPTY_COMMENT,
          );
          expect(part.childNode?.nodeValue).toBe(permutation1[0]?.value);
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
    ])('updates items according to indexes', (source1, source2) => {
      const props1: RepeatProps<string> = {
        source: source1,
      };
      const props2: RepeatProps<string> = {
        source: source2,
      };
      const part: Part.ChildNodePart = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const container = createElement('div', {}, part.node);
      const binding = new RepeatBinding(props1, part);
      const runtime = Runtime.create(new MockBackend());

      binding.connect(runtime);
      binding.commit(runtime);

      expect(container.innerHTML).toBe(
        source1.map(toComment).join('') + EMPTY_COMMENT,
      );
      expect(part.childNode?.nodeValue).toBe(source1[0]);

      binding.bind(props2);
      binding.connect(runtime);
      binding.commit(runtime);

      expect(container.innerHTML).toBe(
        source2.map(toComment).join('') + EMPTY_COMMENT,
      );
      expect(part.childNode?.nodeValue).toBe(source2[0]);

      binding.bind(props1);
      binding.connect(runtime);
      binding.commit(runtime);

      expect(container.innerHTML).toBe(
        source1.map(toComment).join('') + EMPTY_COMMENT,
      );
      expect(part.childNode?.nodeValue).toBe(source1[0]);
    });
  });

  describe('disconnect()', () => {
    it('should restore disconnected items', () => {
      const source = ['foo', 'bar', 'baz'];
      const props: RepeatProps<string> = {
        source,
      };
      const part: Part.ChildNodePart = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const container = createElement('div', {}, part.node);
      const binding = new RepeatBinding(props, part);
      const runtime = Runtime.create(new MockBackend());

      binding.connect(runtime);
      binding.commit(runtime);

      expect(container.innerHTML).toBe(
        source.map(toComment).join('') + EMPTY_COMMENT,
      );

      binding.disconnect(runtime);
      binding.rollback(runtime);

      expect(container.innerHTML).toBe(EMPTY_COMMENT);

      binding.connect(runtime);
      binding.commit(runtime);

      expect(container.innerHTML).toBe(
        source.map(toComment).join('') + EMPTY_COMMENT,
      );
    });
  });
});

describe.for([true, false])('moveChildNodes()', (useMoveBefore) => {
  const originalMoveBefore = Element.prototype.moveBefore;

  beforeEach(() => {
    if (useMoveBefore) {
      Element.prototype.moveBefore ??= Element.prototype.insertBefore;
    } else {
      Element.prototype.moveBefore = undefined as any;
    }
  });

  afterEach(() => {
    Element.prototype.moveBefore = originalMoveBefore;
  });

  it('moves child nodes to before reference node', () => {
    const foo = createElement('div', {}, 'foo');
    const bar = createElement('div', {}, 'bar');
    const baz = createElement('div', {}, 'baz');
    const qux = createElement('div', {}, 'qux');
    const container = createElement('div', {}, foo, bar, baz, qux);

    moveChildNodes([foo], qux);

    expect(container.innerHTML).toBe(
      '<div>bar</div><div>baz</div><div>foo</div><div>qux</div>',
    );

    moveChildNodes([foo, qux], bar);

    expect(container.innerHTML).toBe(
      '<div>foo</div><div>qux</div><div>bar</div><div>baz</div>',
    );
  });
});

function textTemplate(content: string): DirectiveSpecifier<readonly [string]> {
  return new DirectiveSpecifier(TEXT_TEMPLATE, [content]);
}

function toComment(content: string): string {
  const node = document.createComment(content);
  return new XMLSerializer().serializeToString(node);
}
