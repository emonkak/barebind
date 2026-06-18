import type { RenderChild, RenderTree, VElement } from './core.js';

export function formatComponentStack(
  componentStack: RenderChild.ComponentChild[],
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
): RenderChild.ComponentChild[] {
  const componentStack: RenderChild.ComponentChild[] = [];
  let current: RenderTree | null = tree;

  do {
    if (typeof current.type === 'function') {
      componentStack.push(current);
    }
    current = tree.parent;
  } while (current !== null);

  return componentStack;
}

export function nameOf(type: VElement['type']): string {
  switch (typeof type) {
    case 'function':
      return type.name;
    case 'symbol':
      return type.description!;
    default:
      return type instanceof Element ? type.nodeName : 'Template';
  }
}
