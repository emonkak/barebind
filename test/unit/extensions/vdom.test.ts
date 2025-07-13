import { describe, expect, it, vi } from 'vitest';
import { $toDirective, DirectiveSpecifier } from '@/directive.js';
import { FunctionComponent } from '@/extensions/component.js';
import { RepeatDirective } from '@/extensions/repeat.js';
import {
  createElement,
  createFragment,
  ElementBinding,
  ElementDirective,
  VElement,
  VFragment,
  VStaticFragment,
} from '@/extensions/vdom.js';
import { PartType } from '@/part.js';
import { BlackholePrimitive } from '@/primitive/blackhole.js';
import { Runtime } from '@/runtime.js';
import { ChildNodeTemplate } from '@/template/child-node-template.js';
import { ElementTemplate } from '@/template/element-template.js';
import { EmptyTemplate } from '@/template/empty-template.js';
import { FragmentTemplate } from '@/template/fragment-template.js';
import { HTML_NAMESPACE_URI } from '@/template/template.js';
import { TextTemplate } from '@/template/text-template.js';
import { MockBindable, MockPrimitive, MockRenderHost } from '../../mocks.js';
import { createElement as createDOMElement } from '../../test-utils.js';

describe('createElement()', () => {
  it('constructs the new VElement with normalized properties', () => {
    const element = createElement(
      'div',
      { className: 'foo', key: 'bar' },
      'baz',
    );

    expect(element.type).toBe('div');
    expect(element.props).toStrictEqual({
      className: 'foo',
      children: ['baz'],
    });
    expect(element.key).toBe('bar');
    expect(element.hasStaticChildren).toBe(true);
  });
});

describe('createFragment()', () => {
  it('constructs the new VStaticFragment', () => {
    const children = [createElement('div'), 'foo'];
    const element = createFragment(children);

    expect(element.children).toBe(children);
  });
});

describe('VElement', () => {
  describe('[$toDirective]()', () => {
    it('returns a directive with the function component', () => {
      const type = () => {};
      const props = {};
      const element = new VElement(type, props);
      const directive = element[$toDirective]();

      expect(directive.type).toStrictEqual(new FunctionComponent(type));
      expect(directive.value).toBe(props);
    });

    it('returns a directive with the element template with dunamic children', () => {
      const type = 'div';
      const props = { children: [] };
      const element = new VElement(type, props);
      const directive = element[$toDirective]();

      expect(directive.type).toStrictEqual(new ElementTemplate(type));
      expect(directive.value).toStrictEqual([
        new DirectiveSpecifier(ElementDirective, props),
        new VFragment(props.children),
      ]);
    });

    it('returns a directive with the element template with static children', () => {
      const type = 'div';
      const props = { children: [] };
      const element = new VElement(type, props, undefined, true);
      const directive = element[$toDirective]();

      expect(directive.type).toStrictEqual(new ElementTemplate(type));
      expect(directive.value).toStrictEqual([
        new DirectiveSpecifier(ElementDirective, props),
        new VStaticFragment(props.children),
      ]);
    });

    it('returns a directive with the element template without children', () => {
      const type = 'div';
      const props = {};
      const element = new VElement(type, props);
      const directive = element[$toDirective]();

      expect(directive.type).toStrictEqual(new ElementTemplate(type));
      expect(directive.value).toStrictEqual([
        new DirectiveSpecifier(ElementDirective, props),
        new DirectiveSpecifier(BlackholePrimitive, undefined),
      ]);
    });
  });
});

describe('VFragment', () => {
  describe('[$toDirective]()', () => {
    it('returns a directive with the repeat directive', () => {
      const children = [new VElement('foo', {}), 'bar'];
      const element = new VFragment(children);
      const directive = element[$toDirective]();

      expect(directive.type).toBe(RepeatDirective);
      expect(directive.value).toStrictEqual(
        expect.objectContaining({
          source: children,
        }),
      );
    });
  });
});

