import type { UsableFunction } from '../../component.js';
import { Atom, Computed, type Signal, type UnwrapSignals } from './signal.js';

export function LocalAtom<T>(initialValue: T): UsableFunction<Atom<T>> {
  return (context) => {
    return context.useMemo(() => new Atom(initialValue), []);
  };
}

export function LocalComputed<
  TResult,
  const TDependencies extends readonly Signal<any>[],
>(
  computation: (...values: UnwrapSignals<TDependencies>) => TResult,
  dependencies: TDependencies,
): UsableFunction<Computed<TResult, TDependencies>> {
  return (context) => {
    return context.useMemo(
      () => new Computed(computation, dependencies),
      dependencies,
    );
  };
}
