import { createComponent, DOMAdapter, DOMRoot, html, Runtime } from 'barebind';

interface CountProps {
  initialCount: number;
}

const Counter = createComponent<CountProps>(function Counter({ initialCount }) {
  const [count, setCount] = this.useState(initialCount);

  const increment = () => {
    setCount((count) => count + 1);
  };

  return html`
    <button
      type="button"
      @click=${increment}
    >
      Count: ${count}
    </button>
  `;
});

const runtime = new Runtime(new DOMAdapter());
const root = new DOMRoot(document.body, runtime);
root.render(Counter({ initialCount: 0 }));
