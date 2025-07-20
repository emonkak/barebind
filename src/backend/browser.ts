/// <reference path="../../typings/scheduler.d.ts" />

import {
  type Backend,
  type CommitContext,
  type CommitPhase,
  type Effect,
  type Part,
  PartType,
  type Primitive,
  type RequestCallbackOptions,
  type SlotType,
  type Template,
  type TemplateMode,
} from '../core.js';
import { AttributePrimitive } from '../primitive/attribute.js';
import { BlackholePrimitive } from '../primitive/blackhole.js';
import { ClassListPrimitive } from '../primitive/class-list.js';
import { EventPrimitive } from '../primitive/event.js';
import { LivePrimitive } from '../primitive/live.js';
import { NodePrimitive } from '../primitive/node.js';
import { PropertyPrimitive } from '../primitive/property.js';
import { RefPrimitive } from '../primitive/ref.js';
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

export class BrowserBackend implements Backend {
  commitEffects(
    effects: Effect[],
    _phase: CommitPhase,
    context: CommitContext,
  ): void {
    for (let i = 0, l = effects.length; i < l; i++) {
      effects[i]!.commit(context);
    }
  }

  getCurrentPriority(): TaskPriority {
    const currentEvent = window.event;
    if (currentEvent !== undefined) {
      return isContinuousEvent(currentEvent) ? 'user-visible' : 'user-blocking';
    } else {
      return document.readyState === 'complete'
        ? 'background'
        : 'user-blocking';
    }
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

    return TaggedTemplate.parse(strings, binds, placeholder, mode, document);
  }

  requestCallback(
    callback: () => Promise<void> | void,
    options?: RequestCallbackOptions,
  ): Promise<void> {
    if (typeof window.scheduler?.postTask === 'function') {
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
            if (typeof window.requestIdleCallback === 'function') {
              requestIdleCallback(resolve);
            } else {
              setTimeout(resolve);
            }
            break;
          }
          default:
            setTimeout(resolve);
        }
      }).then(callback);
    }
  }

  resolvePrimitive(value: unknown, part: Part): Primitive<unknown> {
    switch (part.type) {
      case PartType.Attribute:
        if (part.name[0] === ':') {
          switch (part.name.slice(1).toLowerCase()) {
            case 'classlist':
              return ClassListPrimitive;
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
        return value != null ? NodePrimitive : BlackholePrimitive;
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

  resolveSlotType(_value: unknown, part: Part): SlotType {
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
    if (typeof window.scheduler?.yield === 'function') {
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
