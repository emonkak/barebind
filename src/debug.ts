import type { ComponentType, RenderNode } from './core.js';

export function formatComponentStack(
  componentStack: ComponentType<unknown>[],
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

export function getComponentStack(node: RenderNode): ComponentType<unknown>[] {
  const componentStack: ComponentType<unknown>[] = [];
  let current: RenderNode | null = node;

  do {
    if (typeof current.type === 'function') {
      componentStack.push(current.type);
    }
    current = current.parent;
  } while (current != null);

  return componentStack;
}
