/// <reference path="../../../typings/scheduler.d.ts" />

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
import { EventPrimitive } from '../primitives/event.js';
import { LivePrimitive } from '../primitives/live.js';
import { NodePrimitive } from '../primitives/node.js';
import { PropertyPrimitive } from '../primitives/property.js';
import { RefPrimitive } from '../primitives/ref.js';
import { SpreadPrimitive } from '../primitives/spread.js';
import { StylePrimitive } from '../primitives/style.js';
import type {
  CommitPhase,
  RenderHost,
  RequestCallbackOptions,
} from '../renderHost.js';
import { FlexibleSlot } from '../slots/flexible.js';
import { StrictSlot } from '../slots/strict.js';
import { ChildNodeTemplate } from '../templates/childNodeTemplate.js';
import { EmptyTemplate } from '../templates/emptyTemplate.js';
import { TaggedTemplate } from '../templates/taggedTemplate.js';
import { TextTemplate } from '../templates/textTemplate.js';

export class BrowserRenderHost implements RenderHost {
  commitEffects(effects: Effect[], _phase: CommitPhase): void {
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

  getTaskPriority(): TaskPriority {
    const currentEvent = window.event;
    if (currentEvent !== undefined) {
      return isContinuousEvent(currentEvent) ? 'user-visible' : 'user-blocking';
    } else {
      return 'user-visible';
    }
  }

  requestCallback(
    callback: () => Promise<void> | void,
    options?: RequestCallbackOptions,
  ): Promise<void> {
    if (typeof scheduler?.postTask === 'function') {
      return scheduler.postTask(callback, options);
    } else {
      return new Promise((resolve) => {
        switch (options?.priority) {
          case 'user-blocking':
            const channel = new MessageChannel();
            channel.port1.onmessage = resolve;
            channel.port2.postMessage(null);
            break;
          case 'background':
            if (typeof requestIdleCallback === 'function') {
              requestIdleCallback(resolve);
            } else {
              setTimeout(resolve);
            }
            break;
          default:
            setTimeout(resolve);
        }
      }).then(() => callback());
    }
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
            case 'ref':
              return RefPrimitive;
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
        return EventPrimitive;
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
    if (typeof document.startViewTransition === 'function') {
      return document.startViewTransition(callback).finished;
    } else {
      return Promise.resolve().then(callback);
    }
  }

  yieldToMain(): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve);
    });
  }
}

function isContinuousEvent(event: Event): boolean {
  switch (event.type as keyof DocumentEventMap) {
    case 'drag':
    case 'dragenter':
    case 'dragleave':
    case 'dragover':
    case 'mouseenter':
    case 'mouseleave':
    case 'mousemove':
    case 'mouseout':
    case 'mouseover':
    case 'pointerenter':
    case 'pointerleave':
    case 'pointermove':
    case 'pointerout':
    case 'pointerover':
    case 'scroll':
    case 'touchmove':
    case 'wheel':
      return true;
    default:
      return false;
  }
}
