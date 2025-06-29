import { describe, expect, it } from 'vitest';
import { DirectiveObject } from '../../src/directive.js';
import {
  RepeatBinding,
  RepeatDirective,
  type RepeatProps,
  repeat,
} from '../../src/extensions/repeat.js';
import { PartType } from '../../src/part.js';
import { TextTemplate } from '../../src/template/textTemplate.js';
import { UpdateEngine } from '../../src/updateEngine.js';
import { MockRenderHost } from '../mocks.js';
import { allCombinations, createElement, permutations } from '../testUtils.js';

const TEXT_TEMPLATE = new TextTemplate<string>('', '');

describe('repeat()', () => {
  it('returns a DirectiveObject with RepeatDirective', () => {
    const props = {
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
      const props = { source: ['foo', 'bar', 'baz'] };
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
      const props = { source: ['foo', 'bar', 'baz'] };
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
  describe('connect()', () => {
    it('updates items according to keys', () => {
      const source = ['foo', 'bar', 'baz', 'qux'];

      for (const combinations1 of allCombinations(source)) {
        for (const combinations2 of allCombinations(source)) {
          const props1: RepeatProps<string> = {
            source: combinations1,
            keySelector: (item) => item,
            valueSelector: text,
          };
          const props2: RepeatProps<string> = {
            source: combinations2,
            keySelector: (item) => item,
            valueSelector: text,
          };
          const part = {
            type: PartType.ChildNode,
            node: document.createComment(''),
            childNode: null,
          } as const;
          const container = createElement('div', {}, part.node);
          const binding = new RepeatBinding(props1, part);
          const context = new UpdateEngine(new MockRenderHost());

          binding.connect(context);
          binding.commit();

          binding.bind(props2);
          binding.connect(context);
          binding.commit();

          expect(container.innerHTML).toBe(
            combinations2.map((item) => item + '<!---->').join('') + '<!---->',
          );
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
            valueSelector: text,
          };
          const props2: RepeatProps<string> = {
            source: permutation2,
            keySelector: (item) => item,
            valueSelector: text,
          };
          const part = {
            type: PartType.ChildNode,
            node: document.createComment(''),
            childNode: null,
          } as const;
          const container = createElement('div', {}, part.node);
          const binding = new RepeatBinding(props1, part);
          const context = new UpdateEngine(new MockRenderHost());

          binding.connect(context);
          binding.commit();

          binding.bind(props2);
          binding.connect(context);
          binding.commit();

          expect(container.innerHTML).toBe(
            permutation2.map((item) => item + '<!---->').join('') + '<!---->',
          );

          binding.bind(props1);
          binding.connect(context);
          binding.commit();

          expect(container.innerHTML).toBe(
            permutation1.map((item) => item + '<!---->').join('') + '<!---->',
          );
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
            valueSelector: text,
          };
          const props2: RepeatProps<string> = {
            source: permutation2,
            keySelector: (item) => item,
            valueSelector: text,
          };
          const part = {
            type: PartType.ChildNode,
            node: document.createComment(''),
            childNode: null,
          } as const;
          const container = createElement('div', {}, part.node);
          const binding = new RepeatBinding(props1, part);
          const context = new UpdateEngine(new MockRenderHost());

          binding.connect(context);
          binding.commit();

          binding.bind(props2);
          binding.connect(context);
          binding.commit();

          expect(container.innerHTML).toBe(
            permutation2.map((item) => item + '<!---->').join('') + '<!---->',
          );
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
    ])('updates with a different size list', (source1, source2) => {
      const props1: RepeatProps<string, number, readonly [string]> = {
        source: source1,
        valueSelector: text,
      };
      const props2: RepeatProps<string, number, readonly [string]> = {
        source: source2,
        valueSelector: text,
      };
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      } as const;
      const container = createElement('div', {}, part.node);
      const binding = new RepeatBinding(props1, part);
      const context = new UpdateEngine(new MockRenderHost());

      binding.connect(context);
      binding.commit();

      binding.bind(props2);
      binding.connect(context);
      binding.commit();

      expect(container.innerHTML).toBe(
        source2.map((item) => item + '<!---->').join('') + '<!---->',
      );
      expect(Array.from(container.childNodes)).toStrictEqual(
        binding['_memoizedItems']
          ?.flatMap((item) => [
            expect.objectContaining({ nodeValue: item.slot.value[0] }),
            expect.exact(item.slot.part.node),
          ])
          .concat([expect.exact(part.node)]),
      );

      binding.bind(props1);
      binding.connect(context);
      binding.commit();

      expect(container.innerHTML).toBe(
        source1.map((item) => item + '<!---->').join('') + '<!---->',
      );
    });
  });
});

function text(content: string): DirectiveObject<readonly [string]> {
  return new DirectiveObject(TEXT_TEMPLATE, [content]);
}
