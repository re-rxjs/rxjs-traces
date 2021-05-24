import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import cssOnly from "rollup-plugin-css-only";
import { babel } from "@rollup/plugin-babel";
import image from "@rollup/plugin-image";
import { terser } from "rollup-plugin-terser";
import { rollup } from "rollup";
import fs from "fs";

const makeConfig = ({ format, minify, types, css }) =>
  // : {
  //   format: 'esm' | 'cjs';
  //   minify: boolean;
  //   types: boolean;
  // }): RollupOptions => {
  {
    const outputName = `${process.argv[2]}.${format}.${
      minify ? "min.js" : "js"
    }`;

    return {
      input: "./src/index.ts",
      external: (id, parent, resolved) => {
        const isExternal = !(id.startsWith(".") || resolved);
        return isExternal;
      },
      treeshake: {
        // We assume reading a property of an object never has side-effects.
        propertyReadSideEffects: false,
      },
      output: {
        dir: "./dist",
        entryFileNames: outputName,
        format,
        esModule: true,
        sourcemap: true,
        exports: "named",
      },
      plugins: [
        // all bundled external modules need to be converted from CJS to ESM
        image(),
        commonjs(),
        typescript({
          emitDeclarationOnly: types,
          noEmit: !types,
          declarationDir: "./dist",
        }),
        css && cssOnly({ output: "bundle.css" }),
        babel({
          exclude: "node_modules/**",
          extensions: ["ts", "tsx"],
          babelHelpers: "bundled",
        }),
        minify &&
          terser({
            output: { comments: false },
            compress: {
              keep_infinity: true,
              pure_getters: true,
              passes: 10,
            },
            ecma: 5,
            toplevel: format === "cjs",
          }),
      ],
    };
  };

function runRollup(config) {
  return rollup(config).then((r) => r.write(config.output));
}

fs.rmdirSync("./dist", { recursive: true });
runRollup(
  makeConfig({
    format: "esm",
    minify: false,
    types: true,
    css: process.argv.includes("--css"),
  })
).then(
  (r) => console.log("success!"),
  (e) => console.error(e)
);
