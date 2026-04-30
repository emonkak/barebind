import type { View } from './core.js';

export function formatComponentStack(
  componentStack: View.ComponentView[],
): string {
  const tail = componentStack.length - 1;
  return componentStack
    .map((child, i) => {
      const prefix = i === tail ? '' : '   '.repeat(tail - i - 1) + '`- ';
      const suffix = i === 0 ? ' <- ERROR occurred here!' : '';
      return prefix + child.type.name + suffix;
    })
    .reverse()
    .join('\n');
}

export function getComponentStack(view: View): View.ComponentView[] {
  const componentStack: View.ComponentView[] = [];
  let current: View | null = view;

  do {
    if (typeof current.type === 'function') {
      componentStack.push(current);
    }
    current = view.parent;
  } while (current !== null);

  return componentStack;
}
