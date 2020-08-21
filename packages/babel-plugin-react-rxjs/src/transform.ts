import * as Babel from "@babel/core"
import template from "@babel/template"
import { assertType } from "./util"
import { NodePath } from "@babel/core"

export const buildTagWrapper = template(`
  IMPORTED.addDebugTag(NAME, ID)(EXPRESSION)
`) as (args: any) => Babel.types.ExpressionStatement

export function getNameFromAssignmentId(
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
  if (
    t.isArrowFunctionExpression(firstParameter.node) ||
    t.isFunctionExpression(firstParameter.node)
  ) {
    // TODO This will fail for `bind(someImportedFactoryFunction)` :(
    const functionPath = firstParameter as NodePath<
      Babel.types.ArrowFunctionExpression | Babel.types.FunctionExpression
    >
    const body = functionPath.get("body").node
    const bodyExpression = t.isExpression(body)
      ? body
      : // If it's a block, then wrap in a IIFE
        buildIIFE({
          BODY: body,
        }).expression

    const replacement = buildTagWrapper({
      IMPORTED: importIdentifier,
      NAME: t.stringLiteral(tagName),
      ID: t.stringLiteral(tagName),
      EXPRESSION: bodyExpression,
    }) as Babel.types.ExpressionStatement
    if (t.isArrowFunctionExpression(firstParameter.node)) {
      functionPath.get("body").replaceWith(replacement)
    } else {
      functionPath
        .get("body")
        .replaceWith(
          t.blockStatement([t.returnStatement(replacement.expression)]),
        )
    }
  } else {
    const replacement = buildTagWrapper({
      IMPORTED: importIdentifier,
      NAME: t.stringLiteral(tagName),
      ID: t.stringLiteral(tagName),
      EXPRESSION: firstParameter.node,
    })
    firstParameter.replaceWith(replacement)
  }
}

const buildIIFE = template(`
  (() => BODY)()
`) as (args: any) => Babel.types.ExpressionStatement
