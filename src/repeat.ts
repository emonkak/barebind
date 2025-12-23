/// <reference path="../typings/moveBefore.d.ts" />

import { DirectiveError, DirectiveSpecifier } from './directive.js';
import { mountMarkerNode } from './hydration.js';
import {
  type Binding,
  type DirectiveContext,
  type DirectiveType,
  getStartNode,
  type Part,
  PartType,
  type Slot,
  type UpdateSession,
} from './internal.js';

const OPERATION_INSERT = 0;
const OPERATION_MOVE = 1;
const OPERATION_MOVE_AND_UPDATE = 2;
const OPERATION_REMOVE = 3;
const OPERATION_UPDATE = 4;

export type RepeatProps<TSource, TKey = unknown, TValue = unknown> = {
  source: Iterable<TSource>;
  keySelector?: (element: TSource, index: number) => TKey;
  valueSelector?: (element: TSource, index: number) => TValue;
};

interface SourceItem<TKey, TValue> {
  key: TKey;
  value: TValue;
}

interface TargetItem<TKey, TValue> {
  key: TKey;
  slot: Slot<TValue>;
}

type Operation<TKey, TValue> =
  | {
      type: typeof OPERATION_INSERT;
      target: TargetItem<TKey, TValue>;
      reference: TargetItem<TKey, TValue> | undefined;
    }
  | {
      type: typeof OPERATION_MOVE;
      target: TargetItem<TKey, TValue>;
      reference: TargetItem<TKey, TValue> | undefined;
    }
  | {
      type: typeof OPERATION_MOVE_AND_UPDATE;
      target: TargetItem<TKey, TValue>;
      reference: TargetItem<TKey, TValue> | undefined;
    }
  | { type: typeof OPERATION_UPDATE; target: TargetItem<TKey, TValue> }
  | { type: typeof OPERATION_REMOVE; target: TargetItem<TKey, TValue> };

interface ReconciliationHandler<TKey, TValue> {
  insert(
    source: SourceItem<TKey, TValue>,
    reference: TargetItem<TKey, TValue> | undefined,
  ): TargetItem<TKey, TValue>;
  update(
    target: TargetItem<TKey, TValue>,
    source: SourceItem<TKey, TValue>,
  ): TargetItem<TKey, TValue>;
  move(
    target: TargetItem<TKey, TValue>,
    source: SourceItem<TKey, TValue>,
    reference: TargetItem<TKey, TValue> | undefined,
  ): TargetItem<TKey, TValue>;
  remove(item: TargetItem<TKey, TValue>): void;
}

export function Repeat<TSource, TKey, TValue>(
  props: RepeatProps<TSource, TKey, TValue>,
): DirectiveSpecifier<RepeatProps<TSource, TKey, TValue>> {
  return new DirectiveSpecifier(RepeatDirective.instance, props);
}

export class RepeatDirective<TSource, TKey, TValue>
  implements DirectiveType<RepeatProps<TSource, TKey, TValue>>
{
  static readonly instance: RepeatDirective<any, any, any> =
    new RepeatDirective();

  resolveBinding(
    props: RepeatProps<TSource, TKey, TValue>,
    part: Part,
    _context: DirectiveContext,
  ): RepeatBinding<TSource, TKey, TValue> {
    if (part.type !== PartType.ChildNode) {
      throw new DirectiveError(
        this,
        props,
        part,
        'RepeatDirective must be used in a child part.',
      );
    }
    return new RepeatBinding(props, part);
  }
}

