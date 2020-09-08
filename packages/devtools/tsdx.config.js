const cssOnly = require('rollup-plugin-css-only');

module.exports = {
  rollup(config, options) {
    config.plugins.unshift(cssOnly({ output: 'dist/bundle.css' }));
    return config;
  },
};