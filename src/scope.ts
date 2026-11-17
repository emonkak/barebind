import type { Component, Scope } from './base.js';

export function createScope(owner: object): Scope {
  return { owner, parent: null, level: 0, instances: [] };
}

export function enterScope(scope: Scope, owner: Component<any>): Scope {
  return {
    owner,
    parent: scope,
    level: scope.level + 1,
    instances: [],
  };
}
