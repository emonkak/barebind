// tools/esbuild-plugin-minify-templates/test/fixtures/function-call.js
function Greet(props) {
  return html`<div class="greet">${props.greet}, <span>${props.name}</span>!</div>`;
}
export {
  Greet
};
