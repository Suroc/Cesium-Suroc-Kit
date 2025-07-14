/**
 * 打包配置文件
 * 集中管理所有可配置选项
 */
const pkg = require('../package.json');

// ============= 用户可配置区域 =============

/**
 * 要生成的输出格式，可以根据需要添加或删除
 * @type {('cjs'|'es'|'umd'|'iife')[]} 格式数组
 * 
 * - cjs (CommonJS): 适用于Node.js环境和webpack等打包工具
 * - es (ES Module): 适用于支持ES模块的现代浏览器和打包工具，支持tree-shaking
 * - umd (Universal Module Definition): 通用模块定义，同时支持浏览器、Node.js和AMD加载器
 * - iife (Immediately Invoked Function Expression): 自执行函数，适合作为<script>标签直接在浏览器中使用
 */
exports.OUTPUT_FORMATS = process.env.FORMAT 
    ? [process.env.FORMAT] // 如果设置了FORMAT环境变量，只输出指定格式
    : ['cjs', 'es'];       // 否则使用默认值

/**
 * 是否生成类型声明文件
 * @type {boolean}
 */
exports.GENERATE_TYPES = process.env.FORMAT !== 'umd' && process.env.FORMAT !== 'iife';

/**
 * UMD/IIFE格式下的全局变量名，默认为驼峰式包名
 * @type {string}
 */
exports.GLOBAL_NAME = pkg.name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());

/**
 * 外部依赖，这些依赖不会被打包
 * @type {string[]}
 */
exports.EXTERNAL = [];

/**
 * 入口文件路径
 * @type {string}
 */
exports.INPUT_FILE = './src/index.ts';

/**
 * CSS/SCSS配置
 * @type {Object}
 */
exports.CSS_CONFIG = {
    // 是否启用CSS/SCSS处理
    enabled: true,
    // 是否将CSS提取为单独的文件，false表示注入到JS中
    extract: false,
    // 是否压缩CSS
    minimize: true,
    // CSS模块化，设为true会将类名转换为哈希值，避免样式冲突
    modules: false,
    // 是否使用Sass预处理器
    sass: true,
    // 自动添加浏览器前缀
    autoPrefix: true,
    // 提取的CSS文件名
    fileName: 'styles.css'
};

// ============= 以下是内部配置，通常不需要修改 =============

/**
 * 构建输出的横幅信息
 * @type {string}
 */
exports.BANNER = [
    '/*!',
    ` * ${pkg.name} v${pkg.version}`,
    ` * ${pkg.description}`,
    ` * Copyright (c) ${pkg.author}.`,
    ` * This source code is licensed under the ${pkg.license} license.`,
    ' */'
].join('\n');

/**
 * 获取输出文件路径
 * @param {string} format 打包格式
 * @returns {string} 输出文件路径
 */
exports.getOutputFile = function(format) {
    switch (format) {
        case 'cjs':
            return pkg.common || './dist/index.js';
        case 'es':
            return pkg.module || './dist/index.mjs';
        case 'umd':
            return './dist/index.umd.js';
        case 'iife':
            return './dist/index.min.js';
        case 'types':
            return pkg.typings || './types/index.d.ts';
        default:
            return `./dist/index.${format}.js`;
    }
}

/**
 * 是否为生产环境
 * @type {boolean}
 */
exports.IS_PRODUCTION = process.env.NODE_ENV === 'production'; 