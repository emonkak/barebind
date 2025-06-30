import { describe, expect, it } from 'vitest';
import { createDirectiveObject, type DirectiveObject } from '@/directive.js';
import {
  RepeatBinding,
  RepeatDirective,
  type RepeatProps,
  repeat,
} from '@/extensions/repeat.js';
import { HydrationTree } from '@/hydration.js';
import { type ChildNodePart, PartType } from '@/part.js';
import { TextTemplate } from '@/template/textTemplate.js';
import { UpdateEngine } from '@/updateEngine.js';
import { MockRenderHost } from '../../mocks.js';
import {
  allCombinations,
  createElement,
  permutations,
} from '../../testUtils.js';

const TEXT_TEMPLATE = new TextTemplate<string>('', '');

describe('repeat()', () => {
  it('returns a DirectiveObject with RepeatDirective', () => {
    const props: RepeatProps<string> = {
      source: ['foo', 'bar', 'baz'],
    };
    const element = repeat(props);

    expect(element.directive).toBe(RepeatDirective);
    expect(element.value).toBe(props);
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
      } as const;
      const context = new UpdateEngine(new MockRenderHost());
      const binding = RepeatDirective.resolveBinding(props, part, context);

      expect(binding.directive).toBe(RepeatDirective);
      expect(binding.value).toBe(props);
      expect(binding.part).toBe(part);
    });

    it('should throw the error if the part is not an attribute part', () => {
      const props: RepeatProps<string> = { source: ['foo', 'bar', 'baz'] };
      const part = {
        type: PartType.Element,
        node: document.createElement('div'),
      } as const;
      const context = new UpdateEngine(new MockRenderHost());

      expect(() =>
        RepeatDirective.resolveBinding(props, part, context),
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
      } as const;
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
      } as const;
      const binding = new RepeatBinding(props1, part);
      const context = new UpdateEngine(new MockRenderHost());

      binding.connect(context);
      binding.commit(context);

      expect(binding.shouldBind(props1)).toBe(false);
      expect(binding.shouldBind(props2)).toBe(true);
    });
  });

  describe('hydrate()', () => {
    it('hydrates items', () => {
      const source = ['foo', 'bar', 'baz'];
      const props: RepeatProps<string> = {
        source,
        valueSelector: textTemplateObject,
      };
      const part: ChildNodePart = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      };
      const hydrationRoot = createElement(
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
      const hydrationTree = new HydrationTree(hydrationRoot);
      const binding = new RepeatBinding(props, part);
      const context = new UpdateEngine(new MockRenderHost());

      binding.hydrate(hydrationTree, context);
      binding.commit(context);

      expect(hydrationRoot.innerHTML).toBe(
        source.map((item) => item + createComment()).join('') + createComment(),
      );
    });
  });

  describe('connect()', () => {
    it('updates items according to keys', () => {
      const source = ['foo', 'bar', 'baz', 'qux'];

      for (const combinations1 of allCombinations(source)) {
        for (const combinations2 of allCombinations(source)) {
          const props1: RepeatProps<string> = {
            source: combinations1,
            keySelector: (item) => item,
            valueSelector: textTemplateObject,
          };
          const props2: RepeatProps<string> = {
            source: combinations2,
            keySelector: (item) => item,
            valueSelector: textTemplateObject,
          };
          const part: ChildNodePart = {
            type: PartType.ChildNode,
            node: document.createComment(''),
            childNode: null,
          };
          const container = createElement('div', {}, part.node);
          const binding = new RepeatBinding(props1, part);
          const context = new UpdateEngine(new MockRenderHost());

          binding.connect(context);
          binding.commit(context);

          expect(container.innerHTML).toBe(
            combinations1.map((item) => item + createComment()).join('') +
              '<!---->',
          );
          expect(part.childNode?.nodeValue).toBe(combinations1[0]);

          binding.bind(props2);
          binding.connect(context);
          binding.commit(context);

          expect(container.innerHTML).toBe(
            combinations2.map((item) => item + createComment()).join('') +
              createComment(),
          );
          expect(part.childNode?.nodeValue).toBe(combinations2[0]);
        }
      }
    });

    it('updates items containing duplicate keys', () => {
      const source1 = ['foo', 'bar', 'baz', 'baz', 'baz'];
      const source2 = ['foo', 'bar', 'baz'];

      for (const permutation1 of permutations(source1)) {
        for (const permutation2 of permutations(source2)) {
          const props1: RepeatProps<string> = {
            source: permutation1,
            keySelector: (item) => item,
            valueSelector: textTemplateObject,
          };
          const props2: RepeatProps<string> = {
            source: permutation2,
            keySelector: (item) => item,
            valueSelector: textTemplateObject,
          };
          const part: ChildNodePart = {
            type: PartType.ChildNode,
            node: document.createComment(''),
            childNode: null,
          };
          const container = createElement('div', {}, part.node);
          const binding = new RepeatBinding(props1, part);
          const context = new UpdateEngine(new MockRenderHost());

          binding.connect(context);
          binding.commit(context);

          expect(container.innerHTML).toBe(
            permutation1.map((item) => item + createComment()).join('') +
              createComment(),
          );
          expect(part.childNode?.nodeValue).toBe(permutation1[0]);

          binding.bind(props2);
          binding.connect(context);
          binding.commit(context);

          expect(container.innerHTML).toBe(
            permutation2.map((item) => item + createComment()).join('') +
              createComment(),
          );
          expect(part.childNode?.nodeValue).toBe(permutation2[0]);

          binding.bind(props1);
          binding.connect(context);
          binding.commit(context);

          expect(container.innerHTML).toBe(
            permutation1.map((item) => item + createComment()).join('') +
              createComment(),
          );
          expect(part.childNode?.nodeValue).toBe(permutation1[0]);
        }
      }
    });

    it('swaps items according to keys', () => {
      const source = ['foo', 'bar', 'baz'];

      for (const permutation1 of permutations(source)) {
        for (const permutation2 of permutations(source)) {
          const props1: RepeatProps<string> = {
            source: permutation1,
            keySelector: (item) => item,
            valueSelector: textTemplateObject,
          };
          const props2: RepeatProps<string> = {
            source: permutation2,
            keySelector: (item) => item,
            valueSelector: textTemplateObject,
          };
          const part: ChildNodePart = {
            type: PartType.ChildNode,
            node: document.createComment(''),
            childNode: null,
          };
          const container = createElement('div', {}, part.node);
          const binding = new RepeatBinding(props1, part);
          const context = new UpdateEngine(new MockRenderHost());

          binding.connect(context);
          binding.commit(context);

          expect(container.innerHTML).toBe(
            permutation1.map((item) => item + createComment()).join('') +
              createComment(),
          );
          expect(part.childNode?.nodeValue).toBe(permutation1[0]);

          binding.bind(props2);
          binding.connect(context);
          binding.commit(context);

          expect(container.innerHTML).toBe(
            permutation2.map((item) => item + createComment()).join('') +
              createComment(),
          );
          expect(part.childNode?.nodeValue).toBe(permutation2[0]);

          binding.bind(props1);
          binding.connect(context);
          binding.commit(context);

          expect(container.innerHTML).toBe(
            permutation1.map((item) => item + createComment()).join('') +
              createComment(),
          );
          expect(part.childNode?.nodeValue).toBe(permutation1[0]);
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
      const part: ChildNodePart = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      };
      const container = createElement('div', {}, part.node);
      const binding = new RepeatBinding(props1, part);
      const context = new UpdateEngine(new MockRenderHost());

      binding.connect(context);
      binding.commit(context);

      expect(container.innerHTML).toBe(
        source1.map((item) => createComment(item)).join('') + createComment(),
      );
      expect(part.childNode?.nodeValue).toBe(source1[0]);

      binding.bind(props2);
      binding.connect(context);
      binding.commit(context);

      expect(container.innerHTML).toBe(
        source2.map((item) => createComment(item)).join('') + createComment(),
      );
      expect(part.childNode?.nodeValue).toBe(source2[0]);

      binding.bind(props1);
      binding.connect(context);
      binding.commit(context);

      expect(container.innerHTML).toBe(
        source1.map((item) => createComment(item)).join('') + createComment(),
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
      const part: ChildNodePart = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      };
      const container = createElement('div', {}, part.node);
      const binding = new RepeatBinding(props, part);
      const context = new UpdateEngine(new MockRenderHost());

      binding.connect(context);
      binding.commit(context);

      expect(container.innerHTML).toBe(
        source.map((item) => createComment(item)).join('') + createComment(),
      );

      binding.disconnect(context);
      binding.rollback(context);

      expect(container.innerHTML).toBe(createComment());

      binding.connect(context);
      binding.commit(context);

      expect(container.innerHTML).toBe(
        source.map((item) => createComment(item)).join('') + createComment(),
      );
    });
  });
});

function textTemplateObject(
  content: string,
): DirectiveObject<readonly [string]> {
  return createDirectiveObject(TEXT_TEMPLATE, [content]);
}

function createComment(key: string = ''): string {
  const node = document.createComment(key);
  return new XMLSerializer().serializeToString(node);
}
