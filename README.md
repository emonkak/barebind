# Barebind

![CI Status](https://github.com/emonkak/barebind/actions/workflows/ci.yml/badge.svg)
[![Coverage Status](https://coveralls.io/repos/github/emonkak/barebind/badge.svg)](https://coveralls.io/github/emonkak/barebind)

<img src="logo.svg" alt="Logo" width="200" height="300">

No magic, no custom compiler — just bind data to plain JS templates.

**Barebind** is a reactive UI library built on native JavaScript tagged template literals (<code>html\`...\`</code>). Think React-like component model with hooks, lane-based scheduling, keyed list diffing, portals, fragments, and composable templates — all without JSX or a custom compiler.

## Quick Start

```ts
import {
  createComponent, DOMAdapter, DOMRoot, html, Runtime,
} from 'barebind';

const Counter = createComponent(function Counter(
  { initialCount },
) {
  const [count, setCount] = this.useState(initialCount);

  return html`
    <button type="button" @click=${() => { setCount((c) => c + 1) }}>
      Count: ${count}
    </button>
  `;
});

const runtime = new Runtime(new DOMAdapter());
const root = new DOMRoot(document.body, runtime);
root.render(Counter({ initialCount: 100 }));
```
