import { createComponent, html } from 'barebind';

export interface TodoInputProps {
  defaultValue?: string;
  label: string;
  onBlur?: (() => void) | null;
  onSubmit?: ((title: string) => void) | null;
  placeholder?: string;
}

export const TodoInput = createComponent<TodoInputProps>(function TodoInput({
  defaultValue = '',
  label,
  onBlur = null,
  onSubmit = null,
  placeholder,
}) {
  const inputRef = this.useRef<HTMLInputElement | null>(null);

  this.useEffect(() => {
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
      target.value = '';
      onSubmit?.(value);
    }
  };

  return html`
    <div class="input-container">
      <input
        class="new-todo"
        data-testid="text-input"
        id="todo-input"
        minlength="2"
        placeholder=${placeholder}
        type="text"
        value=${defaultValue}
        @blur=${onBlur}
        @keydown=${handleKeyDown}
        ${inputRef}
      >
      <label class="visually-hidden" for="todo-input">
        ${label}
      </label>
    </div>
  `;
});
