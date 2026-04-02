import { createClientRoot, createIteratorComponent, html } from 'barebind';

interface CountProps {
  initialCount?: number;
}

const Counter = createIteratorComponent<CountProps>(function* Counter({
  initialCount = 0,
}) {
  const ref = { current: null };
  let count = initialCount;

  const increment = () => {
    this.update(() => {
      count++;
    });
  };

  if (initialCount === 100) {
    this.update(() => {
      count++;
    });
  }

  for ({} of this) {
    this.postEffect(() => {
      console.log(count);
    });

    yield html`
      <button type="button" @click=${increment} :ref=${ref}>Count: ${count}</button>
    `;
  }
});

createClientRoot(Counter({ initialCount: 100 }), document.body).mount();
