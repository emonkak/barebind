export function Greet(props, context) {
  return context.html`
    <div
      class="greet"
    >
      ${props.greet}, <span>${props.name}</span>!
    </div>
  `;
}
