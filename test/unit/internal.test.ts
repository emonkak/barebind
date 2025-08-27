import { describe, expect, it } from 'vitest';
import {
  areDirectiveTypesEqual,
  createScope,
  getLanesFromOptions,
  getPriorityFromLanes,
  getSharedContext,
  getStartNode,
  isBindable,
  Lanes,
  PartType,
  type ScheduleOptions,
  setSharedContext,
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

describe('getSharedContext()', () => {
  it('returns the own entry value', () => {
    const scope = createScope();

    setSharedContext(scope, 'foo', 1);

    expect(getSharedContext(scope, 'foo')).toBe(1);
    expect(getSharedContext(scope, 'bar')).toBe(undefined);
  });

  it('returns the inherited entry value', () => {
    const parentScope = createScope();
    const childScope = createScope(parentScope);

    setSharedContext(parentScope, 'foo', 1);
    setSharedContext(parentScope, 'bar', 2);
    setSharedContext(childScope, 'foo', 3);

    expect(getSharedContext(parentScope, 'foo')).toBe(1);
    expect(getSharedContext(parentScope, 'bar')).toBe(2);
    expect(getSharedContext(parentScope, 'baz')).toBe(undefined);

    expect(getSharedContext(childScope, 'foo')).toBe(3);
    expect(getSharedContext(childScope, 'bar')).toBe(2);
    expect(getSharedContext(childScope, 'baz')).toBe(undefined);
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
  ] as [ScheduleOptions, Lanes][])(
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
      isBindable(new MockBindable({ type: MockPrimitive, value: 'foo' })),
    ).toBe(true);
    expect(isBindable('foo')).toBe(false);
  });
});
