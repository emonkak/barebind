// tools/esbuild-plugin-minify-templates/test/fixtures/method-call.js
function Greet(props, context) {
  return context.html`<div class="greet">${props.greet}, <span>${props.name}</span>!</div>`;
}
export {
  Greet
};
