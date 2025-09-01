// tools/esbuild-plugin-minify-templates/test/fixtures/nested-templates.js
function Greet(props) {
  return html`<div>${html`<p>${props.greet}, <span>${props.name}</span>!</p>`}</div>`;
}
export {
  Greet
};
