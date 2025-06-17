import { describe, expect, it } from 'vitest';
import { DirectiveObject } from '../../src/directive.js';
import {
  ListBinding,
  ListDirective,
  type ListProps,
  list,
} from '../../src/extensions/list.js';
import { PartType } from '../../src/part.js';
import { TextTemplate } from '../../src/template/textTemplate.js';
import { UpdateEngine } from '../../src/updateEngine.js';
import { MockRenderHost } from '../mocks.js';
import { allCombinations, createElement } from '../testUtils.js';

describe('list()', () => {
  it('returns a DirectiveObject with ListDirective', () => {
    const props = {
      source: ['foo', 'bar', 'baz'],
    };
    const element = list(props);

    expect(element.directive).toBe(ListDirective);
    expect(element.value).toBe(props);
  });
});

describe('ListDirective', () => {
  describe('name', () => {
    it('is a string that represents the primitive itself', () => {
      expect(ListDirective.name, 'ListDirective');
    });
  });

  describe('resolveBinding()', () => {
    it('constructs a new ListBinding', () => {
      const props = { source: ['foo', 'bar', 'baz'] };
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      } as const;
      const context = new UpdateEngine(new MockRenderHost());
      const binding = ListDirective.resolveBinding(props, part, context);

      expect(binding.directive).toBe(ListDirective);
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

      expect(() => ListDirective.resolveBinding(props, part, context)).toThrow(
        'ListDirective must be used in a child part,',
      );
    });
  });
});

describe('ListBinding', () => {
  describe('connect()', () => {
    it('should update items according to keys', () => {
      const source = ['foo', 'bar', 'baz', 'qux'];

      for (const source1 of allCombinations(source)) {
        for (const source2 of allCombinations(source)) {
          const props1: ListProps<
            string,
            string,
            DirectiveObject<readonly [unknown]>
          > = {
            source: source1,
            keySelector: (item) => item,
            valueSelector: text,
          };
          const props2: ListProps<
            string,
            string,
            DirectiveObject<readonly [unknown]>
          > = {
            source: source2,
            keySelector: (item) => item,
            valueSelector: text,
          };
          const part = {
            type: PartType.ChildNode,
            node: document.createComment(''),
            childNode: null,
          } as const;
          const container = createElement('div', {}, part.node);
          const binding = new ListBinding(props1, part);
          const context = new UpdateEngine(new MockRenderHost());

          binding.connect(context);
          binding.commit();

          binding.bind(props2);
          binding.connect(context);
          binding.commit();

          console.log({ source1, source2, container });

          expect(container.innerHTML).toBe(
            source2
              .map((item) => item + '<!--/TextTemplate@"' + item + '"-->')
              .join('') + '<!---->',
          );
        }
      }
    });
  });
});

function text(content: string): DirectiveObject<readonly [unknown]> {
  return new DirectiveObject(TextTemplate, [content]);
}
