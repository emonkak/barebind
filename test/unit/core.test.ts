import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  areDirectiveTypesEqual,
  getChildNodes,
  getFlushLanesFromOptions,
  getScheduleLanesFromOptions,
  getStartNode,
  isBindable,
  Lanes,
  Literal,
  moveChildNodes,
  PartType,
  Scope,
  type UpdateOptions,
} from '@/core.js';
import { HTML_NAMESPACE_URI } from '@/template/template.js';
import { MockBindable, MockDirective, MockPrimitive } from '../mocks.js';
import { createElement } from '../test-utils.js';

describe('Literal', () => {
  describe('toString()', () => {
    it('should return the string', () => {
      const s = 'foo';
      expect(new Literal(s).toString()).toBe(s);
    });
  });

  describe('valueOf()', () => {
    it('should return the string', () => {
      const s = 'foo';
      expect(new Literal(s).valueOf()).toBe(s);
    });
  });
});

describe('Scope', () => {
  it('gets the own entry value', () => {
    const scope = new Scope(null);

    scope.set('foo', 1);

    expect(scope.get('foo')).toBe(1);
    expect(scope.get('bar')).toBe(undefined);
  });

  it('gets the inherited entry value', () => {
    const parentScope = new Scope(null);
    const childScope = new Scope(parentScope);

    parentScope.set('foo', 1);
    parentScope.set('bar', 2);
    childScope.set('foo', 3);

    expect(childScope.get('foo')).toBe(3);
    expect(childScope.get('bar')).toBe(2);
    expect(childScope.get('baz')).toBe(undefined);
  });
});

describe('areDirectiveTypesEqual()', () => {
  it('returns the result from Directive.equals() if it is definied', () => {
    const type1 = new MockDirective();
    const type2 = MockPrimitive;

    expect(areDirectiveTypesEqual(type1, type1)).toBe(true);
    expect(areDirectiveTypesEqual(type1, type2)).toBe(false);
    expect(areDirectiveTypesEqual(type2, type1)).toBe(false);
    expect(areDirectiveTypesEqual(type2, type2)).toBe(true);
  });
});

describe('getChildNodes()', () => {
  it('returns a single node when the start node and end node are the same', () => {
    const node = document.createComment('');

    expect(getChildNodes(node, node)).toStrictEqual([expect.exact(node)]);
  });

  it('returns children from the start node to the end node', () => {
    const container = createElement(
      'div',
      {},
      document.createElement('div'),
      'foo',
      document.createComment(''),
    );

    expect(
      getChildNodes(container.firstChild!, container.lastChild!),
    ).toStrictEqual(
      Array.from(container.childNodes, (node) => expect.exact(node)),
    );
  });
});

describe('getFlushLanesFromOptions()', () => {
  it.each([
    [{}, Lanes.DefaultLanes],
    [{ priority: 'user-blocking' }, Lanes.UserBlockingLane],
    [
      { priority: 'user-visible' },
      Lanes.UserBlockingLane | Lanes.UserVisibleLane,
    ],
    [
      { priority: 'background' },
      Lanes.UserBlockingLane | Lanes.UserVisibleLane | Lanes.BackgroundLane,
    ],
    [{ viewTransition: true }, Lanes.DefaultLanes | Lanes.ViewTransitionLane],
    [
      { priority: 'user-blocking', viewTransition: true },
      Lanes.UserBlockingLane | Lanes.ViewTransitionLane,
    ],
    [
      { priority: 'user-visible', viewTransition: true },
      Lanes.UserBlockingLane | Lanes.UserVisibleLane | Lanes.ViewTransitionLane,
    ],
    [
      { priority: 'background', viewTransition: true },
      Lanes.UserBlockingLane |
        Lanes.UserVisibleLane |
        Lanes.BackgroundLane |
        Lanes.ViewTransitionLane,
    ],
  ] as [UpdateOptions, Lanes][])(
    'returns the lanes for flush',
    (options, lanes) => {
      expect(getFlushLanesFromOptions(options)).toBe(lanes);
    },
  );
});

describe('getScheduleLanesFromOptions()', () => {
  it.each([
    [{}, Lanes.DefaultLanes],
    [{ priority: 'user-blocking' }, Lanes.UserBlockingLane],
    [{ priority: 'user-visible' }, Lanes.UserVisibleLane],
    [{ priority: 'background' }, Lanes.BackgroundLane],
    [{ viewTransition: true }, Lanes.DefaultLanes | Lanes.ViewTransitionLane],
    [
      { priority: 'user-blocking', viewTransition: true },
      Lanes.UserBlockingLane | Lanes.ViewTransitionLane,
    ],
    [
      { priority: 'user-visible', viewTransition: true },
      Lanes.UserVisibleLane | Lanes.ViewTransitionLane,
    ],
    [
      { priority: 'background', viewTransition: true },
      Lanes.BackgroundLane | Lanes.ViewTransitionLane,
    ],
  ] as [UpdateOptions, Lanes][])(
    'returns lanes for schedule',
    (options, lanes) => {
      expect(getScheduleLanesFromOptions(options)).toBe(lanes);
    },
  );
});

describe('getStartNode()', () => {
  it.each([
    [
      {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: 'class',
      },
    ],
    [
      {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      },
    ],
    [
      {
        type: PartType.Text,
        node: document.createTextNode(''),
        precedingText: '',
        followingText: '',
      },
    ],
    [
      {
        type: PartType.Element,
        node: document.createElement('div'),
      },
    ],
    [
      {
        type: PartType.Event,
        node: document.createElement('div'),
        name: 'click',
      },
    ],
    [
      {
        type: PartType.Live,
        node: document.createElement('textarea'),
        name: 'value',
        defaultValue: '',
      },
    ],
    [
      {
        type: PartType.Property,
        node: document.createElement('textarea'),
        name: 'value',
        defaultValue: '',
      },
    ],
  ])('returns the node of the part', (part) => {
    expect(getStartNode(part)).toBe(part.node);
  });

  it('returns the child node if the part has a child node', () => {
    const part = {
      type: PartType.ChildNode,
      node: document.createComment(''),
      childNode: document.createElement('div'),
      namespaceURI: HTML_NAMESPACE_URI,
    };

    expect(getStartNode(part)).toBe(part.childNode);
  });
});

describe('isBindable()', () => {
  it('returns true if the value is a bindable', () => {
    expect(
      isBindable(new MockBindable({ type: MockPrimitive, value: 'foo' })),
    ).toBe(true);
    expect(isBindable('foo')).toBe(false);
  });
});

describe.each([[true], [false]])('moveChildNodes()', (useMoveBefore) => {
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
