import { sequentialEqual } from '../compare.js';
import {
  areDirectiveTypesEqual,
  type Template,
  type TemplateResult,
  type UpdateContext,
} from '../core.js';
import type { HydrationTree } from '../hydration.js';
import type { ChildNodePart } from '../part.js';
import { AbstractTemplate } from './template.js';

export class FragmentTemplate extends AbstractTemplate<readonly unknown[]> {
  private readonly _templates: readonly Template<readonly unknown[]>[];

  constructor(templates: readonly Template<readonly unknown[]>[]) {
    super();
    this._templates = templates;
  }

  get arity(): number {
    return this._templates.reduce(
      (arity, template) => arity + template.arity,
      0,
    );
  }

  equals(other: unknown): boolean {
    return (
      other instanceof FragmentTemplate &&
      sequentialEqual(this._templates, other._templates, areDirectiveTypesEqual)
    );
  }

  hydrate(
    binds: readonly unknown[],
    part: ChildNodePart,
    hydrationTree: HydrationTree,
    context: UpdateContext,
  ): TemplateResult {
    const childNodes = [];
    const slots = [];
    let bindIndex = 0;

    for (let i = 0, l = this._templates.length; i < l; i++) {
      const template = this._templates[i]!;
      const result = template.hydrate(
        binds.slice(bindIndex, bindIndex + template.arity),
        part,
        hydrationTree,
        context,
      );
      childNodes.push(...result.childNodes);
      slots.push(...result.slots);
      bindIndex += template.arity;
    }

    return { childNodes, slots };
  }

  render(
    binds: readonly unknown[],
    part: ChildNodePart,
    context: UpdateContext,
  ): TemplateResult {
    const childNodes = [];
    const slots = [];
    let bindIndex = 0;

    for (let i = 0, l = this._templates.length; i < l; i++) {
      const template = this._templates[i]!;
      const result = template.render(
        binds.slice(bindIndex, bindIndex + template.arity),
        part,
        context,
      );
      childNodes.push(...result.childNodes);
      slots.push(...result.slots);
      bindIndex += template.arity;
    }

    return { childNodes, slots };
  }
}
