import * as Babel from "@babel/core"
import { NodePath } from "@babel/core"
import { createMacro } from "babel-plugin-macros"
import { transformCallExpression } from "./transform"
import { assertType } from "./util"

const packageName = "@react-rxjs/core"

export const macro = createMacro(
  ({ references, state, babel: { types: t } }) => {
    /** Change import to @react/core
     * babel-plugin-macros by default removes the /macro import.
     * We could tell to not remove it by returning some config... but I'm not
     * sure how to make it work in runtime.
     */
    const imports = Object.keys(references)
    const getLocalName = (reference: NodePath[]) =>
      assertType(t.isIdentifier, reference[0].node)!.name

    const coreImportDeclaration = t.importDeclaration(
      imports.map((methodName) =>
        t.importSpecifier(
          t.identifier(getLocalName(references[methodName])),
          t.identifier(methodName),
        ),
      ),
      t.stringLiteral(packageName),
    )
    const filePath = state.file.path as NodePath<Babel.types.Program>
    filePath.unshiftContainer("body", coreImportDeclaration)

    /** Add import so we can use rxjs-traces */
    const rxjsTracesIdentifier = t.identifier("autoRxjsTraces")
    const tracesImportDeclaration = t.importDeclaration(
      [t.importNamespaceSpecifier(rxjsTracesIdentifier)],
      t.stringLiteral("rxjs-traces"),
    )
    filePath.unshiftContainer("body", tracesImportDeclaration)

    references.bind.forEach((ref) => {
      const callExpression = ref.parentPath as NodePath<
        Babel.types.CallExpression
      > // Assuming consumers won't reassign

      transformCallExpression(t, callExpression, rxjsTracesIdentifier)
    })
  },
  {},
)
