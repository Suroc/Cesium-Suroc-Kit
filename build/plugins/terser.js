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
        format: {
            comments: function(node, comment) {
                // 保留banner注释
                return comment.type === 'comment2' && /^\/*!/.test(comment.value);
            }
        }
    });
}

module.exports = createTerserPlugin; 