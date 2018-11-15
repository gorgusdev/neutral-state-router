import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';

export default {
    input: 'esm/index.js',
    output: {
        file: 'tests/bundle.js',
        name: 'Neutral',
        format: 'iife',
        interop: true,
        exports: 'named'
    },
    plugins: [
        resolve({
            module: true,
            main: true,
            browser: true
        }),
        commonjs()
    ]
};
