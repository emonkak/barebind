export const Greet = createComponent(function Greet(props) {
  return Partial.html`
    <div
      class="greet"
    >
      ${props.greet}, <span>${props.name}</span>!
    </div>
  `;
});
