import {
  BrowserBackend,
  createComponent,
  type RenderContext,
  Repeat,
  Root,
  Runtime,
  shallowEqual,
} from 'barebind';
import { ConsoleReporter, PerformanceProfiler } from 'barebind/addons/profiler';
import { Atom, type Signal } from 'barebind/addons/signal';
import type { VElement } from 'barebind/addons/vdom';

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

const App = createComponent(function App(_props: {}, $: RenderContext) {
  const count$ = $.useMemo(() => new Atom(0), []);

  const [state, setState] = $.useState({
    items: ITEM_LABELS.slice(0, 4),
    resevedItems: ITEM_LABELS.slice(4),
  });

  $.setSharedContext(
    ENV_CONTEXT,
    `${state.items.length} item(s) are available`,
  );

  const handleIncrement = $.useCallback(() => {
    count$.value += 1;
  }, []);
  const handleDecrement = $.useCallback(() => {
    count$.value -= 1;
  }, []);
  const handleAdd = $.useCallback(() => {
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
  const handleUp = $.useCallback(
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
  const handleDown = $.useCallback(
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
  const handleDelete = $.useCallback((index: number) => {
    setState((state) => {
      const items = state.items.slice();
      const deletedItems = items.splice(index, 1);
      return {
        items,
        resevedItems: deletedItems.concat(state.resevedItems),
      };
    });
  }, []);
  const handleShuffle = $.useCallback(() => {
    setState((state) => {
      const items = shuffle(state.items.slice());
      return { ...state, items };
    });
  }, []);

  return $.html`
    <div ${{ class: 'root' }}>
      <${Dashboard({ count$ })}>
      <nav>
        <button type="button" @click=${handleIncrement}>+1</button>
        <button type="button" @click=${handleDecrement}>-1</button>
        <button type="button" disabled=${state.items.length >= ITEM_LABELS.length} @click=${handleAdd}>Add</button>
        <button type="button" @click=${handleShuffle}>Shuffle</button>
      </nav>
      <${List({
        items: state.items,
        onUp: handleUp,
        onDown: handleDown,
        onDelete: handleDelete,
      })}>
      <${TemplateCounter({})}>
      <${VDOMCounter({})}>
      <${VDOMSVG({})}>
      <div>
        <h1>Text</h1>
        <${$.text`This is a <plain> text.`}>
      </div>
      <div class="SVGCounter">
        <h1>SVG Counter</h1>
        <svg width="100" height="100" viewBox="0 0 100 100">
          <${SVGCounter({ cx: 50, cy: 50, r: 50, fill: 'red', text$: count$.map((count) => count.toString()) })}>
        </svg>
      </div>
    </div>
  `;
});

interface DashboardProps {
  count$: Signal<number>;
}

const Dashboard = createComponent(function Dashboard(
  { count$ }: DashboardProps,
  $: RenderContext,
): unknown {
  const env = $.getSharedContext(ENV_CONTEXT);
  const countElementRef = $.useRef<Element | null>(null);
  const count = $.use(count$);

  const greetTag = count$.value % 2 === 0 ? 'span' : 'em';

  return $.html`
    <div
      :class=${{
        _: 'Dashboard',
        'is-odd': count % 2 !== 0,
        'is-even': count % 2 === 0,
      }}
      :ref=${countElementRef}
      data-count=${count}
    >
      <h1 .innerHTML=${`<${greetTag} style="color: red">Hello, World!</${greetTag}>`}></h1>
      <ul>
        <li>Env: ${env}</li>
        <li>Count: ${count}</li>
      </ul>
    </div>
  `;
});

interface ListProps {
  items: string[];
  onDelete: (index: number) => void;
  onDown: (index: number, isFirst: boolean, isLast: boolean) => void;
  onUp: (index: number, isFirst: boolean, isLast: boolean) => void;
}

const List = createComponent(
  function List(
    { items, onUp, onDown, onDelete }: ListProps,
    $: RenderContext,
  ): unknown {
    const itemsList = Repeat({
      source: items,
      keySelector: (item) => item,
      valueSelector: (item, index) =>
        Item({
          index,
          isFirst: index === 0,
          isLast: index + 1 === items.length,
          label: item,
          onUp,
          onDown,
          onDelete,
        }),
    });

    return $.html`
      <div class="List">
        <h1>List</h1>
        <ol>
          <${itemsList}>
        </ol>
      </div>
    `;
  },
  { arePropsEqual: shallowEqual },
);

interface ItemProps {
  index: number;
  isFirst: boolean;
  isLast: boolean;
  label: string;
  onDelete: (index: number) => void;
  onDown: (index: number, isFirst: boolean, isLast: boolean) => void;
  onUp: (index: number, isFirst: boolean, isLast: boolean) => void;
}

const Item = createComponent(
  function Item(
    { isFirst, isLast, index, label, onUp, onDown, onDelete }: ItemProps,
    $: RenderContext,
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

    return $.html`
      <li>
        <button type="button" disabled=${isFirst} @click=${handleUp}>↑</button>
        <button type="button" disabled=${isLast} @click=${handleDown}>↓</button>
        <button type="button" @click=${handleDelete}>Delete</button>
        <span>${label}</span>
      </li>
    `;
  },
  { arePropsEqual: shallowEqual },
);

const TemplateCounter = createComponent(function TemplateCounter(
  _props: {},
  $: RenderContext,
): unknown {
  const [count, setCount] = $.useState(0);

  const handleIncrement = $.useCallback(() => {
    setCount((count) => count + 1);
  }, []);

  return $.html`
    <div class="TemplateCounter">
      <h1>Tempalte Counter</h1>
      <button type="button" @click=${handleIncrement}>${count}</button>
    </div>
  `;
});

const VDOMCounter = createComponent(function VDOMCounter(
  _props: {},
  $: RenderContext,
): VElement {
  const [count, setCount] = $.useState(0);

  const handleIncrement = $.useCallback(() => {
    setCount((count) => count + 1);
  }, []);
  const handleDecrement = $.useCallback(() => {
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
});

const VDOMSVG = createComponent(function VDOMSVG(_props: {}): VElement {
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
});

interface SVGCounterProps {
  cx: number;
  cy: number;
  r: number;
  fill: string;
  text$: Signal<string>;
}

const SVGCounter = createComponent(function SVGCounter(
  { cx, cy, r, fill, text$ }: SVGCounterProps,
  $: RenderContext,
): unknown {
  return $.svg`
    <circle cx=${cx} cy=${cy} r=${r} fill=${fill} />
    <text x=${cx} y=${cy} fill="white" dominant-baseline="middle" text-anchor="middle">${text$}</text>
  `;
});

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

const runtime = new Runtime(new BrowserBackend());
const root = Root.create(App({}), document.body, runtime);

runtime.addObserver(new PerformanceProfiler(new ConsoleReporter()));

root.mount();
