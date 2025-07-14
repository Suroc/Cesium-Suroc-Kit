 /**
 * TypeScript处理插件配置
 */
const typescript = require('rollup-plugin-typescript2');

/**
 * 创建TypeScript插件
 * @param {Object} options 配置选项
 * @returns {Object} TypeScript插件配置
 */
function createTypescriptPlugin(options) {
    return typescript({
        check: options.format === 'types',
        tsconfigOverride: {
            compilerOptions: {
                declaration: options.format === 'types',
            },
            exclude: []
        }
    });
}

module.exports = createTypescriptPlugin; 