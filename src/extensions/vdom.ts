import { defineComponent } from '../component.js';
import {
  $toDirectiveElement,
  type Bindable,
  type ComponentFunction,
  type DirectiveElement,
  DirectiveObject,
  isBindable,
} from '../directive.js';
import { ElementTemplate } from '../extensions/element.js';
import { BlackholePrimitive } from '../primitive/blackhole.js';
import { TextTemplate } from '../template/text-template.js';
import { ElementDirective, type ElementProps } from './element.js';
import { RepeatDirective, type RepeatProps } from './repeat.js';

export type VChild =
  | VChild[]
  | VElement
  | Bindable
  | bigint
  | boolean
  | number
  | string
  | symbol
  | null
  | undefined;

export type VElementType<TProps> = ComponentFunction<TProps> | string;

export function createElement<const TProps extends ElementProps>(
  type: VElementType<TProps>,
  props: TProps,
  ...children: VChild[]
): VElement<TProps> {
  return new VElement(type, props, children);
}

export function createFragment(children: VChild[]): VFragment {
  return new VFragment(children);
}

export class VElement<TProps extends ElementProps = ElementProps>
  implements Bindable<unknown>
{
  readonly type: VElementType<TProps>;

  readonly props: TProps;

  readonly children: VChild[];

  constructor(type: VElementType<TProps>, props: TProps, children: VChild[]) {
    this.type = type;
    this.props = props;
    this.children = children;
  }

  [$toDirectiveElement](): DirectiveElement<unknown> {
    if (typeof this.type === 'function') {
      return {
        directive: defineComponent(this.type),
        value: this.props,
      };
    } else {
      return {
        directive: new ElementTemplate(this.type),
        value: [
          new DirectiveObject(ElementDirective, this.props),
          new DirectiveObject(
            RepeatDirective,
            createRepeatProps(this.children),
          ),
        ],
      };
    }
  }
}

export class VFragment implements Bindable<RepeatProps<VChild>> {
  readonly children: VChild[];

  constructor(children: VChild[]) {
    this.children = children;
  }

  [$toDirectiveElement](): DirectiveElement<RepeatProps<VChild>> {
    return {
      directive: RepeatDirective,
      value: createRepeatProps(this.children),
    };
  }
}

function createRepeatProps(children: VChild[]): RepeatProps<VChild> {
  return {
    source: children,
    keySelector: resolveKey,
    valueSelector: resolveValue,
  };
}

function resolveKey(child: VChild, index: number): unknown {
  return child instanceof VElement ? (child.props['key'] ?? index) : index;
}

function resolveValue(child: VChild): Bindable<unknown> {
  if (child == null || typeof child === 'boolean') {
    return new DirectiveObject(BlackholePrimitive, child);
  } else if (Array.isArray(child)) {
    return new DirectiveObject(RepeatDirective, createRepeatProps(child));
  } else if (isBindable(child)) {
    return child;
  } else {
    return new DirectiveObject(new TextTemplate('', ''), [child]);
  }
}
