import {
  component,
  createBrowserRoot,
  Literal,
  type RenderContext,
} from '@emonkak/ebit';
import { list } from '@emonkak/ebit/extensions/list.js';
import { Atom, type Signal } from '@emonkak/ebit/extensions/signal.js';

const counter$ = new Atom(0);

const $env = Symbol('$env');

function App(_props: {}, context: RenderContext) {
  const [items, setItems] = context.useState([
    'foo',
    'bar',
    'baz',
    'qux',
    'quux',
  ]);

  context.setContextValue($env, 'Env');

  const itemsList = context.useMemo(
    () =>
      list({
        source: items,
        keySelector: (item) => item,
        valueSelector: (item, index) =>
          component(Item, {
            title: item,
            onUp: () => {
              if (index > 0) {
                const newItems = items.slice();
                const tmp = newItems[index]!;
                newItems[index] = newItems[index - 1]!;
                newItems[index - 1] = tmp;
                setItems(newItems);
              }
            },
            onDown: () => {
              if (index + 1 < items.length) {
                const newItems = items.slice();
                const tmp = newItems[index]!;
                newItems[index] = newItems[index + 1]!;
                newItems[index + 1] = tmp;
                setItems(newItems);
              }
            },
            onDelete: () => {
              const newItems = items.slice();
              newItems.splice(index, 1);
              setItems(newItems);
            },
          }),
      }),
    [items],
  );

  const onIncrement = context.useCallback(() => {
    counter$.value += 1;
  }, []);
  const onDecrement = context.useCallback(() => {
    counter$.value -= 1;
  }, []);
  const onShuffle = context.useCallback(() => {
    const newItems = shuffle(items.slice());
    setItems(newItems);
  }, []);

  return context.html`
    <div ${{ class: 'root' }}>
      <${component(Counter, { count$: counter$ })} />
      <p>COUNT by Signal: <strong>${counter$}</strong></p>
      <ul><${itemsList}></ul>
      <p>
        <button type="button" @click=${onIncrement}>+1</button>
        <button type="button" @click=${onDecrement}>-1</button>
        <button type="button" @click=${onShuffle}>Shuffle</button>
      </p>
      <${context.html`<div>Hello World!</div>`} />
      <div .innerHTML=${'<div style="color: red">Hello World!</div>'}></div>
    </div>
    <svg width="100" height="100" viewBox="0 0 100 100">
      <${component(Circle, { cx: 50, cy: 50, r: 50, fill: 'red' })}>
    </svg>
  `;
}

interface CircleProps {
  cx: number;
  cy: number;
  r: number;
  fill: string;
}

function Circle({ cx, cy, r, fill }: CircleProps, context: RenderContext) {
  return context.svg`
    <circle cx=${cx} cy=${cy} r=${r} fill=${fill} />
  `;
}

interface ItemProps {
  title: string;
  onUp: () => void;
  onDown: () => void;
  onDelete: () => void;
}

function Item(
  { title, onUp, onDown, onDelete }: ItemProps,
  context: RenderContext,
) {
  const env = context.getContextValue($env);

  return context.html`
    <li>
      <span>${title} (${env})</span>
      <button type="button" @click=${onUp}>Up</button>
      <button type="button" @click=${onDown}>Down</button>
      <button type="button" @click=${onDelete}>Delete</button>
    </li>
  `;
}

interface CounterProps {
  count$: Signal<number>;
}

function Counter({ count$ }: CounterProps, context: RenderContext): unknown {
  const countLabelRef = context.useRef<Element | null>(null);

  const count = context.use(count$);
  const tag = new Literal(count % 2 === 0 ? 'strong' : 'em');

  return context.html`
    <h1>
      <span class="count-label" :ref=${countLabelRef}>COUNT: </span>
      <span
        :classmap=${{
          'count-value': true,
          'is-odd': count % 2 !== 0,
          'is-even': count % 2 === 0,
        }}
        data-count=${count}>${count}</span>
      <${context.dynamicHTML`
        <${tag} :style=${{ color: 'blue' }}>Hello, World!</${tag}>
      `}/>
    </h1>
  `;
}

function shuffle<T>(elements: T[]): T[] {
  let currentIndex = elements.length;

  while (currentIndex > 0) {
    const randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    const tmp = elements[currentIndex]!;
    elements[currentIndex] = elements[randomIndex]!;
    elements[randomIndex] = tmp;
  }

  return elements;
}

const root = createBrowserRoot(component(App, {}), document.body);

root.mount();
