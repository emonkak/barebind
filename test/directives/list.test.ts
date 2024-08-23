import { describe, expect, it, vi } from 'vitest';

import { PartType, UpdateContext, directiveTag } from '../../src/baseTypes.js';
import { ListBinding, keyedList, list } from '../../src/directives/list.js';
import { SyncUpdater } from '../../src/updater/syncUpdater.js';
import { MockBlock, MockUpdateHost, TextDirective } from '../mocks.js';
import { allCombinations, permutations } from '../testUtils.js';

describe('list()', () => {
  it('should construct a new List directive', () => {
    const items = ['foo', 'bar', 'baz'];
    const valueSelector = (item: string) => item;
    const value = list(items, valueSelector);

    expect(value.items).toBe(items);
    expect(value.keySelector.call(undefined, 'foo', 1)).toBe(1);
    expect(value.valueSelector).toBe(valueSelector);
  });
});

describe('keyedList()', () => {
  it('should construct a new List directive with key selector', () => {
    const items = ['foo', 'bar', 'baz'];
    const valueSelector = (item: string) => item;
    const keySelector = (item: string) => item;
    const value = keyedList(items, keySelector, valueSelector);

    expect(value.items).toBe(items);
    expect(value.keySelector).toBe(keySelector);
    expect(value.valueSelector).toBe(valueSelector);
  });
});

describe('List', () => {
  describe('[directiveTag]()', () => {
    it('should return a new ListBinding', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = keyedList(
        ['foo', 'bar', 'baz'],
        (item) => item,
        (item) => item,
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = value[directiveTag](part, context);

      expect(binding.value).toBe(value);
      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
      expect(binding.bindings).toEqual([]);
    });

    it('should throw an error if the part is not a ChildNodePart', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = keyedList(
        ['foo', 'bar', 'baz'],
        (item) => item,
        (item) => item,
      );
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;

      expect(() => value[directiveTag](part, context)).toThrow(
        'List directive must be used in a child node,',
      );
    });
  });
});

