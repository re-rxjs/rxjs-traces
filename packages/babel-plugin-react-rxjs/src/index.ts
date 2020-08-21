import template from "@babel/template"
import { PluginObj, NodePath } from "@babel/core"
import * as Babel from "@babel/core"

const buildTagWrapper = template(`
  IMPORTED.addDebugTag(NAME, ID)(EXPRESSION)
`) as (args: any) => Babel.types.ExpressionStatement

const packageName = "@react-rxjs/core"
const targetName = "bind"

export default function babelPlugin({ types: t }: typeof Babel): PluginObj {
  const importIdentifier = t.identifier("autoRxjsTraces")
  const autoImportExpression = t.importDeclaration(
    [t.importNamespaceSpecifier(importIdentifier)],
    t.stringLiteral("rxjs-traces"),
  )

  let autoImportAdded = false
  const ensureImport = (path: NodePath<any>) => {
    if (!autoImportAdded) {
      const program = path.findParent((path) =>
        t.isProgram(path.node),
      ) as NodePath<Babel.types.Program>
      program.unshiftContainer("body", autoImportExpression)
      autoImportAdded = true
    }
  }

  const importedTargetNames: string[] = []

  return {
    name: "react-rxjs",
    visitor: {
      ImportSpecifier(path) {
        const importDeclaration = assertType(t.isImportDeclaration, path.parent)
        if (importDeclaration?.source.value === packageName) {
          if (targetName === path.node.imported.name) {
            importedTargetNames.push(path.node.local.name)
          }
        }
      },
      CallExpression(path) {
        const callee = assertType(t.isIdentifier, path.get("callee").node)

        if (callee && importedTargetNames.includes(callee.name)) {
          ensureImport(path)

          const parent = assertType(t.isVariableDeclarator, path.parent)
          const tagName = parent && getNameFromAssignmentId(t, parent.id)
          if (!tagName) {
            return
          }

          const firstParameter = path.get("arguments.0") as NodePath
          const firstParameterNode = firstParameter.node
          const replacement = buildTagWrapper({
            IMPORTED: importIdentifier,
            NAME: t.stringLiteral(tagName),
            ID: t.stringLiteral(tagName),
            EXPRESSION: firstParameterNode,
          })
          firstParameter.replaceWith(replacement)
        }
      },
    },
  }
}

function assertType<TValue, TType extends TValue>(
  checkFn: (node: TValue) => node is TType,
  value: TValue | null | undefined,
): TType | null {
  if (value && checkFn(value)) {
    return value
  }
  return null
}

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
