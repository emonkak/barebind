import { describe, expect, it } from 'vitest';
import {
  areDirectiveTypesEqual,
  createScope,
  getContextValue,
  getFlushLanesFromOptions,
  getPriorityFromLanes,
  getScheduleLanesFromOptions,
  getStartNode,
  isBindable,
  Lanes,
  PartType,
  setContextValue,
  type UpdateOptions,
} from '@/internal.js';
import { HTML_NAMESPACE_URI } from '@/template/template.js';
import { MockBindable, MockDirective, MockPrimitive } from '../mocks.js';

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

describe('getContextValue()', () => {
  it('returns the own entry value', () => {
    const scope = createScope(null);

    setContextValue(scope, 'foo', 1);

    expect(getContextValue(scope, 'foo')).toBe(1);
    expect(getContextValue(scope, 'bar')).toBe(undefined);
    expect(scope.level).toBe(0);
  });

  it('returns the inherited entry value', () => {
    const parentScope = createScope(null);
    const childScope = createScope(parentScope);

    setContextValue(parentScope, 'foo', 1);
    setContextValue(parentScope, 'bar', 2);
    setContextValue(childScope, 'foo', 3);

    expect(getContextValue(parentScope, 'foo')).toBe(1);
    expect(getContextValue(parentScope, 'bar')).toBe(2);
    expect(getContextValue(parentScope, 'baz')).toBe(undefined);
    expect(parentScope.level).toBe(0);

    expect(getContextValue(childScope, 'foo')).toBe(3);
    expect(getContextValue(childScope, 'bar')).toBe(2);
    expect(getContextValue(childScope, 'baz')).toBe(undefined);
    expect(childScope.level).toBe(1);
  });
});

describe('getFlushLanesFromOptions()', () => {
  it.each([
    [{}, Lanes.NoLanes],
    [{ priority: 'user-blocking' }, Lanes.UserBlockingLane],
    [
      { priority: 'user-visible' },
      Lanes.UserBlockingLane | Lanes.UserVisibleLane,
    ],
    [
      { priority: 'background' },

      Lanes.UserBlockingLane | Lanes.UserVisibleLane | Lanes.BackgroundLane,
    ],
    [
      { concurrent: true, viewTransition: true },
      Lanes.ConcurrentLane | Lanes.ViewTransitionLane,
    ],
    [
      { priority: 'user-blocking', concurrent: true, viewTransition: true },

      Lanes.UserBlockingLane | Lanes.ConcurrentLane | Lanes.ViewTransitionLane,
    ],
    [
      { priority: 'user-visible', concurrent: true, viewTransition: true },
      Lanes.UserBlockingLane |
        Lanes.UserVisibleLane |
        Lanes.ConcurrentLane |
        Lanes.ViewTransitionLane,
    ],
    [
      { priority: 'background', concurrent: true, viewTransition: true },
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
        anchorNode: null,
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
      anchorNode: document.createElement('div'),
      namespaceURI: HTML_NAMESPACE_URI,
    };

    expect(getStartNode(part)).toBe(part.anchorNode);
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
