import type {
  Bindable,
  Effect,
  Primitive,
  SlotType,
  Template,
  TemplateMode,
} from '../core.js';
import { type Part, PartType } from '../part.js';
import { AttributePrimitive } from '../primitives/attribute.js';
import { BlackholePrimitive } from '../primitives/blackhole.js';
import { ClassListPrimitive } from '../primitives/classList.js';
import { ClassMapPrimitive } from '../primitives/classMap.js';
import { LivePrimitive } from '../primitives/live.js';
import { NodePrimitive } from '../primitives/node.js';
import { PropertyPrimitive } from '../primitives/property.js';
import { SpreadPrimitive } from '../primitives/spread.js';
import { StylePrimitive } from '../primitives/style.js';
import {
  CommitPhase,
  type RenderHost,
  type RequestCallbackOptions,
} from '../renderHost.js';
import { FlexibleSlot } from '../slots/flexible.js';
import { StrictSlot } from '../slots/strict.js';
import { ChildNodeTemplate } from '../templates/childNodeTemplate.js';
import { EmptyTemplate } from '../templates/emptyTemplate.js';
import { TaggedTemplate } from '../templates/taggedTemplate.js';
import { TextTemplate } from '../templates/textTemplate.js';

export class ServerRenderHost implements RenderHost {
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
    binds: readonly Bindable<unknown>[],
    placeholder: string,
    mode: TemplateMode,
  ): Template<readonly Bindable<unknown>[]> {
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

    return TaggedTemplate.parse(strings, binds, placeholder, mode, document);
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
    }).then(callback);
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
        return FlexibleSlot;
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
