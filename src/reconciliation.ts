export interface MutationHandler<TSource, TTarget> {
  insert(item: TSource, referenceTarget: TTarget | undefined): TTarget;
  update(target: TTarget, item: TSource): TTarget;
  updateAndMove(
    target: TTarget,
    item: TSource,
    referenceTarget: TTarget | undefined,
  ): TTarget;
  remove(target: TTarget): void;
}

export function reconcileItems<TSource, TTarget, TKey>(
  oldKeys: TKey[],
  newKeys: TKey[],
  oldTargets: (TTarget | undefined)[],
  newItems: TSource[],
  handler: MutationHandler<TSource, TTarget>,
): TTarget[] {
  const newTargets: TTarget[] = new Array(newKeys.length);

  let oldHead = 0;
  let newHead = 0;
  let oldTail = oldKeys.length - 1;
  let newTail = newKeys.length - 1;
  let oldKeyToIndexMap: Map<TKey, number> | undefined;
  let newKeyToIndexMap: Map<TKey, number> | undefined;

  while (true) {
    if (newHead > newTail) {
      while (oldHead <= oldTail) {
        const oldTarget = oldTargets[oldHead];
        if (oldTarget !== undefined) {
          handler.remove(oldTarget);
        }
        oldHead++;
      }
      break;
    } else if (oldHead > oldTail) {
      while (newHead <= newTail) {
        newTargets[newHead] = handler.insert(
          newItems[newHead]!,
          newTargets[newTail + 1],
        );
        newHead++;
      }
      break;
    } else if (oldTargets[oldHead] === undefined) {
      oldHead++;
    } else if (oldTargets[oldTail] === undefined) {
      oldTail--;
    } else if (Object.is(oldKeys[oldHead]!, newKeys[newHead]!)) {
      newTargets[newHead] = handler.update(
        oldTargets[oldHead]!,
        newItems[newHead]!,
      );
      oldHead++;
      newHead++;
    } else if (Object.is(oldKeys[oldTail]!, newKeys[newTail]!)) {
      newTargets[newTail] = handler.update(
        oldTargets[oldTail]!,
        newItems[newTail]!,
      );
      oldTail--;
      newTail--;
    } else if (
      Object.is(oldKeys[oldHead]!, newKeys[newTail]!) &&
      Object.is(oldKeys[oldTail]!, newKeys[newHead]!)
    ) {
      newTargets[newHead] = handler.updateAndMove(
        oldTargets[oldTail]!,
        newItems[newHead]!,
        oldTargets[oldHead],
      );
      newTargets[newTail] = handler.updateAndMove(
        oldTargets[oldHead]!,
        newItems[newTail]!,
        newTargets[newTail + 1],
      );
      oldHead++;
      newHead++;
      oldTail--;
      newTail--;
    } else {
      newKeyToIndexMap ??= buildKeyToIndexMap(newKeys, newHead, newTail);

      if (!newKeyToIndexMap.has(oldKeys[oldHead]!)) {
        handler.remove(oldTargets[oldHead]!);
        oldHead++;
      } else if (!newKeyToIndexMap.has(oldKeys[oldTail]!)) {
        handler.remove(oldTargets[oldTail]!);
        oldTail--;
      } else {
        oldKeyToIndexMap ??= buildKeyToIndexMap(oldKeys, oldHead, oldTail);

        const oldIndex = oldKeyToIndexMap.get(newKeys[newTail]!);

        if (
          oldIndex !== undefined &&
          oldIndex >= oldHead &&
          oldIndex <= oldTail &&
          oldTargets[oldIndex] !== undefined
        ) {
          newTargets[newTail] = handler.updateAndMove(
            oldTargets[oldIndex],
            newItems[newTail]!,
            newTargets[newTail + 1],
          );
          oldTargets[oldIndex] = undefined;
        } else {
          newTargets[newTail] = handler.insert(
            newItems[newTail]!,
            newTargets[newTail + 1],
          );
        }

        newTail--;
      }
    }
  }

  return newTargets;
}

function buildKeyToIndexMap<T>(
  keys: T[],
  head: number,
  tail: number,
): Map<T, number> {
  const keyToIndexMap = new Map();
  for (let i = head; i <= tail; i++) {
    keyToIndexMap.set(keys[i]!, i);
  }
  return keyToIndexMap;
}
