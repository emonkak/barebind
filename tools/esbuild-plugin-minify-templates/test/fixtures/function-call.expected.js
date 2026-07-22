// tools/esbuild-plugin-minify-templates/test/fixtures/function-call.js
var Greet = createComponent(function Greet2(props) {
  return html`<div class="greet">${props.greet}, <span>${props.name}</span>!</div>`;
});
export {
  Greet
};
