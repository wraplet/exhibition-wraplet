import webpack from "webpack";
import path from "path";
import { fileURLToPath } from "url";
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

//const devMode = process.env.NODE_ENV !== "production";

const baseConfig: webpack.Configuration = {
    devtool: "source-map",
    resolve: {
        extensions: [".tsx", ".ts", ".js"],
    },
    resolveLoader: {
        modules: ["node_modules", path.resolve(__dirname, "loaders")],
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                loader: "ts-loader",
                exclude: "/node_modules/",
                options: {
                    configFile: "tsconfig.build.json",
                },
            },
          {
            test: /\.css$/,
            use: ['style-loader', 'css-loader']
          },
          {
            test: /\.ttf$/,
            type: 'asset/resource'
          }
        ],
    },
    plugins: [
        new webpack.DefinePlugin({
            BASEPATH: JSON.stringify(""),
        }),
        new MonacoWebpackPlugin({
          // Specify which languages to include
          languages: ['typescript', 'javascript', 'html', 'css'],
          // Customize worker options
          customLanguages: [],
          globalAPI: false,
          publicPath: 'auto',
        }),
    ],
    experiments: {
        outputModule: true,
    },
};

function createOutputConfig(
    outputFile: string,
    entry: string,
    type: "module" | "commonjs",
) {
    return {
        ...baseConfig,
        entry: {
          app: entry,
          //'editor.worker': 'monaco-editor/esm/vs/editor/editor.worker.js',
          //'json.worker': 'monaco-editor/esm/vs/language/json/json.worker',
          //'css.worker': 'monaco-editor/esm/vs/language/css/css.worker',
          //'html.worker': 'monaco-editor/esm/vs/language/html/html.worker',
          //'ts.worker': 'monaco-editor/esm/vs/language/typescript/ts.worker'
        },
        output: {
            filename: outputFile,
            path: path.resolve(__dirname, "dist"),
            library: {
                type: type,
            },
            globalObject: 'self',
            publicPath: 'auto',
            chunkFilename: '[name].index.js',
        },
    };
}

const indexEsmConfig: webpack.Configuration = createOutputConfig(
    "index.js",
    "./src/index.ts",
    "module",
);

const indexCjsConfig: webpack.Configuration = createOutputConfig(
    "index.cjs",
    "./src/index.ts",
    "commonjs",
);

export default [
    indexEsmConfig,
    indexCjsConfig,
];