describe('VStaticFragment', () => {
  describe('[$toDirective]()', () => {
    it('returns a directive with the fragment template', () => {
      const component = () => {};
      const children = [
        new VElement(component, {}),
        new VElement('div', { children: 'foo' }),
        new VElement('div', { children: ['foo'] }),
        new MockBindable({ type: MockPrimitive, value: 'foo' }),
        ['foo', 'bar'],
        null,
        false,
        'foo',
      ] as const;
      const element = new VStaticFragment(children);
      const directive = element[$toDirective]();

      expect(directive.type).toStrictEqual(
        new FragmentTemplate([
          new ChildNodeTemplate(),
          new ElementTemplate('div'),
          new ElementTemplate('div'),
          new ChildNodeTemplate(),
          new ChildNodeTemplate(),
          new EmptyTemplate(),
          new EmptyTemplate(),
          new TextTemplate(),
        ]),
      );
      expect(directive.value).toStrictEqual([
        children[0],
        new DirectiveSpecifier(ElementDirective, children[1].props),
        new DirectiveSpecifier(new TextTemplate(), [
          children[1].props.children,
        ]),
        new DirectiveSpecifier(ElementDirective, children[2].props),
        new VFragment(children[2].props.children),
        children[3],
        new VFragment(children[4]),
        children[7],
      ]);
    });
  });
});

describe('ElementDirective', () => {
  describe('displayName', () => {
    it('is a string that represents the primitive itself', () => {
      expect(ElementDirective.displayName, 'ElementDirective');
    });
  });

  describe('resolveBinding()', () => {
    it('constructs a new ElementBinding', () => {
      const props = { className: 'foo' };
      const part = {
        type: PartType.Element,
        node: document.createElement('div'),
      };
      const runtime = new Runtime(new MockRenderHost());
      const binding = ElementDirective.resolveBinding(props, part, runtime);

      expect(binding.type).toBe(ElementDirective);
      expect(binding.value).toBe(props);
      expect(binding.part).toBe(part);
    });

    it('should throw the error if the part is not an element part', () => {
      const props = { className: 'foo' };
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const runtime = new Runtime(new MockRenderHost());

      expect(() =>
        ElementDirective.resolveBinding(props, part, runtime),
      ).toThrow('ElementDirective must be used in an element part,');
    });
  });
});

