/// <reference path="../../typings/scheduler.d.ts" />

import {
  type Backend,
  type CommitContext,
  CommitPhase,
  type Effect,
  type Primitive,
  type RequestCallbackOptions,
  type SlotType,
  type Template,
  type TemplateMode,
} from '../core.js';
import { type Part, PartType } from '../part.js';
import { AttributePrimitive } from '../primitive/attribute.js';
import { BlackholePrimitive } from '../primitive/blackhole.js';
import { ClassListPrimitive } from '../primitive/class-list.js';
import { LivePrimitive } from '../primitive/live.js';
import { NodePrimitive } from '../primitive/node.js';
import { PropertyPrimitive } from '../primitive/property.js';
import { SpreadPrimitive } from '../primitive/spread.js';
import { StylePrimitive } from '../primitive/style.js';
import { TextPrimitive } from '../primitive/text.js';
import { LooseSlot } from '../slot/loose.js';
import { StrictSlot } from '../slot/strict.js';
import { ChildNodeTemplate } from '../template/child-node.js';
import { EmptyTemplate } from '../template/empty.js';
import { TaggedTemplate } from '../template/tagged.js';
import {
  isIsolatedTagInterpolation,
  normalizeText,
} from '../template/template.js';
import { TextTemplate } from '../template/text.js';

const CHILD_NODE_TEMPLATE = new ChildNodeTemplate();
const EMPTY_TEMPLATE = new EmptyTemplate();

export class ServerBackend implements Backend {
  private readonly _document: Document;

  constructor(document: Document) {
    this._document = document;
  }

  commitEffects(
    effects: Effect[],
    phase: CommitPhase,
    context: CommitContext,
  ): void {
    if (phase === CommitPhase.Mutation) {
      for (let i = 0, l = effects.length; i < l; i++) {
        effects[i]!.commit(context);
      }
    }
  }

  getCurrentPriority(): TaskPriority {
    return 'user-blocking';
  }

  parseTemplate(
    strings: readonly string[],
    binds: readonly unknown[],
    placeholder: string,
    mode: TemplateMode,
  ): Template<readonly unknown[]> {
    if (binds.length === 0) {
      // Assert: strings.length === 1
      if (normalizeText(strings[0]!) === '') {
        return EMPTY_TEMPLATE;
      }
    } else if (binds.length === 1) {
      // Assert: strings.length === 2
      const precedingText = normalizeText(strings[0]!);
      const followingText = normalizeText(strings[1]!);

      if (
        (!precedingText.includes('<') && !followingText.includes('<')) ||
        mode === 'textarea'
      ) {
        // Tags are nowhere, so it is a plain text.
        return new TextTemplate(precedingText, followingText);
      }

      if (isIsolatedTagInterpolation(precedingText, followingText)) {
        // There is only one tag.
        return CHILD_NODE_TEMPLATE;
      }
    }

    return TaggedTemplate.parse(
      strings,
      binds,
      placeholder,
      mode,
      this._document,
    );
  }

  requestCallback(
    callback: () => Promise<void> | void,
    _options?: RequestCallbackOptions,
  ): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve);
    }).then(callback);
  }

  resolvePrimitive(value: unknown, part: Part): Primitive<unknown> {
    switch (part.type) {
      case PartType.Attribute:
        if (part.name[0] === ':') {
          switch (part.name.slice(1).toLowerCase()) {
            case 'classlist':
              return ClassListPrimitive;
            case 'style':
              return StylePrimitive;
            default:
              return BlackholePrimitive;
          }
        }
        return AttributePrimitive;
      case PartType.ChildNode:
        return value != null ? NodePrimitive : BlackholePrimitive;
      case PartType.Element:
        return SpreadPrimitive;
      case PartType.Event:
        return BlackholePrimitive;
      case PartType.Live:
        return LivePrimitive;
      case PartType.Property:
        return PropertyPrimitive;
      case PartType.Text:
        return TextPrimitive;
    }
  }

  resolveSlotType(_value: unknown, part: Part): SlotType {
    switch (part.type) {
      case PartType.ChildNode:
        return LooseSlot;
      default:
        return StrictSlot;
    }
  }

  startViewTransition(callback: () => void | Promise<void>): Promise<void> {
    return Promise.resolve().then(callback);
  }

  yieldToMain(): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve);
    });
  }
}
