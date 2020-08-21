import pluginTester from "babel-plugin-tester"
import macros from "babel-plugin-macros"
import plugin from "../src"
import path from "path"

pluginTester({
  plugin,
  fixtures: path.join(__dirname, "fixtures", "plugin"),
})

pluginTester({
  plugin: macros,
  fixtures: path.join(__dirname, "fixtures", "macro"),
})
