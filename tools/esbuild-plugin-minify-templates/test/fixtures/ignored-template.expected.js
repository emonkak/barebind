// tools/esbuild-plugin-minify-templates/test/fixtures/ignored-template.js
function Greet(props) {
  return (null, html)`
    <div class="greet">
      ${props.greet}, <span>${props.name}</span>!
    </div>
  `;
}
export {
  Greet
};
