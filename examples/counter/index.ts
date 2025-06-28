import {
  BrowserRenderHost,
  component,
  createAsyncRoot,
  Literal,
  type RenderContext,
} from '@emonkak/ebit';
import { repeat } from '@emonkak/ebit/extensions/repeat.js';
import { Atom, type Signal } from '@emonkak/ebit/extensions/signal.js';

const ENV_CONTEXT = Symbol('ENV_CONTEXT');

const ITEM_LABELS = [
  'foo',
  'bar',
  'baz',
  'qux',
  'quux',
  'corge',
  'grault',
  'garply',
  'waldo',
  'fred',
  'plugh',
  'xyzzy',
  'thud',
];

function App(_props: {}, context: RenderContext) {
  const count$ = context.useMemo(() => new Atom(0), []);

  const [state, setState] = context.useState({
    items: ITEM_LABELS.slice(0, 4),
    resevedItems: ITEM_LABELS.slice(4),
  });

  context.setContextValue(
    ENV_CONTEXT,
    `${state.items.length} item(s) are available`,
  );

  const onIncrement = context.useCallback(() => {
    count$.value += 1;
  }, []);
  const onDecrement = context.useCallback(() => {
    count$.value -= 1;
  }, []);
  const onAdd = context.useCallback(() => {
    if (state.resevedItems.length > 0) {
      const items = state.items.concat([state.resevedItems[0]!]);
      setState({
        items,
        resevedItems: state.resevedItems.slice(1),
      });
    }
  }, [state]);
  const onUp = context.useCallback(
    (index: number) => {
      if (index > 0) {
        const items = state.items.slice();
        const tmp = items[index]!;
        items[index] = items[index - 1]!;
        items[index - 1] = tmp;
        setState((state) => ({ ...state, items }));
      }
    },
    [state],
  );
  const onDown = context.useCallback(
    (index: number) => {
      if (index + 1 < state.items.length) {
        const items = state.items.slice();
        const tmp = items[index]!;
        items[index] = items[index + 1]!;
        items[index + 1] = tmp;
        setState((state) => ({ ...state, items }));
      }
    },
    [state],
  );
  const onDelete = context.useCallback(
    (index: number) => {
      const items = state.items.slice();
      const deletedItems = items.splice(index, 1);
      setState((state) => ({
        items,
        resevedItems: deletedItems.concat(state.resevedItems),
      }));
    },
    [state],
  );
  const onShuffle = context.useCallback(() => {
    const items = shuffle(state.items.slice());
    setState((state) => ({ ...state, items }));
  }, [state]);

  return context.html`
    <div ${{ class: 'root' }}>
      <${component(Dashboard, { count$ })} />
      <div>
        <button type="button" @click=${onIncrement}>+1</button>
        <button type="button" @click=${onDecrement}>-1</button>
        <button type="button" disabled=${state.items.length >= ITEM_LABELS.length} @click=${onAdd}>Add</button>
        <button type="button" @click=${onShuffle}>Shuffle</button>
      </div>
      <${component(List, {
        items: state.items,
        onUp,
        onDown,
        onDelete,
      })}>
    </div>
    <svg width="100" height="100" viewBox="0 0 100 100">
      <${component(Circle, { cx: 50, cy: 50, r: 50, fill: 'red', text$: count$.map((count) => count.toString()) })}>
    </svg>
  `;
}

interface CircleProps {
  cx: number;
  cy: number;
  r: number;
  fill: string;
  text$: Signal<string>;
}

function Circle(
  { cx, cy, r, fill, text$ }: CircleProps,
  context: RenderContext,
) {
  return context.svg`
    <circle cx=${cx} cy=${cy} r=${r} fill=${fill} />
    <text x=${cx} y=${cy} fill="white" dominant-baseline="middle" text-anchor="middle">${text$}</text>
  `;
}

interface ListProps {
  items: string[];
  onDelete: (index: number) => void;
  onDown: (index: number) => void;
  onUp: (index: number) => void;
}

function List(
  { items, onUp, onDown, onDelete }: ListProps,
  context: RenderContext,
) {
  const itemsList = context.useMemo(
    () =>
      repeat({
        source: items,
        keySelector: (item) => item,
        valueSelector: (item, index) =>
          component(Item, {
            index,
            isFirst: index === 0,
            isLast: index + 1 === items.length,
            label: item,
            onUp,
            onDown,
            onDelete,
          }),
      }),
    [items],
  );

  return context.html`
    <ul><${itemsList}></ul>
  `;
}

interface ItemProps {
  index: number;
  isFirst: boolean;
  isLast: boolean;
  label: string;
  onDelete: (index: number) => void;
  onDown: (index: number) => void;
  onUp: (index: number) => void;
}

function Item(
  { isFirst, isLast, index, label, onUp, onDown, onDelete }: ItemProps,
  context: RenderContext,
) {
  const handleUp = context.useCallback(() => {
    onUp(index);
  }, [index, onUp]);
  const handleDown = context.useCallback(() => {
    onDown(index);
  }, [index, onDown]);
  const handleDelete = context.useCallback(() => {
    onDelete(index);
  }, [index, onDelete]);

  return context.html`
    <li>
      <span>${label}</span>
      <button type="button" disabled=${isFirst} @click=${handleUp}>↑</button>
      <button type="button" disabled=${isLast} @click=${handleDown}>↓</button>
      <button type="button" @click=${handleDelete}>Delete</button>
    </li>
  `;
}

interface DashboardProps {
  count$: Signal<number>;
}

function Dashboard(
  { count$ }: DashboardProps,
  context: RenderContext,
): unknown {
  const env = context.getContextValue(ENV_CONTEXT);
  const countElementRef = context.useRef<Element | null>(null);
  const count = context.use(count$);

  const greetTag = new Literal(count$.value % 2 === 0 ? 'span' : 'em');

  return context.html`
    <div
      class="Dashboard"
      data-count=${count}
      :classmap=${{
        'is-odd': count % 2 !== 0,
        'is-even': count % 2 === 0,
      }}
      :ref=${countElementRef}
    >
      <h1>
        <${context.dynamicHTML`
          <${greetTag} :style=${{ color: 'blue' }}>Hello, World!</${greetTag}>
        `}>
      </h1>
      <h1 .innerHTML=${`<${greetTag} style="color: red">Hello, World!</${greetTag}>`}></h1>
      <ul>
        <li>Env: ${env}</li>
        <li>Count: ${count}</li>
      </ul>
    </div>
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

const root = createAsyncRoot(
  component(App, {}),
  document.body,
  new BrowserRenderHost(),
);

root.mount();
