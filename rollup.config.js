/**
 * Rollup主配置文件
 * 
 * 此文件只是一个入口点，实际配置已被拆分到build/目录中
 * 要自定义配置，请编辑 build/config.js 文件
 */

const config = require('./build/config');
const createConfig = require('./build/create-config');

// 创建所有指定格式的配置
const configs = config.OUTPUT_FORMATS.map(format => createConfig({ format }));

// 如果需要生成类型声明文件，添加相应配置
if (config.GENERATE_TYPES) {
    configs.push(createConfig({ format: 'types' }));
}

// 导出配置数组
exports.default = configs;
