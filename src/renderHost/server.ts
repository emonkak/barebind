/// <reference path="../../typings/scheduler.d.ts" />
//
import type {
  Effect,
  EffectContext,
  Primitive,
  SlotType,
  Template,
  TemplateMode,
} from '../directive.js';
import { type Part, PartType } from '../part.js';
import { AttributePrimitive } from '../primitive/attribute.js';
import { BlackholePrimitive } from '../primitive/blackhole.js';
import { ClassListPrimitive } from '../primitive/classList.js';
import { LivePrimitive } from '../primitive/live.js';
import { NodePrimitive } from '../primitive/node.js';
import { PropertyPrimitive } from '../primitive/property.js';
import { SpreadPrimitive } from '../primitive/spread.js';
import { StylePrimitive } from '../primitive/style.js';
import { TextPrimitive } from '../primitive/text.js';
import {
  CommitPhase,
  type RenderHost,
  type RequestCallbackOptions,
} from '../renderHost.js';
import { LooseSlot } from '../slot/loose.js';
import { StrictSlot } from '../slot/strict.js';
import { ChildNodeTemplate } from '../template/childNodeTemplate.js';
import { EmptyTemplate } from '../template/emptyTemplate.js';
import { TaggedTemplate } from '../template/taggedTemplate.js';
import { TextTemplate } from '../template/textTemplate.js';

export class ServerRenderHost implements RenderHost {
  private readonly _document: Document;

  constructor(document: Document) {
    this._document = document;
  }

  commitEffects(
    effects: Effect[],
    phase: CommitPhase,
    context: EffectContext,
  ): void {
    if (phase !== CommitPhase.Mutation) {
      return;
    }
    for (let i = 0, l = effects.length; i < l; i++) {
      effects[i]!.commit(context);
    }
  }

  createTemplate(
    strings: readonly string[],
    binds: readonly unknown[],
    placeholder: string,
    mode: TemplateMode,
  ): Template<readonly unknown[]> {
    if (binds.length === 0) {
      // Assert: strings.length === 1
      if (strings[0]!.trim() === '') {
        return EmptyTemplate;
      }
    } else if (binds.length === 1) {
      // Assert: strings.length === 2
      const precedingString = strings[0]!.trim();
      const followingString = strings[1]!.trim();

      if (
        (precedingString === '<' || precedingString === '<!--') &&
        (followingString === '>' ||
          followingString === '/>' ||
          followingString === '-->')
      ) {
        // There is only one tag.
        return ChildNodeTemplate;
      }

      if (!precedingString.includes('<') && !followingString.includes('<')) {
        // Tags are nowhere, so it is a plain text.
        return new TextTemplate(precedingString, followingString);
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

  getCurrentPriority(): TaskPriority {
    return 'user-blocking';
  }

  requestCallback(
    callback: () => Promise<void> | void,
    _options?: RequestCallbackOptions,
  ): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve);
    }).then(() => callback());
  }

  resolvePrimitive(part: Part): Primitive<unknown> {
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
        return NodePrimitive;
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

  resolveSlotType(part: Part): SlotType {
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
