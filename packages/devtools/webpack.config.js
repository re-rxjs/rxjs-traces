const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const { CheckerPlugin } = require('awesome-typescript-loader');
const ExtensionReloader = require('webpack-extension-reloader');
const locateContentScripts = require('./utils/locateContentScripts');

const sourceRootPath = path.join(__dirname, 'src');
const contentScriptsPath = path.join(sourceRootPath, 'ts', 'contentScripts');
const distRootPath = path.join(__dirname, 'dist');
const nodeEnv = process.env.NODE_ENV ? process.env.NODE_ENV : 'development';
const webBrowser = process.env.WEB_BROWSER ? process.env.WEB_BROWSER : 'chrome';

const contentScripts = locateContentScripts(contentScriptsPath);

const extensionReloader = nodeEnv === 'watch' ? new ExtensionReloader({
	port: 9128,
	reloadPage: true,
	entries: {
		background: 'background',
		extensionPage: ['devtools, devtoolsPanel'],
		contentScript: Object.keys(contentScripts),
	}
}) : () => { this.apply = () => { } };

const cleanWebpackPlugin = nodeEnv === 'production' ? new CleanWebpackPlugin() : () => { this.apply = () => { } };

module.exports = {
	watch: nodeEnv === 'watch',
	entry: {
		background: path.join(sourceRootPath, 'ts', 'background', 'index.ts'),
		devtools: path.join(sourceRootPath, 'ts', 'devtools', 'index.ts'),
		devtoolsPanel: path.join(sourceRootPath, 'ts', 'devtoolsPanel', 'index.tsx'),
		...contentScripts
	},
	output: {
		path: distRootPath,
		filename: '[name].js',
	},
	resolve: {
		extensions: ['.js', '.ts', '.tsx', '.json'],
	},
	module: {
		rules: [
			{ test: /\.(js|ts|tsx)?$/, loader: 'awesome-typescript-loader', exclude: /node_modules/ },
		]
	},
	plugins: [
		new CheckerPlugin(),
		new HtmlWebpackPlugin({
			template: path.join(sourceRootPath, 'html', 'devtools.html'),
			inject: 'body',
			filename: 'devtools.html',
			title: 'Web Extension Starter - Devtools Page',
			chunks: ['devtools'],
		}),
		new HtmlWebpackPlugin({
			template: path.join(sourceRootPath, 'html', 'devtoolsPanel.html'),
			inject: 'body',
			filename: 'devtoolsPanel.html',
			title: 'Web Extension Starter - Devtools Panel Page',
			chunks: ['devtoolsPanel'],
		}),
		new CopyWebpackPlugin([
			{
				from: path.join(sourceRootPath, 'assets'),
				to: path.join(distRootPath, 'assets'),
				test: /\.(jpg|jpeg|png|gif|svg)?$/,
			},
			{
				from: path.join(sourceRootPath, 'manifest.json'),
				to: path.join(distRootPath, 'manifest.json'),
				toType: 'file',
			}
		]),
		new webpack.DefinePlugin({
			'NODE_ENV': JSON.stringify(nodeEnv),
			'WEB_BROWSER': JSON.stringify(webBrowser),
		}),
		extensionReloader,
		cleanWebpackPlugin
	],
}
