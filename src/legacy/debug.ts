import type { Directive, Scope, UpdateUnit } from './core.js';
import { isChildScope } from './scope.js';

export function formatOnwerStack(ownerStack: UpdateUnit[]): string {
  const tail = ownerStack.length - 1;
  return ownerStack
    .map((owner, i) => {
      const prefix = i === tail ? '' : '   '.repeat(tail - i - 1) + '`- ';
      const suffix = i === 0 ? ' <- ERROR occurred here!' : '';
      return prefix + nameOf(owner.directive.type) + suffix;
    })
    .reverse()
    .join('\n');
}

export function getOwnerStack(scope: Scope): UpdateUnit[] {
  const ownerStack: UpdateUnit[] = [];

  while (isChildScope(scope)) {
    ownerStack.push(scope.owner);
    scope = scope.owner.scope;
  }

  return ownerStack;
}

export function nameOf(type: Directive.ElementDirective['type']): string {
  switch (typeof type) {
    case 'function':
      return type.name;
    case 'symbol':
      return type.description!;
    default:
      return 'Template';
  }
}
