import { describe, expect, it, vi } from 'vitest';

import {
  ListBinding,
  inPlaceList,
  orderedList,
} from '../../src/directives/list.js';
import { PartType, directiveTag } from '../../src/types.js';
import { SyncUpdater } from '../../src/updater/syncUpdater.js';
import { MockUpdateHost, TextDirective } from '../mocks.js';
import { allCombinations, permutations } from '../testUtils.js';

describe('orderedList()', () => {
  it('should construst a new list directive', () => {
    const items = ['foo', 'bar', 'baz'];
    const valueSelector = (item: string) => item;
    const keySelector = (item: string) => item;
    const value = orderedList(items, keySelector, valueSelector);

    expect(value.items).toBe(items);
    expect(value.keySelector).toBe(keySelector);
    expect(value.valueSelector).toBe(valueSelector);
  });
});

describe('inPlaceList()', () => {
  it('should construst a new list directive', () => {
    const items = ['foo', 'bar', 'baz'];
    const valueSelector = (item: string) => item;
    const value = inPlaceList(items, valueSelector);

    expect(value.items).toBe(items);
    expect(value.keySelector).toBe(null);
    expect(value.valueSelector).toBe(valueSelector);
  });
});

describe('List', () => {
  describe('[directiveTag]()', () => {
    it('should return a new ListBinding', () => {
      const value = orderedList(
        ['foo', 'bar', 'baz'],
        (item) => item,
        (item) => item,
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = { host, updater, block: null };
      const binding = value[directiveTag](part, context);

      expect(binding.value).toBe(value);
      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
      expect(binding.bindings).toEqual([]);
    });

    it('should throw an error if the part is not a ChildNodePart', () => {
      const value = orderedList(
        ['foo', 'bar', 'baz'],
        (item) => item,
        (item) => item,
      );
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = { host, updater, block: null };

      expect(() => value[directiveTag](part, context)).toThrow(
        'List directive must be used in a child node,',
      );
    });
  });
});

describe('ListBinding', () => {
  describe('.connect()', () => {
    it('should connect new bindings from items', () => {
      const value = orderedList(
        ['foo', 'bar', 'baz'],
        (item) => item,
        (item) => new TextDirective(item),
      );
      const container = document.createElement('div');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = { host, updater, block: null };
      const binding = new ListBinding(value, part);

      container.appendChild(part.node);
      binding.connect(context);
      updater.flushUpdate(host);

      expect(binding.value).toBe(value);
      expect(binding.startNode.nodeValue).toBe('foo');
      expect(binding.bindings.map((binding) => binding.value.content)).toEqual([
        'foo',
        'bar',
        'baz',
      ]);
      expect(container.innerHTML).toBe(
        'foo<!--TextDirective@"foo"-->bar<!--TextDirective@"bar"-->baz<!--TextDirective@"baz"--><!---->',
      );
    });

    it('should not enqueue self as a mutation effect if already scheduled', () => {
      const value = orderedList(
        ['foo', 'bar', 'baz'],
        (item) => item,
        (item) => new TextDirective(item),
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = { host, updater, block: null };
      const binding = new ListBinding(value, part);
      const commitSpy = vi.spyOn(binding, 'commit');

      binding.connect(context);
      binding.connect(context);
      updater.flushUpdate(host);

      expect(commitSpy).toHaveBeenCalledOnce();
    });
  });

  describe('.bind()', () => {
    it('should update items according to keys', () => {
      const source = ['foo', 'bar', 'baz', 'qux'];

      for (const items1 of allCombinations(source)) {
        for (const items2 of allCombinations(source)) {
          const value1 = orderedList(
            items1,
            (item) => item,
            (item) => new TextDirective(item),
          );
          const value2 = orderedList(
            items2,
            (item) => item,
            (item) => new TextDirective(item),
          );
          const container = document.createElement('div');
          const part = {
            type: PartType.ChildNode,
            node: document.createComment(''),
          } as const;
          const host = new MockUpdateHost();
          const updater = new SyncUpdater();
          const context = { host, updater, block: null };
          const binding = new ListBinding(value1, part);

          container.appendChild(part.node);
          binding.connect(context);
          updater.flushUpdate(host);

          binding.bind(value2, context);
          updater.flushUpdate(host);

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
            const value1 = orderedList(
              items1!,
              (item) => item,
              (item) => new TextDirective(item),
            );
            const value2 = orderedList(
              items2!,
              (item) => item,
              (item) => new TextDirective(item),
            );
            const container = document.createElement('div');
            const part = {
              type: PartType.ChildNode,
              node: document.createComment(''),
            } as const;
            const host = new MockUpdateHost();
            const updater = new SyncUpdater();
            const context = { host, updater, block: null };
            const binding = new ListBinding(value1, part);

            container.appendChild(part.node);
            binding.connect(context);
            updater.flushUpdate(host);

            binding.bind(value2, context);
            updater.flushUpdate(host);

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
          const value1 = orderedList(
            items1,
            (item) => item,
            (item) => new TextDirective(item),
          );
          const value2 = orderedList(
            items2,
            (item) => item,
            (item) => new TextDirective(item),
          );
          const container = document.createElement('div');
          const part = {
            type: PartType.ChildNode,
            node: document.createComment(''),
          } as const;
          const host = new MockUpdateHost();
          const updater = new SyncUpdater();
          const context = { host, updater, block: null };
          const binding = new ListBinding(value1, part);

          container.appendChild(part.node);
          binding.connect(context);
          updater.flushUpdate(host);

          binding.bind(value2, context);
          updater.flushUpdate(host);

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
      const value1 = inPlaceList(
        ['foo', 'bar', 'baz'],
        (item) => new TextDirective(item),
      );
      const value2 = inPlaceList(
        ['qux', 'baz', 'bar', 'foo'],
        (item) => new TextDirective(item),
      );
      const container = document.createElement('div');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = { host, updater, block: null };
      const binding = new ListBinding(value1, part);

      container.appendChild(part.node);
      binding.connect(context);
      updater.flushUpdate(host);

      binding.bind(value2, context);
      updater.flushUpdate(host);

      expect(binding.value).toBe(value2);
      expect(binding.bindings.map((binding) => binding.value.content)).toEqual(
        value2.items,
      );
      expect(container.innerHTML).toBe(
        'qux<!--TextDirective@0-->baz<!--TextDirective@1-->bar<!--TextDirective@2-->foo<!--TextDirective@3--><!---->',
      );
    });

    it('should update with shoter list than last time', () => {
      const value1 = inPlaceList(
        ['foo', 'bar', 'baz'],
        (item) => new TextDirective(item),
      );
      const value2 = inPlaceList(
        ['bar', 'foo'],
        (item) => new TextDirective(item),
      );
      const container = document.createElement('div');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = { host, updater, block: null };
      const binding = new ListBinding(value1, part);

      container.appendChild(part.node);
      binding.connect(context);
      updater.flushUpdate(host);

      binding.bind(value2, context);
      updater.flushUpdate(host);

      expect(binding.value).toBe(value2);
      expect(binding.bindings.map((binding) => binding.value.content)).toEqual(
        value2.items,
      );
      expect(container.innerHTML).toBe(
        'bar<!--TextDirective@0-->foo<!--TextDirective@1--><!---->',
      );
    });

    it('should do nothing if the items is the same as previous ones', () => {
      const items = ['foo', 'bar', 'baz'];
      const value1 = orderedList(
        items,
        (item) => item,
        (item) => new TextDirective(item),
      );
      const value2 = orderedList(
        items,
        (item) => item,
        (item) => new TextDirective(item),
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = { host, updater, block: null };
      const binding = new ListBinding(value1, part);

      binding.connect(context);
      updater.flushUpdate(host);

      binding.bind(value2, context);

      expect(binding.value).toBe(value2);
      expect(updater.isPending()).toBe(false);
      expect(updater.isScheduled()).toBe(false);
    });
  });

  describe('.unbind()', () => {
    it('should unbind current bindings', () => {
      const value = orderedList(
        ['foo', 'bar', 'baz'],
        (item) => item,
        (item) => item,
      );
      const container = document.createElement('div');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = { host, updater, block: null };
      const binding = new ListBinding(value, part);

      container.appendChild(part.node);
      binding.connect(context);
      updater.flushUpdate(host);

      binding.unbind(context);
      updater.flushUpdate(host);

      expect(binding.bindings).toHaveLength(0);
      expect(container.innerHTML).toBe('<!---->');
    });

    it('should not enqueue self as a mutation effect if already scheduled', () => {
      const value = orderedList(
        ['foo', 'bar', 'baz'],
        (item) => item,
        (item) => item,
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = { host, updater, block: null };
      const binding = new ListBinding(value, part);
      const commitSpy = vi.spyOn(binding, 'commit');

      binding.unbind(context);
      binding.unbind(context);
      updater.flushUpdate(host);

      expect(commitSpy).toHaveBeenCalledOnce();
    });
  });

  describe('.disconnect()', () => {
    it('should disconnect current bindings', () => {
      const value = orderedList(
        ['foo', 'bar', 'baz'],
        (item) => item,
        (item) => new TextDirective(item),
      );
      const container = document.createElement('div');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = { host, updater, block: null };
      const binding = new ListBinding(value, part);

      container.appendChild(part.node);
      binding.connect(context);
      updater.flushUpdate(host);

      const disconnectSpies = binding.bindings.map((binding) =>
        vi.spyOn(binding, 'disconnect'),
      );

      binding.disconnect();

      expect(disconnectSpies).toHaveLength(3);
      for (const disconnectSpy of disconnectSpies) {
        expect(disconnectSpy).toHaveBeenCalledOnce();
      }
      expect(container.innerHTML).toBe(
        'foo<!--TextDirective@"foo"-->bar<!--TextDirective@"bar"-->baz<!--TextDirective@"baz"--><!---->',
      );
    });
  });
});
