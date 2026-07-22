// tools/esbuild-plugin-minify-templates/test/fixtures/method-call.js
var Greet = createComponent(function Greet2(props) {
  return Partial.html`<div class="greet">${props.greet}, <span>${props.name}</span>!</div>`;
});
export {
  Greet
};