export class RepeatBinding<TSource, TKey, TValue>
  implements Binding<RepeatProps<TSource, TKey, TValue>>
{
  private _props: RepeatProps<TSource, TKey, TValue>;

  private readonly _part: Part.ChildNodePart;

  private _pendingItems: TargetItem<TKey, TValue>[] = [];

  private _memoizedItems: TargetItem<TKey, TValue>[] | null = null;

  private _pendingOperations: Operation<TKey, TValue>[] = [];

  constructor(
    props: RepeatProps<TSource, TKey, TValue>,
    part: Part.ChildNodePart,
  ) {
    this._props = props;
    this._part = part;
  }

  get type(): DirectiveType<RepeatProps<TSource, TKey, TValue>> {
    return RepeatDirective.instance;
  }

  get value(): RepeatProps<TSource, TKey, TValue> {
    return this._props;
  }

  set value(props: RepeatProps<TSource, TKey, TValue>) {
    this._props = props;
  }

  get part(): Part.ChildNodePart {
    return this._part;
  }

  shouldUpdate(props: RepeatProps<TSource, TKey, TValue>): boolean {
    return (
      this._memoizedItems === null ||
      props.source !== this._props.source ||
      props.keySelector !== this._props.keySelector ||
      props.valueSelector !== this._props.valueSelector
    );
  }

  attach(session: UpdateSession): void {
    const { context, rootScope } = session;
    const document = this._part.node.ownerDocument;
    const targetTree = rootScope.getHydrationTarget();

    const oldTargets = this._pendingItems;
    const newSources = generateItems(this._props);
    const newTargets = reconcileItems(oldTargets, newSources, {
      insert: ({ key, value }, reference) => {
        const part = {
          type: PartType.ChildNode,
          node: document.createComment(''),
          anchorNode: null,
          namespaceURI: this._part.namespaceURI,
        };
        const slot = context.resolveSlot(value, part);
        const target = {
          key,
          slot,
        };
        slot.attach(session);
        if (targetTree !== null) {
          mountMarkerNode(targetTree, part.node);
        } else {
          this._pendingOperations.push({
            type: OPERATION_INSERT,
            target,
            reference,
          });
        }
        return target;
      },
      update: (target, { value }) => {
        if (target.slot.reconcile(value, session)) {
          this._pendingOperations.push({
            type: OPERATION_UPDATE,
            target,
          });
        }
        return target;
      },
      move: (target, { value }, reference) => {
        if (target.slot.reconcile(value, session)) {
          this._pendingOperations.push({
            type: OPERATION_MOVE_AND_UPDATE,
            target,
            reference: reference,
          });
        } else {
          this._pendingOperations.push({
            type: OPERATION_MOVE,
            target,
            reference: reference,
          });
        }
        return target;
      },
      remove: (target) => {
        target.slot.detach(session);
        this._pendingOperations.push({
          type: OPERATION_REMOVE,
          target,
        });
      },
    });

    this._pendingItems = newTargets;

    if (targetTree !== null) {
      this._part.anchorNode = getAnchorNode(newTargets);
      this._memoizedItems = newTargets;
    }
  }

  detach(session: UpdateSession): void {
    for (let i = this._pendingItems.length - 1; i >= 0; i--) {
      const { slot } = this._pendingItems[i]!;
      slot.detach(session);
    }
  }

  commit(): void {
    for (let i = 0, l = this._pendingOperations.length; i < l; i++) {
      const operation = this._pendingOperations[i]!;
      switch (operation.type) {
        case OPERATION_INSERT: {
          const { target, reference } = operation;
          insertItem(target, reference, this._part);
          target.slot.commit();
          break;
        }
        case OPERATION_MOVE: {
          const { target, reference } = operation;
          moveItem(target, reference, this._part);
          break;
        }
        case OPERATION_MOVE_AND_UPDATE: {
          const { target, reference } = operation;
          moveItem(target, reference, this._part);
          target.slot.commit();
          break;
        }
        case OPERATION_UPDATE: {
          const { slot } = operation.target;
          slot.commit();
          break;
        }
        case OPERATION_REMOVE: {
          const { slot } = operation.target;
          slot.rollback();
          slot.part.node.remove();
          break;
        }
      }
    }

    this._part.anchorNode = getAnchorNode(this._pendingItems);
    this._memoizedItems = this._pendingItems;
    this._pendingOperations = [];
  }

  rollback(): void {
    if (this._memoizedItems !== null) {
      for (let i = this._memoizedItems.length - 1; i >= 0; i--) {
        const { slot } = this._memoizedItems[i]!;
        slot.rollback();
        slot.part.node.remove();
      }
    }

    this._part.anchorNode = null;
    this._pendingItems = [];
    this._memoizedItems = null;
    this._pendingOperations = [];
  }
}

function defaultKeySelector(_element: unknown, index: number): any {
  return index;
}

function defaultValueSelector(element: unknown): any {
  return element;
}

function generateItems<TSource, TKey, TValue>({
  source,
  keySelector = defaultKeySelector,
  valueSelector = defaultValueSelector,
}: RepeatProps<TSource, TKey, TValue>): SourceItem<TKey, TValue>[] {
  return Array.from(source, (element, i) => {
    const key = keySelector(element, i);
    const value = valueSelector(element, i);
    return { key, value };
  });
}

function getAnchorNode<TKey, TValue>(
  targets: TargetItem<TKey, TValue>[],
): ChildNode | null {
  return targets.length > 0 ? getStartNode(targets[0]!.slot.part) : null;
}

function getChildNodes(startNode: ChildNode, endNode: ChildNode): ChildNode[] {
  const childNodes = [startNode];
  let currentNode: ChildNode | null = startNode;

  while (currentNode !== endNode && currentNode.nextSibling !== null) {
    currentNode = currentNode.nextSibling;
    childNodes.push(currentNode);
  }

  return childNodes;
}

