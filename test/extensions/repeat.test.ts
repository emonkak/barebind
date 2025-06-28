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
import { allCombinations, createElement } from '../testUtils.js';

const TEMPLATE = new TextTemplate('', '');

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
    it('should update items according to keys', () => {
      const source = ['foo', 'bar', 'baz', 'qux'];

      for (const source1 of allCombinations(source)) {
        for (const source2 of allCombinations(source)) {
          const props1: RepeatProps<
            string,
            string,
            DirectiveObject<readonly [unknown]>
          > = {
            source: source1,
            keySelector: (item) => item,
            valueSelector: text,
          };
          const props2: RepeatProps<
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
          const binding = new RepeatBinding(props1, part);
          const context = new UpdateEngine(new MockRenderHost());

          binding.connect(context);
          binding.commit();

          binding.bind(props2);
          binding.connect(context);
          binding.commit();

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
  return new DirectiveObject(TEMPLATE, [content]);
}
