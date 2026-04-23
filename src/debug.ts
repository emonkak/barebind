import type { RenderTree } from './core.js';

export function formatComponentStack(
  componentStack: RenderTree.ComponentNode[],
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

export function getComponentStack(
  tree: RenderTree,
): RenderTree.ComponentNode[] {
  const componentStack: RenderTree.ComponentNode[] = [];
  let current: RenderTree | null = tree;

  do {
    if (typeof current.type === 'function') {
      componentStack.push(current);
    }
    current = tree.parent;
  } while (current !== null);

  return componentStack;
}
