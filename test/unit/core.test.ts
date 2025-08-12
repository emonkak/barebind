import { describe, expect, it } from 'vitest';
import {
  areDirectiveTypesEqual,
  getFlushLanesFromOptions,
  getPriorityFromLanes,
  getScheduleLanesFromOptions,
  getStartNode,
  isBindable,
  Lanes,
  Literal,
  PartType,
  Scope,
  type UpdateOptions,
} from '@/core.js';
import { HTML_NAMESPACE_URI } from '@/template/template.js';
import { MockBindable, MockDirective, MockPrimitive } from '../mocks.js';

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
  it('returns the own entry value', () => {
    const scope = new Scope(null);

    scope.set('foo', 1);

    expect(scope.get('foo')).toBe(1);
    expect(scope.get('bar')).toBe(undefined);
    expect(scope.level).toBe(0);
  });

  it('returns the inherited entry value', () => {
    const parentScope = new Scope(null);
    const childScope = new Scope(parentScope);

    parentScope.set('foo', 1);
    parentScope.set('bar', 2);
    childScope.set('foo', 3);

    expect(parentScope.get('foo')).toBe(1);
    expect(parentScope.get('bar')).toBe(2);
    expect(parentScope.get('baz')).toBe(undefined);
    expect(parentScope.level).toBe(0);

    expect(childScope.get('foo')).toBe(3);
    expect(childScope.get('bar')).toBe(2);
    expect(childScope.get('baz')).toBe(undefined);
    expect(childScope.level).toBe(1);
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

describe('getFlushLanesFromOptions()', () => {
  it.each([
    [{}, Lanes.RootLane],
    [{ priority: 'user-blocking' }, Lanes.RootLane | Lanes.UserBlockingLane],
    [
      { priority: 'user-visible' },
      Lanes.RootLane | Lanes.UserBlockingLane | Lanes.UserVisibleLane,
    ],
    [
      { priority: 'background' },
      Lanes.RootLane |
        Lanes.UserBlockingLane |
        Lanes.UserVisibleLane |
        Lanes.BackgroundLane,
    ],
    [
      { concurrent: true, viewTransition: true },
      Lanes.RootLane | Lanes.ConcurrentLane | Lanes.ViewTransitionLane,
    ],
    [
      { priority: 'user-blocking', concurrent: true, viewTransition: true },
      Lanes.RootLane |
        Lanes.UserBlockingLane |
        Lanes.ConcurrentLane |
        Lanes.ViewTransitionLane,
    ],
    [
      { priority: 'user-visible', concurrent: true, viewTransition: true },
      Lanes.RootLane |
        Lanes.UserBlockingLane |
        Lanes.UserVisibleLane |
        Lanes.ConcurrentLane |
        Lanes.ViewTransitionLane,
    ],
    [
      { priority: 'background', concurrent: true, viewTransition: true },
      Lanes.RootLane |
        Lanes.UserBlockingLane |
        Lanes.UserVisibleLane |
        Lanes.BackgroundLane |
        Lanes.ConcurrentLane |
        Lanes.ViewTransitionLane,
    ],
  ] as [UpdateOptions, Lanes][])(
    'returns the lanes for flush',
    (options, lanes) => {
      expect(getFlushLanesFromOptions(options)).toBe(lanes);
      expect(getPriorityFromLanes(lanes)).toBe(options.priority ?? null);
    },
  );
});

describe('getScheduleLanesFromOptions()', () => {
  it.each([
    [{}, Lanes.NoLanes],
    [{ priority: 'user-blocking' }, Lanes.UserBlockingLane],
    [{ priority: 'user-visible' }, Lanes.UserVisibleLane],
    [{ priority: 'background' }, Lanes.BackgroundLane],
    [{ viewTransition: true }, Lanes.ViewTransitionLane],
    [
      { priority: 'user-blocking', concurrent: true, viewTransition: true },
      Lanes.UserBlockingLane | Lanes.ConcurrentLane | Lanes.ViewTransitionLane,
    ],
    [
      { priority: 'user-visible', concurrent: true, viewTransition: true },
      Lanes.UserVisibleLane | Lanes.ConcurrentLane | Lanes.ViewTransitionLane,
    ],
    [
      { priority: 'background', concurrent: true, viewTransition: true },
      Lanes.BackgroundLane | Lanes.ConcurrentLane | Lanes.ViewTransitionLane,
    ],
  ] as [UpdateOptions, Lanes][])(
    'returns lanes for schedule',
    (options, lanes) => {
      expect(getScheduleLanesFromOptions(options)).toBe(lanes);
      expect(getPriorityFromLanes(lanes)).toBe(options.priority ?? null);
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
