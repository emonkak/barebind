export function Greet(props) {
  return html`
    <div>
      ${html`
        <p>
          ${props.greet}, <span>${props.name}</span>!
        </p>
      `}
    </div>
  `;
}
