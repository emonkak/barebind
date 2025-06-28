/// <reference path="../../typings/scheduler.d.ts" />

import type {
  Effect,
  Primitive,
  SlotType,
  Template,
  TemplateMode,
} from '../directive.js';
import type { CommitPhase } from '../hook.js';
import { type Part, PartType } from '../part.js';
import { AttributePrimitive } from '../primitive/attribute.js';
import { BlackholePrimitive } from '../primitive/blackhole.js';
import { ClassListPrimitive } from '../primitive/classList.js';
import { ClassMapPrimitive } from '../primitive/classMap.js';
import { EventPrimitive } from '../primitive/event.js';
import { LivePrimitive } from '../primitive/live.js';
import { NodePrimitive } from '../primitive/node.js';
import { PropertyPrimitive } from '../primitive/property.js';
import { RefPrimitive } from '../primitive/ref.js';
import { SpreadPrimitive } from '../primitive/spread.js';
import { StylePrimitive } from '../primitive/style.js';
import { TextPrimitive } from '../primitive/text.js';
import type { RenderHost, RequestCallbackOptions } from '../renderHost.js';
import { LooseSlot } from '../slot/loose.js';
import { StrictSlot } from '../slot/strict.js';
import { ChildNodeTemplate } from '../template/childNodeTemplate.js';
import { EmptyTemplate } from '../template/emptyTemplate.js';
import { TaggedTemplate } from '../template/taggedTemplate.js';
import { TextTemplate } from '../template/textTemplate.js';

export class BrowserRenderHost implements RenderHost {
  commitEffects(effects: Effect[], _phase: CommitPhase): void {
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
        // Tags are nowhere, so it's plain text.
        return new TextTemplate(precedingString, followingString);
      }
    }

    return TaggedTemplate.parse(strings, binds, placeholder, mode, document);
  }

  getCurrentTaskPriority(): TaskPriority {
    const currentEvent = window.event;
    if (currentEvent !== undefined) {
      return isContinuousEvent(currentEvent) ? 'user-visible' : 'user-blocking';
    } else {
      return 'background';
    }
  }

  requestCallback(
    callback: () => Promise<void> | void,
    options?: RequestCallbackOptions,
  ): Promise<void> {
    if (typeof globalThis.scheduler?.postTask === 'function') {
      return scheduler.postTask(callback, options);
    } else {
      return new Promise((resolve) => {
        switch (options?.priority) {
          case 'user-blocking': {
            const channel = new MessageChannel();
            channel.port1.onmessage = resolve;
            channel.port2.postMessage(null);
            break;
          }
          case 'background': {
            if (typeof globalThis.requestIdleCallback === 'function') {
              requestIdleCallback(resolve);
            } else {
              setTimeout(resolve);
            }
            break;
          }
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
        return NodePrimitive;
      case PartType.Element:
        return SpreadPrimitive;
      case PartType.Event:
        return EventPrimitive;
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
    if (typeof document.startViewTransition === 'function') {
      return document.startViewTransition(callback).finished;
    } else {
      return Promise.resolve().then(callback);
    }
  }

  yieldToMain(): Promise<void> {
    if (typeof globalThis.scheduler?.yield === 'function') {
      return scheduler.yield();
    } else {
      return new Promise((resolve) => {
        setTimeout(resolve);
      });
    }
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
