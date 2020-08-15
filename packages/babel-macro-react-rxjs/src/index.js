const { createMacro } = require('babel-plugin-macros')
const { default: template } = require('@babel/template');

const buildTagWrapper = template(`
  IMPORTED.addDebugTag(NAME, ID)(EXPRESSION)
`);

const packageName = "@react-rxjs/core";

module.exports = createMacro(myMacro)

function myMacro({ references, state, babel: { types: t } }) {
  /** Change import to @react/core
   * babel-plugin-macros by default removes the /macro import.
   * We could tell to not remove it by returning some config... but I'm not
   * sure how to make it work in runtime.
   */
  const imports = Object.keys(references);
  const getLocalName = reference => reference[0].node.name;

  const coreImportDeclaration = t.importDeclaration(imports.map(
    methodName => t.importSpecifier(
      t.identifier(getLocalName(references[methodName])),
      t.identifier(methodName)
    )
  ), t.stringLiteral(packageName));
  state.file.path.unshiftContainer('body', coreImportDeclaration);

  /** Add import so we can use rxjs-traces */
  const rxjsTracesIdentifier = t.identifier('autoRxjsTraces');
  const tracesImportDeclaration = t.importDeclaration([
    t.importNamespaceSpecifier(rxjsTracesIdentifier)
  ], t.stringLiteral('rxjs-traces'));
  state.file.path.unshiftContainer('body', tracesImportDeclaration);

  references.bind.forEach(ref => {
    const callExpression = ref.parentPath; // Assuming consumers won't reassign

    const tagName = getNameFromAssignmentId(t, callExpression.parent.id);
    const firstArgument = callExpression.get('arguments.0');
    const firstParameterNode = firstArgument.node;
    firstArgument.replaceWith(buildTagWrapper({
      IMPORTED: rxjsTracesIdentifier,
      NAME: t.stringLiteral(tagName),
      ID: t.stringLiteral(tagName),
      EXPRESSION: firstParameterNode
    }));
  })
}

function getNameFromAssignmentId(t, idNode) {
  if (t.isArrayPattern(idNode)) {
    if (idNode.elements.length >= 2) {
      return idNode.elements[1].name;
    }
    return idNode.elements[0].name;
  }
}