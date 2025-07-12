import type { RenderContext } from '@emonkak/ebit';

export interface TodoInputProps {
  defaultValue?: string;
  label: string;
  onBlur?: (() => void) | null;
  onSubmit?: ((title: string) => void) | null;
  placeholder?: string;
}

export function TodoInput(
  {
    defaultValue = '',
    label,
    onBlur = null,
    onSubmit = null,
    placeholder,
  }: TodoInputProps,
  context: RenderContext,
): unknown {
  const inputRef = context.useRef<HTMLInputElement | null>(null);

  context.useEffect(() => {
    const element = inputRef.current;
    if (element !== null) {
      element.value = defaultValue;
      element.setSelectionRange(defaultValue.length, defaultValue.length);
      element.focus();
    }
  }, []);

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && !event.isComposing) {
      const target = event.currentTarget as HTMLInputElement;
      const value = target.value.trim();
      if (value !== '') {
        target.value = '';
        onSubmit?.(value);
      }
    }
  };

  return context.html`
    <div class="input-container">
      <input
        :ref=${inputRef}
        class="new-todo"
        data-testid="text-input"
        id="todo-input"
        minlength="2"
        placeholder=${placeholder}
        type="text"
        value=${defaultValue}
        @blur=${onBlur}
        @keydown=${handleKeyDown}
      >
      <label class="visually-hidden" for="todo-input">
        ${label}
      </label>
    </div>
  `;
}
