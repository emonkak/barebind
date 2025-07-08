import { defineComponent } from '../component.js';
import {
  $toDirectiveElement,
  type Bindable,
  type ComponentFunction,
  type DirectiveElement,
  DirectiveSpecifier,
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

const TEXT_TEMPLATE = new TextTemplate('', '');

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

  readonly key: unknown;

  constructor(type: VElementType<TProps>, props: TProps, key: unknown) {
    this.type = type;
    this.props = props;
    this.key = key;
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
          new DirectiveSpecifier(ElementDirective, this.props),
          new DirectiveSpecifier(
            RepeatDirective,
            createRepeatProps(getChildren(this.props)),
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

function getChildren(props: ElementProps): VChild[] {
  if (Object.hasOwn(props, 'children')) {
    return Array.isArray(props['children'])
      ? (props['children'] as VChild[])
      : [props['children'] as VChild];
  } else {
    return [];
  }
}

function resolveKey(child: VChild, index: number): unknown {
  return child instanceof VElement ? (child.key ?? index) : index;
}

function resolveValue(child: VChild): Bindable<unknown> {
  if (isBindable(child)) {
    return child;
  } else if (Array.isArray(child)) {
    return new VFragment(child);
  } else if (child == null || typeof child === 'boolean') {
    return new DirectiveSpecifier(BlackholePrimitive, child);
  } else {
    return new DirectiveSpecifier(TEXT_TEMPLATE, [child]);
  }
}
