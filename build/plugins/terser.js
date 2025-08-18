/*
 * @Author: Suroc
 * @Date: 2025-07-14 15:16:25
 * @LastEditTime: 2025-08-18 10:06:38
 * @Description: 
 */
/**
 * Terser压缩插件配置
 */
const terser = require('@rollup/plugin-terser');
const config = require('../config');

/**
 * 创建Terser压缩插件
 * @returns {Object|null} Terser插件配置
 */
function createTerserPlugin() {
    if (!config.IS_PRODUCTION) return null;

    return terser({
        compress: {
            drop_console: true,   // 去掉 console.*
            drop_debugger: true,  // 去掉 debugger
            passes: 2             // 多次优化，提高压缩率
        },
        mangle: {
            toplevel: true,       // 混淆顶层变量和函数名
            properties: true      // 混淆对象属性名
        },
        format: {
            comments: function (node, comment) {
                // 保留banner注释
                return comment.type === 'comment2' && /^\/*!/.test(comment.value);
            }
        }
    });
}

module.exports = createTerserPlugin; 