describe('ElementBinding', () => {
  describe('shouldBind', () => {
    it('returns true if the committed value does not exist', () => {
      const props = { className: 'foo' };
      const part = {
        type: PartType.Element,
        node: document.createElement('div'),
      };
      const binding = new ElementBinding(props, part);

      expect(binding.shouldBind(props)).toBe(true);
    });

    it('returns true if the committed value is different from the new one', () => {
      const props1 = { className: 'foo' };
      const props2 = { className: 'bar' };
      const part = {
        type: PartType.Element,
        node: document.createElement('div'),
      };
      const binding = new ElementBinding(props1, part);
      const runtime = new Runtime(new MockRenderHost());

      binding.connect(runtime);
      binding.commit(runtime);

      expect(binding.shouldBind(props1)).toBe(false);
      expect(binding.shouldBind(props2)).toBe(true);
    });
  });

  describe('commit()', () => {
    it('ignores reserved properties', () => {
      const value = { key: 'foo', children: [] };
      const part = {
        type: PartType.Element,
        node: document.createElement('div'),
      };
      const binding = new ElementBinding(value, part);
      const runtime = new Runtime(new MockRenderHost());

      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.outerHTML).toBe('<div></div>');

      binding.disconnect(runtime);
      binding.rollback(runtime);

      expect(part.node.outerHTML).toBe('<div></div>');
    });

    it('updates "className" property', () => {
      const props1 = { className: 'foo' };
      const props2 = { className: null };
      const part = {
        type: PartType.Element,
        node: document.createElement('div'),
      };
      const binding = new ElementBinding(props1, part);
      const runtime = new Runtime(new MockRenderHost());

      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.outerHTML).toBe('<div class="foo"></div>');

      binding.bind(props2);
      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.outerHTML).toBe('<div class=""></div>');

      binding.disconnect(runtime);
      binding.rollback(runtime);

      expect(part.node.outerHTML).toBe('<div class=""></div>');
    });

    it('updates "innerHTML" property', () => {
      const props1 = { innerHTML: '<span>foo</span>' };
      const props2 = { innerHTML: null };
      const part = {
        type: PartType.Element,
        node: document.createElement('div'),
      };
      const binding = new ElementBinding(props1, part);
      const runtime = new Runtime(new MockRenderHost());

      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.outerHTML).toBe('<div><span>foo</span></div>');

      binding.bind(props2);
      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.outerHTML).toBe('<div></div>');

      binding.disconnect(runtime);
      binding.rollback(runtime);

      expect(part.node.outerHTML).toBe('<div></div>');
    });

    it('updates "textContent" property', () => {
      const props1 = { textContent: '<span>foo</span>' };
      const props2 = { textContent: null };
      const part = {
        type: PartType.Element,
        node: document.createElement('div'),
      };
      const binding = new ElementBinding(props1, part);
      const runtime = new Runtime(new MockRenderHost());

      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.outerHTML).toBe(
        '<div>&lt;span&gt;foo&lt;/span&gt;</div>',
      );

      binding.bind(props2);
      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.outerHTML).toBe('<div></div>');

      binding.disconnect(runtime);
      binding.rollback(runtime);

      expect(part.node.outerHTML).toBe('<div></div>');
    });

    it('updates "checked" property of the input element', () => {
      const props1 = { checked: true, defaultChecked: false };
      const props2 = { checked: null, defaultChecked: undefined };
      const part = {
        type: PartType.Element,
        node: document.createElement('input'),
      };
      const binding = new ElementBinding(props1, part);
      const runtime = new Runtime(new MockRenderHost());

      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.defaultChecked).toBe(false);
      expect(part.node.checked).toBe(true);

      binding.bind(props2);
      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.defaultChecked).toBe(false);
      expect(part.node.checked).toBe(false);

      binding.disconnect(runtime);
      binding.rollback(runtime);

      expect(part.node.defaultChecked).toBe(false);
      expect(part.node.checked).toBe(false);
    });

    it.each([['input'], ['output'], ['textarea']] as const)(
      'updates "value" property of form control elements',
      (name) => {
        const props1 = { value: 'foo', defaultValue: 'bar' };
        const props2 = { value: null, defaultValue: undefined };
        const part = {
          type: PartType.Element,
          node: document.createElement(name),
        };
        const binding = new ElementBinding(props1, part);
        const runtime = new Runtime(new MockRenderHost());

        binding.connect(runtime);
        binding.commit(runtime);

        expect(part.node.value).toBe(props1.value);
        expect(part.node.defaultValue).toBe(props1.defaultValue);

        binding.bind(props2);
        binding.connect(runtime);
        binding.commit(runtime);

        expect(part.node.value).toBe('');
        expect(part.node.defaultValue).toBe('');

        binding.disconnect(runtime);
        binding.rollback(runtime);

        expect(part.node.value).toBe('');
        expect(part.node.defaultValue).toBe('');
      },
    );

    it('updates "value" property of select element', () => {
      const props1 = { value: 'foo' };
      const props2 = { value: null };
      const part = {
        type: PartType.Element,
        node: createDOMElement(
          'select',
          {},
          createDOMElement('option', { value: 'foo' }, 'foo'),
        ),
      };
      const binding = new ElementBinding(props1, part);
      const runtime = new Runtime(new MockRenderHost());

      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.value).toBe(props1.value);

      binding.bind(props2);
      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.value).toBe('');

      binding.disconnect(runtime);
      binding.rollback(runtime);

      expect(part.node.value).toBe('');
    });

    it('updates "htmlFor" property of the label element', () => {
      const props1 = { htmlFor: 'foo' };
      const props2 = { htmlFor: null };
      const part = {
        type: PartType.Element,
        node: document.createElement('label'),
      };
      const binding = new ElementBinding(props1, part);
      const runtime = new Runtime(new MockRenderHost());

      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.htmlFor).toBe(props1.htmlFor);

      binding.bind(props2);
      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.htmlFor).toBe('');

      binding.disconnect(runtime);
      binding.rollback(runtime);

      expect(part.node.htmlFor).toBe('');
    });

    it('invokes the ref callback if it has been changed', () => {
      const cleanup1 = vi.fn();
      const cleanup2 = vi.fn();
      const props1 = { ref: vi.fn(() => cleanup1) };
      const props2 = { ref: vi.fn(() => cleanup2) };
      const part = {
        type: PartType.Element,
        node: document.createElement('label'),
      };
      const binding = new ElementBinding(props1, part);
      const runtime = new Runtime(new MockRenderHost());

      binding.connect(runtime);
      binding.commit(runtime);

      binding.connect(runtime);
      binding.commit(runtime);

      expect(props1.ref).toHaveBeenCalledOnce();
      expect(props2.ref).not.toHaveBeenCalled();
      expect(cleanup1).not.toHaveBeenCalled();
      expect(cleanup2).not.toHaveBeenCalled();

      binding.bind(props2);
      binding.connect(runtime);
      binding.commit(runtime);

      expect(props1.ref).toHaveBeenCalledOnce();
      expect(props2.ref).toHaveBeenCalledOnce();
      expect(cleanup1).toHaveBeenCalledOnce();
      expect(cleanup2).not.toHaveBeenCalled();

      binding.disconnect(runtime);
      binding.rollback(runtime);

      expect(props1.ref).toHaveBeenCalledOnce();
      expect(props2.ref).toHaveBeenCalledOnce();
      expect(cleanup1).toHaveBeenCalledOnce();
      expect(cleanup2).toHaveBeenCalledOnce();
    });

    it('sets the current value to the ref object', () => {
      const props1 = { ref: { current: null } };
      const props2 = { ref: { current: null } };
      const part = {
        type: PartType.Element,
        node: document.createElement('label'),
      };
      const binding = new ElementBinding(props1, part);
      const runtime = new Runtime(new MockRenderHost());

      binding.connect(runtime);
      binding.commit(runtime);

      expect(props1.ref.current).toBe(part.node);
      expect(props2.ref.current).toBe(null);

      binding.bind(props2);
      binding.connect(runtime);
      binding.commit(runtime);

      expect(props1.ref.current).toBe(null);
      expect(props2.ref.current).toBe(part.node);

      binding.disconnect(runtime);
      binding.rollback(runtime);

      expect(props1.ref.current).toBe(null);
      expect(props2.ref.current).toBe(null);
    });

    it('updates styles by the object', () => {
      const props1 = { style: { color: 'red', backgroundColor: 'white' } };
      const props2 = { style: { color: 'black', border: '1px solid black' } };
      const props3 = { style: null };
      const part = {
        type: PartType.Element,
        node: document.createElement('label'),
      };
      const binding = new ElementBinding(props1, part);
      const runtime = new Runtime(new MockRenderHost());

      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.style.cssText).toBe(
        'color: red; background-color: white;',
      );

      binding.bind(props2);
      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.style.cssText).toBe(
        'color: black; border: 1px solid black;',
      );

      binding.bind(props3);
      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.style.cssText).toBe('');

      binding.disconnect(runtime);
      binding.rollback(runtime);

      expect(part.node.style.cssText).toBe('');
    });

    it('throws an error if "style" property is not an object', () => {
      const props = { style: 'color: red; background-color: white;' };
      const part = {
        type: PartType.Element,
        node: document.createElement('label'),
      };
      const binding = new ElementBinding(props, part);
      const runtime = new Runtime(new MockRenderHost());

      expect(() => {
        binding.connect(runtime);
        binding.commit(runtime);
      }).toThrow('The "style" property expects a object, not a string.');
    });

    it('adds event listener functions', () => {
      const props1 = { onClick: vi.fn() };
      const props2 = { onClick: vi.fn() };
      const event1 = new MouseEvent('click');
      const event2 = new MouseEvent('click');
      const part = {
        type: PartType.Element,
        node: document.createElement('label'),
      };
      const binding = new ElementBinding(props1, part);
      const runtime = new Runtime(new MockRenderHost());

      const addEventListenerSpy = vi.spyOn(part.node, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(part.node, 'removeEventListener');

      binding.connect(runtime);
      binding.commit(runtime);

      binding.bind(props2);
      binding.connect(runtime);
      binding.commit(runtime);

      part.node.dispatchEvent(event1);

      expect(addEventListenerSpy).toHaveBeenCalledOnce();
      expect(addEventListenerSpy).toHaveBeenCalledWith('click', binding);
      expect(removeEventListenerSpy).not.toHaveBeenCalled();
      expect(props1.onClick).not.toHaveBeenCalled();
      expect(props2.onClick).toHaveBeenCalledOnce();
      expect(props2.onClick).toHaveBeenCalledWith(event1);

      binding.disconnect(runtime);
      binding.rollback(runtime);

      part.node.dispatchEvent(event2);

      expect(addEventListenerSpy).toHaveBeenCalledOnce();
      expect(removeEventListenerSpy).toHaveBeenCalled();
      expect(removeEventListenerSpy).toHaveBeenCalledWith('click', binding);
      expect(props1.onClick).not.toHaveBeenCalled();
      expect(props2.onClick).toHaveBeenCalledOnce();
    });

    it('adds event listener objects', () => {
      const props1 = { onClick: { handleEvent: vi.fn() } };
      const props2 = { onClick: { handleEvent: vi.fn() } };
      const event1 = new MouseEvent('click');
      const event2 = new MouseEvent('click');
      const part = {
        type: PartType.Element,
        node: document.createElement('label'),
      };
      const binding = new ElementBinding(props1, part);
      const runtime = new Runtime(new MockRenderHost());

      const addEventListenerSpy = vi.spyOn(part.node, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(part.node, 'removeEventListener');

      binding.connect(runtime);
      binding.commit(runtime);

      binding.bind(props2);
      binding.connect(runtime);
      binding.commit(runtime);

      part.node.dispatchEvent(event1);

      expect(addEventListenerSpy).toHaveBeenCalledTimes(2);
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'click',
        binding,
        props1.onClick,
      );
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'click',
        binding,
        props2.onClick,
      );
      expect(removeEventListenerSpy).toHaveBeenCalledTimes(1);
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'click',
        binding,
        props1.onClick,
      );
      expect(props1.onClick.handleEvent).not.toHaveBeenCalled();
      expect(props2.onClick.handleEvent).toHaveBeenCalledOnce();
      expect(props2.onClick.handleEvent).toHaveBeenCalledWith(event1);

      binding.disconnect(runtime);
      binding.rollback(runtime);

      part.node.dispatchEvent(event2);

      expect(addEventListenerSpy).toHaveBeenCalledTimes(2);
      expect(removeEventListenerSpy).toHaveBeenCalledTimes(2);
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'click',
        binding,
        props2.onClick,
      );
      expect(props1.onClick.handleEvent).not.toHaveBeenCalled();
      expect(props2.onClick.handleEvent).toHaveBeenCalledOnce();
    });

    it('sets other properties as attributes', () => {
      const props1 = {
        checked: 'checked',
        defaultChecked: 'defaultChecked',
        defaultValue: 'defaultValue',
        htmlFor: 'htmlFor',
        title: 'title',
        value: 'value',
      };
      const props2 = {
        defaultValue: undefined,
        title: 'title',
        value: null,
      };
      const part = {
        type: PartType.Element,
        node: document.createElement('div'),
      };
      const binding = new ElementBinding(props1, part);
      const runtime = new Runtime(new MockRenderHost());

      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.outerHTML).toBe(
        '<div checked="checked" defaultchecked="defaultChecked" defaultvalue="defaultValue" htmlfor="htmlFor" title="title" value="value"></div>',
      );

      binding.bind(props2);
      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.outerHTML).toBe('<div title="title"></div>');

      binding.disconnect(runtime);
      binding.rollback(runtime);

      expect(part.node.outerHTML).toBe('<div></div>');
    });
  });
});
