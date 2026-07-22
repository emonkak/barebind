export const Greet = createComponent(function Greet(props) {
  return this.html`
    <div
      class="greet"
    >
      ${props.greet}, <span>${props.name}</span>!
    </div>
  `;
})
