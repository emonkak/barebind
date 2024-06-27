import {
  ConcurrentUpdater,
  type RenderingContext,
  RenderingEngine,
  mount,
} from '@emonkak/ebit';
import {
  type TemplateDirective,
  component,
  choice,
  classMap,
  condition,
  list,
  ref,
  styleMap,
  unless,
  unsafeHTML,
  unsafeSVG,
  when,
} from '@emonkak/ebit/directives.js';
import { AtomSignal, type Signal } from '@emonkak/ebit/signal.js';

const counterSignal = new AtomSignal(0);

function App(_props: {}, context: RenderingContext) {
  const [items, setItems] = context.useState([
    'foo',
    'bar',
    'baz',
    'qux',
    'quux',
  ]);

  context.setContextValue('state', 'My Env');

  const itemsList = context.useMemo(
    () =>
      list(
        items,
        (item, index) =>
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
        (item) => item,
      ),
    [items],
  );

  const onIncrement = context.useEvent((_event) => {
    counterSignal.value += 1;
  });
  const onDecrement = context.useEvent((_event) => {
    counterSignal.value -= 1;
  });
  const onShuffle = context.useEvent((_event) => {
    const newItems = shuffle(items.slice());
    setItems(newItems);
  });

  return context.html`
    <div ${{ class: 'root' }}>
      <${component(Counter, { count$: counterSignal })} />
      <p>COUNT by Signal: <strong>${counterSignal}</strong></p>
      <ul><${itemsList}></ul>
      <p>
        <button type="button" @click=${onIncrement}>+1</button>
        <button type="button" @click=${onDecrement}>-1</button>
        <button type="button" @click=${onShuffle}>Shuffle</button>
      </p>
      <${context.html`<div>Hello World!</div>`} />
      <${unsafeHTML('<div style="color: red">Hello World!</div>')} />
      <${context.element(
        'article',
        { style: styleMap({ color: 'blue' }) },
        context.html`<span>Hello World!</span>`,
      )} />
    </div>
    <svg width="100" height="100" viewBox="0 0 100 100"><${component(Circle, {
      cx: 50,
      cy: 50,
      r: 50,
      fill: 'red',
    })} /><${unsafeSVG('<circle cx="10" cy="10" r="10" fill="blue" />')} /></svg>
    <${component(SingleText<string>, { value: 'Hello' })} />
  `;
}

interface CircleProps {
  cx: number;
  cy: number;
  r: number;
  fill: string;
}

function Circle({ cx, cy, r, fill }: CircleProps, context: RenderingContext) {
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
  context: RenderingContext,
) {
  const state = context.getContextValue('state');

  return context.html`
    <li>
      <span>${title} (${state})</span>
      <button type="button" @click=${context.useEvent(onUp)}>Up</button>
      <button type="button" @click=${context.useEvent(onDown)}>Down</button>
      <button type="button" @click=${context.useEvent(onDelete)}>Delete</button>
    </li>
  `;
}

interface CounterProps {
  count$: Signal<number>;
}

function Counter({ count$ }: CounterProps, context: RenderingContext) {
  const countLabelRef = context.useRef<Element | null>(null);

  const count = context.use(count$);

  return context.html`
    <h1>
      <span class="count-label" ref=${ref(countLabelRef)}>COUNT: </span>
      <span
        class=${classMap({
          'count-value': true,
          'is-odd': count % 2 !== 0,
          'is-even': count % 2 === 0,
        })}
        data-count=${count}>${count}</span>
      <span class="count-condition">${condition(
        count % 2 === 0,
        '(Even)',
        '(Odd)',
      )}</span>
      <span class="count-choose">${choice(count % 2, (count) =>
        count === 0 ? '(Even)' : '(Odd)',
      )}</span>
      <span class="count-even">${when(count % 2 === 0, '(Even)')}</span>
      <span class="count-odd">${unless(count % 2 === 0, '(Odd)')}</span>
      <${context.element(
        count % 2 === 0 ? 'strong' : 'em',
        { style: styleMap({ color: 'blue' }) },
        context.html`<span>Hello World!</span>`,
      )} />
    </h1>
  `;
}

function SingleText<T>(
  { value }: { value: T },
  context: RenderingContext,
): TemplateDirective<T, RenderingContext> {
  return context.text(value);
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

const updater = new ConcurrentUpdater(new RenderingEngine());

mount(component(App, {}), document.body, updater);
