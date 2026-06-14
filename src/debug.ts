import type { Component, Scope } from './core.js';

export function formatComponentStack(
  componentStack: Component<unknown>[],
): string {
  const tail = componentStack.length - 1;
  return componentStack
    .map((type, i) => {
      const prefix = i === tail ? '' : '   '.repeat(tail - i - 1) + '`- ';
      const suffix = i === 0 ? ' <- ERROR occurred here!' : '';
      return prefix + type.name + suffix;
    })
    .reverse()
    .join('\n');
}

export function getComponentStack(scope: Scope): Component<unknown>[] {
  const componentStack: Component<unknown>[] = [];
  let current: Scope | null = scope;

  while (current !== null && current.owner !== null) {
    componentStack.push(current.owner!);
    current = current.parent;
  }

  return componentStack;
}
