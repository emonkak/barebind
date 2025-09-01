export function Greet(props) {
  return html`
    <div
      class="greet"
    >
      ${props.greet}, <span>${props.name}</span>!
    </div>
  `;
}
