import { describe, expect, it } from 'vitest';

import {
  areDirectiveTypesEqual,
  getLanesFromOptions,
  getPriorityFromLanes,
  getStartNode,
  isBindable,
  Lanes,
  PartType,
  Scope,
  type UpdateOptions,
} from '@/internal.js';
import { HTML_NAMESPACE_URI } from '@/template/template.js';
import { MockBindable, MockDirective, MockPrimitive } from '../mocks.js';

describe('Scope', () => {
  describe('getSharedContext()', () => {
    it('returns the own entry value', () => {
      const scope = new Scope();

      scope.setSharedContext('foo', 1);

      expect(scope.getSharedContext('foo')).toBe(1);
      expect(scope.getSharedContext('bar')).toBe(undefined);
    });

    it('returns the inherited entry value', () => {
      const parentScope = new Scope();
      const childScope = new Scope(parentScope);

      parentScope.setSharedContext('foo', 1);
      parentScope.setSharedContext('bar', 2);
      childScope.setSharedContext('foo', 3);

      expect(parentScope.getSharedContext('foo')).toBe(1);
      expect(parentScope.getSharedContext('bar')).toBe(2);
      expect(parentScope.getSharedContext('baz')).toBe(undefined);

      expect(childScope.getSharedContext('foo')).toBe(3);
      expect(childScope.getSharedContext('bar')).toBe(2);
      expect(childScope.getSharedContext('baz')).toBe(undefined);
    });
  });
});

describe('areDirectiveTypesEqual()', () => {
  it('returns the result from Directive.equals() if it is definied', () => {
    const type1 = new MockDirective();
    const type2 = MockPrimitive.instance;

    expect(areDirectiveTypesEqual(type1, type1)).toBe(true);
    expect(areDirectiveTypesEqual(type1, type2)).toBe(false);
    expect(areDirectiveTypesEqual(type2, type1)).toBe(false);
    expect(areDirectiveTypesEqual(type2, type2)).toBe(true);
  });
});

describe('getLanesFromOptions()', () => {
  it.each([
    [{}, Lanes.DefaultLane],
    [{ priority: 'user-blocking' }, Lanes.DefaultLane | Lanes.UserBlockingLane],
    [{ priority: 'user-visible' }, Lanes.DefaultLane | Lanes.UserVisibleLane],
    [{ priority: 'background' }, Lanes.DefaultLane | Lanes.BackgroundLane],
    [{ viewTransition: true }, Lanes.DefaultLane | Lanes.ViewTransitionLane],
    [
      { priority: 'user-blocking', viewTransition: true },
      Lanes.DefaultLane | Lanes.UserBlockingLane | Lanes.ViewTransitionLane,
    ],
    [
      { priority: 'user-visible', viewTransition: true },
      Lanes.DefaultLane | Lanes.UserVisibleLane | Lanes.ViewTransitionLane,
    ],
    [
      { priority: 'background', viewTransition: true },
      Lanes.DefaultLane | Lanes.BackgroundLane | Lanes.ViewTransitionLane,
    ],
  ] as [UpdateOptions, Lanes][])(
    'returns lanes for schedule',
    (options, lanes) => {
      expect(getLanesFromOptions(options)).toBe(lanes);
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
      isBindable(
        new MockBindable({ type: MockPrimitive.instance, value: 'foo' }),
      ),
    ).toBe(true);
    expect(isBindable('foo')).toBe(false);
  });
});