function insertItem<TKey, TValue>(
  target: TargetItem<TKey, TValue>,
  reference: TargetItem<TKey, TValue> | undefined,
  part: Part,
): void {
  const referenceNode =
    reference !== undefined ? getStartNode(reference.slot.part) : part.node;
  referenceNode.before(target.slot.part.node);
}

function matchesKey<TKey, TValue>(
  target: TargetItem<TKey, TValue>,
  source: SourceItem<TKey, TValue>,
) {
  return Object.is(target.key, source.key);
}

function moveChildNodes(childNodes: ChildNode[], referenceNode: Node): void {
  const { parentNode } = referenceNode;

  if (parentNode !== null) {
    const insertOrMoveBefore =
      /* v8 ignore next */
      Element.prototype.moveBefore ?? Element.prototype.insertBefore;

    for (let i = 0, l = childNodes.length; i < l; i++) {
      insertOrMoveBefore.call(parentNode, childNodes[i]!, referenceNode);
    }
  }
}

function moveItem<TKey, TValue>(
  target: TargetItem<TKey, TValue>,
  reference: TargetItem<TKey, TValue> | undefined,
  part: Part,
): void {
  const startNode = getStartNode(target.slot.part);
  const endNode = target.slot.part.node;
  const childNodes = getChildNodes(startNode, endNode);
  const referenceNode =
    reference !== undefined ? getStartNode(reference.slot.part) : part.node;
  moveChildNodes(childNodes, referenceNode);
}

function reconcileItems<TKey, TValue>(
  oldTargets: (TargetItem<TKey, TValue> | undefined)[],
  newSources: SourceItem<TKey, TValue>[],
  handler: ReconciliationHandler<TKey, TValue>,
): TargetItem<TKey, TValue>[] {
  const newTargets: TargetItem<TKey, TValue>[] = new Array(newSources.length);

  let oldHead = 0;
  let oldTail = oldTargets.length - 1;
  let newHead = 0;
  let newTail = newTargets.length - 1;

  while (true) {
    if (newHead > newTail) {
      while (oldHead <= oldTail) {
        handler.remove(oldTargets[oldHead]!);
        oldHead++;
      }
      break;
    } else if (oldHead > oldTail) {
      while (newHead <= newTail) {
        newTargets[newHead] = handler.insert(
          newSources[newHead]!,
          newTargets[newTail + 1],
        );
        newHead++;
      }
      break;
    } else if (matchesKey(oldTargets[oldHead]!, newSources[newHead]!)) {
      newTargets[newHead] = handler.update(
        oldTargets[oldHead]!,
        newSources[newHead]!,
      );
      newHead++;
      oldHead++;
    } else if (matchesKey(oldTargets[oldTail]!, newSources[newTail]!)) {
      newTargets[newTail] = handler.update(
        oldTargets[oldTail]!,
        newSources[newTail]!,
      );
      newTail--;
      oldTail--;
    } else if (matchesKey(oldTargets[oldHead]!, newSources[newTail]!)) {
      newTargets[newTail] = handler.move(
        oldTargets[oldHead]!,
        newSources[newTail]!,
        newTargets[newTail + 1],
      );
      newTail--;
      oldHead++;
    } else if (matchesKey(oldTargets[oldTail]!, newSources[newHead]!)) {
      newTargets[newHead] = handler.move(
        oldTargets[oldTail]!,
        newSources[newHead]!,
        oldTargets[oldHead],
      );
      newHead++;
      oldTail--;
    } else {
      const oldIndexMap = new Map();
      for (let index = oldHead; index <= oldTail; index++) {
        oldIndexMap.set(oldTargets[index]!.key, index);
      }
      while (newHead <= newTail) {
        const newSource = newSources[newTail]!;
        const oldIndex = oldIndexMap.get(newSource.key);

        if (oldIndex !== undefined && oldTargets[oldIndex] !== undefined) {
          newTargets[newTail] = handler.move(
            oldTargets[oldIndex],
            newSource,
            newTargets[newTail + 1],
          );
          oldTargets[oldIndex] = undefined;
        } else {
          newTargets[newTail] = handler.insert(
            newSource,
            newTargets[newTail + 1],
          );
        }
        newTail--;
      }
      for (let i = oldHead; i <= oldTail; i++) {
        if (oldTargets[i] !== undefined) {
          handler.remove(oldTargets[i]!);
        }
      }
      break;
    }
  }

  return newTargets;
}
