const { default: template } = require('@babel/template');

const buildTagWrapper = template(`
  IMPORTED.addDebugTag(NAME, ID)(EXPRESSION)
`);

const packageName = "@react-rxjs/core";
const targetName = "bind";

module.exports = function ({ types: t }) {
  const importIdentifier = t.identifier('autoRxjsTraces');
  const autoImportExpression = t.importDeclaration([
    t.importNamespaceSpecifier(importIdentifier)
  ], t.stringLiteral('rxjs-traces'));

  let autoImportAdded = false;
  const ensureImport = path => {
    if (!autoImportAdded) {
      const program = path.findParent((path) => t.isProgram(path.node));
      program
        .unshiftContainer('body', autoImportExpression);
      autoImportAdded = true;
    }
  }

  const importedTargetNames = [];

  return {
    name: 'react-rxjs',
    visitor: {
      ImportSpecifier(path) {
        if (path.parent.source.value === packageName) {
          if (targetName === path.node.imported.name) {
            importedTargetNames.push(path.node.local.name);
          }
        }
      },
      CallExpression(path) {
        if (importedTargetNames.includes(path.get('callee').node.name)) {
          ensureImport(path);

          const tagName = getNameFromAssignmentId(t, path.parent.id);
          const firstParameter = path.get('arguments.0');
          const firstParameterNode = firstParameter.node;
          firstParameter.replaceWith(buildTagWrapper({
            IMPORTED: importIdentifier,
            NAME: t.stringLiteral(tagName),
            ID: t.stringLiteral(tagName),
            EXPRESSION: firstParameterNode
          }));
        }
      }
    }
  }
}

function getNameFromAssignmentId(t, idNode) {
  if (t.isArrayPattern(idNode)) {
    if (idNode.elements.length >= 2) {
      return idNode.elements[1].name;
    }
    return idNode.elements[0].name;
  }
}