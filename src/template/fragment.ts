import { sequentialEqual } from '../compare.js';
import {
  areDirectiveTypesEqual,
  type Part,
  type Template,
  type TemplateResult,
  type UpdateSession,
} from '../internal.js';
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
      sequentialEqual(other._templates, this._templates, areDirectiveTypesEqual)
    );
  }

  hydrate(
    binds: readonly unknown[],
    part: Part.ChildNodePart,
    targetTree: TreeWalker,
    session: UpdateSession,
  ): TemplateResult {
    const childNodes = [];
    const slots = [];
    let bindIndex = 0;

    for (let i = 0, l = this._templates.length; i < l; i++) {
      const template = this._templates[i]!;
      const result = template.hydrate(
        binds.slice(bindIndex, bindIndex + template.arity),
        part,
        targetTree,
        session,
      );
      childNodes.push(...result.childNodes);
      slots.push(...result.slots);
      bindIndex += template.arity;
    }

    return { childNodes, slots };
  }

  render(
    binds: readonly unknown[],
    part: Part.ChildNodePart,
    session: UpdateSession,
  ): TemplateResult {
    const childNodes = [];
    const slots = [];
    let bindIndex = 0;

    for (let i = 0, l = this._templates.length; i < l; i++) {
      const template = this._templates[i]!;
      const result = template.render(
        binds.slice(bindIndex, bindIndex + template.arity),
        part,
        session,
      );
      childNodes.push(...result.childNodes);
      slots.push(...result.slots);
      bindIndex += template.arity;
    }

    return { childNodes, slots };
  }
}
