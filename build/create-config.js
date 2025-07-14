/**
 * 创建Rollup打包配置
 */
const config = require('./config');
const createCssPlugin = require('./plugins/css');
const createTypescriptPlugin = require('./plugins/typescript');
const createTerserPlugin = require('./plugins/terser');

/**
 * 创建打包配置
 * @param {Object} options 配置选项
 * @returns {Object} Rollup配置对象
 */
function createConfig(options) {
    return {
        // 入口文件
        input: config.INPUT_FILE,
        // 外部依赖，不会被打包
        external: config.EXTERNAL,
        // 输出配置
        output: {
            name: config.GLOBAL_NAME, // 用于UMD/IIFE格式
            file: config.getOutputFile(options.format),
            format: options.format === 'types' ? 'es' : options.format,
            exports: 'auto',
            banner: config.BANNER,
            // 是否生成sourcemap
            sourcemap: !config.IS_PRODUCTION,
            // 全局变量映射，用于UMD/IIFE格式
            globals: {}
        },
        // 插件配置
        plugins: [
            // CSS/SCSS处理插件
            createCssPlugin(),
            // TypeScript编译插件
            createTypescriptPlugin(options),
            // Terser压缩插件
            createTerserPlugin()
        ].filter(Boolean)
    };
}

module.exports = createConfig; 