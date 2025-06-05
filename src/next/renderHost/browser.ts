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
import { EmptyTemplate } from '../templates/emptyTemplate.js';
import {
  ChildNodeTemplate,
  TextTemplate,
} from '../templates/singleTemplate.js';
import { TaggedTemplate } from '../templates/taggedTemplate.js';

export interface BrowserRenderHostOptions {
  templatePlaceholder?: string;
}

export class BrowserRenderHost implements RenderHost {
  private readonly _templatePlaceholder: string;

  constructor({
    templatePlaceholder = getRandomString(8),
  }: BrowserRenderHostOptions = {}) {
    this._templatePlaceholder = templatePlaceholder;
  }

  commitEffects(effects: Effect[], _phase: CommitPhase): void {
    for (let i = 0, l = effects.length; i < l; i++) {
      effects[i]!.commit();
    }
  }

  createMarkerNode(): Comment {
    return document.createComment('');
  }

  createTemplate(
    strings: readonly string[],
    binds: readonly Bindable<unknown>[],
    mode: TemplateMode,
  ): Template<readonly Bindable<unknown>[]> {
    if (binds.length === 0 && strings[0]!.trim() === '') {
      // Assumption: strings.length === 1
      return EmptyTemplate;
    }

    if (binds.length === 1) {
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
      this._templatePlaceholder,
      mode,
    );
  }

  getTaskPriority(): TaskPriority {
    const currentEvent = window.event;
    if (currentEvent !== undefined) {
      return isContinuousEvent(currentEvent) ? 'user-visible' : 'user-blocking';
    } else {
      return 'user-visible';
    }
  }

  getTemplatePlaceholder(): string {
    return this._templatePlaceholder;
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
        switch (part.name) {
          case ':classList':
            return ClassListPrimitive;
          case ':classMap':
            return ClassMapPrimitive;
          case ':ref':
            return RefPrimitive;
          case ':style':
            return StylePrimitive;
          default:
            return AttributePrimitive;
        }
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
    if (typeof globalThis.scheduler?.yield === 'function') {
      return scheduler.yield();
    } else {
      return new Promise((resolve) => setTimeout(resolve));
    }
  }
}

function getRandomString(length: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(length)), (byte) =>
    (byte % 36).toString(36),
  ).join('');
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
