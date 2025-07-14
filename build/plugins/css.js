/**
 * CSS/SCSS处理插件配置
 */
const postcss = require('rollup-plugin-postcss');
const autoprefixer = require('autoprefixer');
const cssnano = require('cssnano');
const config = require('../config');

/**
 * 创建CSS/SCSS插件
 * @returns {Object|null} PostCSS插件配置
 */
function createCssPlugin() {
    if (!config.CSS_CONFIG.enabled) return null;
    
    return postcss({
        extract: config.CSS_CONFIG.extract,
        minimize: config.CSS_CONFIG.minimize,
        modules: config.CSS_CONFIG.modules,
        use: config.CSS_CONFIG.sass ? ['sass'] : [],
        plugins: [
            config.CSS_CONFIG.autoPrefix ? autoprefixer() : null,
            config.CSS_CONFIG.minimize ? cssnano() : null
        ].filter(Boolean),
        // CSS文件名，仅在extract=true时使用
        extract: config.CSS_CONFIG.extract ? config.CSS_CONFIG.fileName : false,
        // 注入样式的方式，默认为false（添加到<head>标签）
        // 'shadow'表示使用Shadow DOM
        // true表示注入到最近的父级
        inject: false
    });
}

module.exports = createCssPlugin; 