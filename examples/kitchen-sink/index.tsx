import {
  AsyncRoot,
  BrowserBackend,
  component,
  Literal,
  memo,
  type RenderContext,
  repeat,
} from '@emonkak/ebit';
import {
  ConsoleReporter,
  PerformanceProfiler,
} from '@emonkak/ebit/extensions/profiler';
import { Atom, type Signal } from '@emonkak/ebit/extensions/signal';
import type { VElement } from '@emonkak/ebit/extensions/vdom';

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

  const handleIncrement = context.useCallback(() => {
    count$.value += 1;
  }, []);
  const handleDecrement = context.useCallback(() => {
    count$.value -= 1;
  }, []);
  const handleAdd = context.useCallback(() => {
    setState((state) => {
      if (state.resevedItems.length > 0) {
        const items = state.items.concat([state.resevedItems[0]!]);
        return {
          items,
          resevedItems: state.resevedItems.slice(1),
        };
      } else {
        return state;
      }
    });
  }, []);
  const handleUp = context.useCallback(
    (index: number, isFirst: boolean, _isLast: boolean) => {
      if (!isFirst) {
        setState((state) => {
          const items = state.items.slice();
          const tmp = items[index]!;
          items[index] = items[index - 1]!;
          items[index - 1] = tmp;
          return { ...state, items };
        });
      }
    },
    [],
  );
  const handleDown = context.useCallback(
    (index: number, _isFirst: boolean, isLast: boolean) => {
      if (!isLast) {
        setState((state) => {
          const items = state.items.slice();
          const tmp = items[index]!;
          items[index] = items[index + 1]!;
          items[index + 1] = tmp;
          return { ...state, items };
        });
      }
    },
    [],
  );
  const handleDelete = context.useCallback((index: number) => {
    setState((state) => {
      const items = state.items.slice();
      const deletedItems = items.splice(index, 1);
      return {
        items,
        resevedItems: deletedItems.concat(state.resevedItems),
      };
    });
  }, []);
  const handleShuffle = context.useCallback(() => {
    setState((state) => {
      const items = shuffle(state.items.slice());
      return { ...state, items };
    });
  }, []);

  return context.html`
    <div ${{ class: 'root' }}>
      <${component(Dashboard, { count$ })}>
      <nav>
        <button type="button" @click=${handleIncrement}>+1</button>
        <button type="button" @click=${handleDecrement}>-1</button>
        <button type="button" disabled=${state.items.length >= ITEM_LABELS.length} @click=${handleAdd}>Add</button>
        <button type="button" @click=${handleShuffle}>Shuffle</button>
      </nav>
      <${component(List, {
        items: state.items,
        onUp: handleUp,
        onDown: handleDown,
        onDelete: handleDelete,
      })}>
      <${component(TemplateCounter, {})}>
      <${component(VDOMCounter, {})}>
      <${component(VDOMSVG, {})}>
      <div>
        <h1>Text</h1>
        <${context.text`This is a <plain> text.`}>
      </div>
      <div class="SVGCounter">
        <h1>SVG Counter</h1>
        <svg width="100" height="100" viewBox="0 0 100 100">
          <${component(SVGCounter, { cx: 50, cy: 50, r: 50, fill: 'red', text$: count$.map((count) => count.toString()) })}>
        </svg>
      </div>
    </div>
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
      :classlist=${[
        'Dashboard',
        {
          'is-odd': count % 2 !== 0,
          'is-even': count % 2 === 0,
        },
      ]}
      :ref=${countElementRef}
      data-count=${count}
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

interface ListProps {
  items: string[];
  onDelete: (index: number) => void;
  onDown: (index: number, isFirst: boolean, isLast: boolean) => void;
  onUp: (index: number, isFirst: boolean, isLast: boolean) => void;
}

function List(
  { items, onUp, onDown, onDelete }: ListProps,
  context: RenderContext,
): unknown {
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
    <div class="List">
      <h1>List</h1>
      <ol><${itemsList}></ol>
    </div>
  `;
}

interface ItemProps {
  index: number;
  isFirst: boolean;
  isLast: boolean;
  label: string;
  onDelete: (index: number) => void;
  onDown: (index: number, isFirst: boolean, isLast: boolean) => void;
  onUp: (index: number, isFirst: boolean, isLast: boolean) => void;
}

function Item(
  { isFirst, isLast, index, label, onUp, onDown, onDelete }: ItemProps,
  context: RenderContext,
) {
  const handleUp = () => {
    onUp(index, isFirst, isLast);
  };
  const handleDown = () => {
    onDown(index, isFirst, isLast);
  };
  const handleDelete = () => {
    onDelete(index);
  };

  return context.html`
    <li>
      <span>${label}</span>
      <button type="button" disabled=${isFirst} @click=${handleUp}>↑</button>
      <button type="button" disabled=${isLast} @click=${handleDown}>↓</button>
      <button type="button" @click=${handleDelete}>Delete</button>
    </li>
  `;
}

memo(Item);

function TemplateCounter(_props: {}, context: RenderContext): unknown {
  const [count, setCount] = context.useState(0);

  const handleIncrement = context.useCallback(() => {
    setCount((count) => count + 1);
  }, []);

  return context.html`
    <div class="TemplateCounter">
      <h1>Tempalte Counter</h1>
      <button type="button" @click=${handleIncrement}>${count}</button>
    </div>
  `;
}

function VDOMCounter(_props: {}, context: RenderContext): VElement {
  const [count, setCount] = context.useState(0);

  const handleIncrement = context.useCallback(() => {
    setCount((count) => count + 1);
  }, []);
  const handleDecrement = context.useCallback(() => {
    setCount((count) => count - 1);
  }, []);

  return (
    <div class="VDOMCounter">
      <h1>Virtual DOM Counter</h1>
      <nav>
        <button type="button" onclick={handleIncrement}>
          +1
        </button>
        <button type="button" onclick={handleDecrement}>
          -1
        </button>
      </nav>
      <div>Count: {count}</div>
    </div>
  );
}

function VDOMSVG(_props: {}): VElement {
  return (
    <div>
      <h1>Virtual DOM SVG</h1>
      <svg width="100" height="100" viewBox="0 0 100 100">
        <title>Virtual DOM SVG</title>
        <circle cx="50" cy="50" r="50" fill="blue" />
        <text x="50" y="50" dominant-baseline="middle" text-anchor="middle">
          Hello, World!
        </text>
      </svg>
    </div>
  );
}

interface SVGCounterProps {
  cx: number;
  cy: number;
  r: number;
  fill: string;
  text$: Signal<string>;
}

function SVGCounter(
  { cx, cy, r, fill, text$ }: SVGCounterProps,
  context: RenderContext,
): unknown {
  return context.svg`
    <circle cx=${cx} cy=${cy} r=${r} fill=${fill} />
    <text x=${cx} y=${cy} fill="white" dominant-baseline="middle" text-anchor="middle">${text$}</text>
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

const root = AsyncRoot.create(
  component(App, {}),
  document.body,
  new BrowserBackend(),
);

root.observe(new PerformanceProfiler(new ConsoleReporter()));

root.mount();
