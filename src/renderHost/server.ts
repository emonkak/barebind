/// <reference path="../../typings/scheduler.d.ts" />
//
import type {
  Effect,
  Primitive,
  SlotType,
  Template,
  TemplateMode,
} from '../directive.js';
import { CommitPhase } from '../hook.js';
import { type Part, PartType } from '../part.js';
import { AttributePrimitive } from '../primitive/attribute.js';
import { BlackholePrimitive } from '../primitive/blackhole.js';
import { ClassListPrimitive } from '../primitive/classList.js';
import { ClassMapPrimitive } from '../primitive/classMap.js';
import { LivePrimitive } from '../primitive/live.js';
import { NodePrimitive } from '../primitive/node.js';
import { PropertyPrimitive } from '../primitive/property.js';
import { SpreadPrimitive } from '../primitive/spread.js';
import { StylePrimitive } from '../primitive/style.js';
import type { RenderHost, RequestCallbackOptions } from '../renderHost.js';
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

  commitEffects(effects: Effect[], phase: CommitPhase): void {
    if (phase !== CommitPhase.Mutation) {
      return;
    }
    for (let i = 0, l = effects.length; i < l; i++) {
      effects[i]!.commit();
    }
  }

  createTemplate(
    strings: readonly string[],
    binds: readonly unknown[],
    placeholder: string,
    mode: TemplateMode,
  ): Template<readonly unknown[]> {
    if (binds.length === 0) {
      // Assumption: strings.length === 1
      if (strings[0]!.trim() === '') {
        return EmptyTemplate;
      }
    } else if (binds.length === 1) {
      // Assumption: strings.length === 2
      const beforeString = strings[0]!.trim();
      const afterString = strings[1]!.trim();

      if (beforeString === '' && afterString === '') {
        // Tags are nowhere, so it's plain text.
        return TextTemplate;
      }

      if (
        (beforeString === '<' || beforeString === '<!--') &&
        (afterString === '>' || afterString === '/>' || afterString === '-->')
      ) {
        // There is only one tag.
        return ChildNodeTemplate;
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

  getCurrentTaskPriority(): TaskPriority {
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
            case 'classmap':
              return ClassMapPrimitive;
            case 'style':
              return StylePrimitive;
            default:
              return BlackholePrimitive;
          }
        }
        return AttributePrimitive;
      case PartType.ChildNode:
      case PartType.Text:
        return NodePrimitive;
      case PartType.Element:
        return SpreadPrimitive;
      case PartType.Event:
        return BlackholePrimitive;
      case PartType.Live:
        return LivePrimitive;
      case PartType.Property:
        return PropertyPrimitive;
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
