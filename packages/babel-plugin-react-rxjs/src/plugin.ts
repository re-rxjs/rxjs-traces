import * as Babel from "@babel/core"
import { NodePath, PluginObj } from "@babel/core"
import { transformCallExpression } from "./transform"
import { assertType } from "./util"

const packageName = "@react-rxjs/core"
const targetName = "bind"

export function babelPlugin({ types: t }: typeof Babel): PluginObj {
  const importIdentifier = t.identifier("autoRxjsTraces")
  const autoImportExpression = t.importDeclaration(
    [t.importNamespaceSpecifier(importIdentifier)],
    t.stringLiteral("rxjs-traces"),
  )

  const createProgramVisitor = (): Babel.Visitor => {
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

          transformCallExpression(t, path, importIdentifier)
        }
      },
    }
  }

  return {
    name: "react-rxjs",
    visitor: {
      Program(path) {
        const imports = path
          .get("body")
          .filter((statementPath) =>
            t.isImportDeclaration(statementPath.node),
          ) as NodePath<Babel.types.ImportDeclaration>[]

        const specifiers = imports.flatMap((importPath) =>
          importPath.get("specifiers"),
        )
        const hasImport = specifiers.some((specifier) => {
          const node = specifier.node
          return (
            t.isImportNamespaceSpecifier(node) &&
            node.local.name === importIdentifier.name
          )
        })

        if (!hasImport) {
          path.traverse(createProgramVisitor())
        }
      },
    },
  }
}