describe('ListBinding', () => {
  describe('.connect()', () => {
    it('should connect new bindings from items', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = keyedList(
        ['foo', 'bar', 'baz'],
        (item) => item,
        (item) => new TextDirective(item),
      );
      const container = document.createElement('div');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new ListBinding(value, part);

      container.appendChild(part.node);
      binding.connect(context);
      context.flushUpdate();

      expect(binding.value).toBe(value);
      expect(binding.startNode.nodeValue).toBe('foo');
      expect(binding.bindings.map((binding) => binding.value.content)).toEqual([
        'foo',
        'bar',
        'baz',
      ]);
      expect(
        binding.bindings.map((binding) => binding.part.node.nodeValue),
      ).toEqual([
        'TextDirective@"foo"',
        'TextDirective@"bar"',
        'TextDirective@"baz"',
      ]);
      expect(
        binding.bindings.map((binding) => binding.startNode.nodeValue),
      ).toEqual(['foo', 'bar', 'baz']);
      expect(binding.bindings.map((binding) => binding.endNode)).toEqual(
        binding.bindings.map((binding) => binding.part.node),
      );
      expect(container.innerHTML).toBe(
        'foo<!--TextDirective@"foo"-->bar<!--TextDirective@"bar"-->baz<!--TextDirective@"baz"--><!---->',
      );
    });

    it('should not enqueue self as a mutation effect if already scheduled', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = keyedList(
        ['foo', 'bar', 'baz'],
        (item) => item,
        (item) => new TextDirective(item),
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new ListBinding(value, part);

      const commitSpy = vi.spyOn(binding, 'commit');

      binding.connect(context);
      binding.connect(context);
      context.flushUpdate();

      expect(commitSpy).toHaveBeenCalledOnce();
    });
  });

  describe('.bind()', () => {
    it('should update items according to keys', () => {
      const source = ['foo', 'bar', 'baz', 'qux'];

      for (const items1 of allCombinations(source)) {
        for (const items2 of allCombinations(source)) {
          const context = new UpdateContext(
            new MockUpdateHost(),
            new SyncUpdater(),
            new MockBlock(),
          );

          const value1 = keyedList(
            items1,
            (item) => item,
            (item) => new TextDirective(item),
          );
          const value2 = keyedList(
            items2,
            (item) => item,
            (item) => new TextDirective(item),
          );
          const container = document.createElement('div');
          const part = {
            type: PartType.ChildNode,
            node: document.createComment(''),
          } as const;
          const binding = new ListBinding(value1, part);

          container.appendChild(part.node);
          binding.connect(context);
          context.flushUpdate();

          binding.bind(value2, context);
          context.flushUpdate();

          expect(binding.value).toBe(value2);
          expect(
            binding.bindings.map((binding) => binding.value.content),
          ).toEqual(value2.items);
          expect(container.innerHTML).toBe(
            items2
              .map((item) => item + '<!--TextDirective@"' + item + '"-->')
              .join('') + '<!---->',
          );
        }
      }
    });

    it('should update items containing duplicate keys', () => {
      const source1 = ['foo', 'bar', 'baz', 'baz', 'baz'];
      const source2 = ['foo', 'bar', 'baz'];

      for (const permutation1 of permutations(source1)) {
        for (const permutation2 of permutations(source2)) {
          for (const [items1, items2] of [
            [permutation1, permutation2],
            [permutation2, permutation1],
          ]) {
            const context = new UpdateContext(
              new MockUpdateHost(),
              new SyncUpdater(),
              new MockBlock(),
            );

            const value1 = keyedList(
              items1!,
              (item) => item,
              (item) => new TextDirective(item),
            );
            const value2 = keyedList(
              items2!,
              (item) => item,
              (item) => new TextDirective(item),
            );
            const container = document.createElement('div');
            const part = {
              type: PartType.ChildNode,
              node: document.createComment(''),
            } as const;
            const binding = new ListBinding(value1, part);

            container.appendChild(part.node);
            binding.connect(context);
            context.flushUpdate();

            binding.bind(value2, context);
            context.flushUpdate();

            expect(binding.value).toBe(value2);
            expect(
              binding.bindings.map((binding) => binding.value.content),
            ).toEqual(value2.items);
            expect(container.innerHTML).toBe(
              items2!
                .map((item) => item + '<!--TextDirective@"' + item + '"-->')
                .join('') + '<!---->',
            );
          }
        }
      }
    });

    it('should swap items according to keys', () => {
      const source = ['foo', 'bar', 'baz'];

      for (const items1 of permutations(source)) {
        for (const items2 of permutations(source)) {
          const context = new UpdateContext(
            new MockUpdateHost(),
            new SyncUpdater(),
            new MockBlock(),
          );

          const value1 = keyedList(
            items1,
            (item) => item,
            (item) => new TextDirective(item),
          );
          const value2 = keyedList(
            items2,
            (item) => item,
            (item) => new TextDirective(item),
          );
          const container = document.createElement('div');
          const part = {
            type: PartType.ChildNode,
            node: document.createComment(''),
          } as const;
          const binding = new ListBinding(value1, part);

          container.appendChild(part.node);
          binding.connect(context);
          context.flushUpdate();

          binding.bind(value2, context);
          context.flushUpdate();

          expect(binding.value).toBe(value2);
          expect(
            binding.bindings.map((binding) => binding.value.content),
          ).toEqual(value2.items);
          expect(container.innerHTML).toBe(
            items2
              .map((item) => item + '<!--TextDirective@"' + item + '"-->')
              .join('') + '<!---->',
          );
        }
      }
    });

    it('should update with longer list than last time', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value1 = list(
        ['foo', 'bar', 'baz'],
        (item) => new TextDirective(item),
      );
      const value2 = list(
        ['qux', 'baz', 'bar', 'foo'],
        (item) => new TextDirective(item),
      );
      const container = document.createElement('div');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new ListBinding(value1, part);

      container.appendChild(part.node);
      binding.connect(context);
      context.flushUpdate();

      binding.bind(value2, context);
      context.flushUpdate();

      expect(binding.value).toBe(value2);
      expect(binding.bindings.map((binding) => binding.value.content)).toEqual(
        value2.items,
      );
      expect(container.innerHTML).toBe(
        'qux<!--TextDirective@0-->baz<!--TextDirective@1-->bar<!--TextDirective@2-->foo<!--TextDirective@3--><!---->',
      );
    });

    it('should update with shoter list than last time', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value1 = list(
        ['foo', 'bar', 'baz'],
        (item) => new TextDirective(item),
      );
      const value2 = list(['bar', 'foo'], (item) => new TextDirective(item));
      const container = document.createElement('div');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new ListBinding(value1, part);

      container.appendChild(part.node);
      binding.connect(context);
      context.flushUpdate();

      binding.bind(value2, context);
      context.flushUpdate();

      expect(binding.value).toBe(value2);
      expect(binding.bindings.map((binding) => binding.value.content)).toEqual(
        value2.items,
      );
      expect(container.innerHTML).toBe(
        'bar<!--TextDirective@0-->foo<!--TextDirective@1--><!---->',
      );
    });
  });

  describe('.unbind()', () => {
    it('should unbind current bindings', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = keyedList(
        ['foo', 'bar', 'baz'],
        (item) => item,
        (item) => item,
      );
      const container = document.createElement('div');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new ListBinding(value, part);

      container.appendChild(part.node);
      binding.connect(context);
      context.flushUpdate();

      binding.unbind(context);
      context.flushUpdate();

      expect(binding.bindings).toHaveLength(0);
      expect(container.innerHTML).toBe('<!---->');
    });

    it('should not enqueue self as a mutation effect if already scheduled', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = keyedList(
        ['foo', 'bar', 'baz'],
        (item) => item,
        (item) => item,
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new ListBinding(value, part);

      const commitSpy = vi.spyOn(binding, 'commit');

      binding.unbind(context);
      binding.unbind(context);
      context.flushUpdate();

      expect(commitSpy).toHaveBeenCalledOnce();
    });
  });

  describe('.disconnect()', () => {
    it('should disconnect current bindings', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = keyedList(
        ['foo', 'bar', 'baz'],
        (item) => item,
        (item) => new TextDirective(item),
      );
      const container = document.createElement('div');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new ListBinding(value, part);

      container.appendChild(part.node);
      binding.connect(context);
      context.flushUpdate();

      const disconnectSpies = binding.bindings.map((binding) =>
        vi.spyOn(binding, 'disconnect'),
      );

      binding.disconnect(context);

      expect(disconnectSpies).toHaveLength(3);
      for (const disconnectSpy of disconnectSpies) {
        expect(disconnectSpy).toHaveBeenCalledOnce();
        expect(disconnectSpy).toHaveBeenCalledWith(context);
      }
      expect(container.innerHTML).toBe(
        'foo<!--TextDirective@"foo"-->bar<!--TextDirective@"bar"-->baz<!--TextDirective@"baz"--><!---->',
      );
    });

    it('should not commit pending bindings', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = keyedList(
        ['foo', 'bar', 'baz'],
        (item) => item,
        (item) => new TextDirective(item),
      );
      const container = document.createElement('div');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new ListBinding(value, part);

      container.appendChild(part.node);
      binding.connect(context);
      binding.disconnect(context);
      context.flushUpdate();

      expect(container.innerHTML).toBe('<!---->');

      binding.bind(value, context);
      context.flushUpdate();

      expect(container.innerHTML).toBe(
        'foo<!--TextDirective@"foo"-->bar<!--TextDirective@"bar"-->baz<!--TextDirective@"baz"--><!---->',
      );
    });
  });
});
