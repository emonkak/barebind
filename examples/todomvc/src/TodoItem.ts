import { createComponent, type RenderContext, shallowEqual } from 'barebind';

import { type Todo, TodoState } from './state.js';
import { TodoInput } from './TodoInput.js';

export interface TodoItemProps {
  todo: Todo;
}

export const TodoItem = createComponent(
  function TodoItem({ todo }: TodoItemProps, $: RenderContext): unknown {
    const [isEditing, setIsEditing] = $.useState(false);
    const todoState$ = $.use(TodoState);

    const handleStartEditing = () => {
      setIsEditing(true);
    };

    const handleEndEditing = () => {
      setIsEditing(false);
    };

    const handleUpdate = (title: string) => {
      todoState$.mutate((todoState) => {
        if (title.length === 0) {
          todoState.removeTodo(todo.id);
        } else {
          todoState.updateTodo(todo.id, title);
        }
      });
      setIsEditing(false);
    };

    const handleToggleItem = () => {
      todoState$.mutate((todoState) => {
        todoState.toggleTodo(todo.id);
      });
    };

    const handleRemoveItem = () => {
      todoState$.mutate((todoState) => {
        todoState.removeTodo(todo.id);
      });
    };

    return $.html`
      <li
        :class=${{ completed: todo.completed }}
        data-testid="todo-item">
        <div class="view">
          <${
            isEditing
              ? TodoInput({
                  label: 'Edit Todo Input',
                  onSubmit: handleUpdate,
                  onBlur: handleEndEditing,
                  defaultValue: todo.title,
                })
              : $.html`
                <input
                  type="checkbox"
                  class="toggle"
                  data-testid="todo-item-toggle"
                  .checked=${todo.completed}
                  @change=${handleToggleItem}
                >
                <label
                  data-testid="todo-item-label"
                  @dblclick=${handleStartEditing}
                >
                  ${todo.title}
                </label>
                <button
                  type="button"
                  class="destroy"
                  data-testid="todo-item-button"
                  @click=${handleRemoveItem}
                >
              `
          }>
        </div>
      </li>
    `;
  },
  { arePropsEqual: shallowEqual },
);
