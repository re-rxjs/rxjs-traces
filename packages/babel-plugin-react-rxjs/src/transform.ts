import * as Babel from "@babel/core"
import template from "@babel/template"
import { assertType } from "./util"
import { NodePath } from "@babel/core"

const buildTagWrapper = template(`
  IMPORTED.wrapReactRxjs(EXPRESSION, NAME)
`) as (args: any) => Babel.types.ExpressionStatement

function getNameFromAssignmentId(
  t: typeof Babel.types,
  idNode: Babel.types.LVal,
) {
  if (t.isArrayPattern(idNode)) {
    if (idNode.elements.length >= 2) {
      return assertType(t.isIdentifier, idNode.elements[1])?.name
    }
    return assertType(t.isIdentifier, idNode.elements[0])?.name
  }
  return null
}

export function transformCallExpression(
  t: typeof Babel.types,
  path: NodePath<Babel.types.CallExpression>,
  importIdentifier: Babel.types.Identifier,
) {
  const parent = assertType(t.isVariableDeclarator, path.parent)
  const tagName = parent && getNameFromAssignmentId(t, parent.id)
  if (!tagName) {
    return
  }

  const firstParameter = path.get("arguments.0") as NodePath
  const replacement = buildTagWrapper({
    IMPORTED: importIdentifier,
    NAME: t.stringLiteral(tagName),
    EXPRESSION: firstParameter.node,
  })
  firstParameter.replaceWith(replacement)
}
