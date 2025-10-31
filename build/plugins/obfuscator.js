/*
 * @Author: Suroc
 * @Date: 2025-07-14 15:16:25
 * @LastEditTime: 2025-08-18 10:33:31
 * @Description: 增强混淆配置，提升代码保护强度
 */
/**
 * 二次混淆配置
 */
const obfuscator = require('rollup-plugin-obfuscator');
const config = require('../config');

function createObfuscatorPlugin(options = {}) {
  // 只有生产环境且启用 OBFUSCATE 才混淆
  if (!config.IS_PRODUCTION || !process.env.OBFUSCATE) return null;

  // 获取当前构建格式（如果提供）
  const format = options.format || '';

  // 基础混淆配置
  const obfuscationConfig = {
    compact: true,            // 压缩代码
    controlFlowFlattening: true, // 控制流平坦化
    controlFlowFlatteningThreshold: 1.0, // 最大控制流平坦化阈值
    deadCodeInjection: true,  // 开启死代码注入增强混淆
    deadCodeInjectionThreshold: 0.7, // 提高死代码注入阈值
    debugProtection: true,    // 启用调试保护
    disableConsoleOutput: false, // 保持控制台输出以便调试

    // 确保在所有格式中使用十六进制变量名
    identifierNamesGenerator: 'hexadecimal', // 内部变量名使用十六进制
    identifiersPrefix: '0x',  // 前缀确保十六进制风格

    log: false,
    numbersToExpressions: true, // 将数字转换为表达式
    renameGlobals: false,      // 不混淆全局变量和类名
    renameProperties: false,   // 不混淆对象属性和方法名 - 确保API方法名为明文
    rotateStringArray: true,
    selfDefending: true, // 启用自我保护
    stringArray: true,
    stringArrayEncoding: ['base64', 'rc4'], // 使用多种编码方式
    stringArrayThreshold: 1.0, // 最高字符串数组替换阈值
    stringArrayWrappersCount: 5, // 增加包装函数数量
    stringArrayWrappersType: 'function',
    stringArrayWrappersChainedCalls: true,
    target: 'browser',
    transformObjectKeys: true, // 转换对象键名
    unicodeEscapeSequence: true, // 启用Unicode转义
    splitStrings: true, // 分割字符串
    splitStringsChunkLength: 2, // 字符串分割长度

    // 关键设置：自动保留所有导出的类名和函数名作为明文API
    // 不需要手动维护API列表，系统会自动识别并保留所有导出的接口
    keepClassNames: true,      // 保留所有类名作为明文
    keepFunctionNames: true,   // 保留所有函数名作为明文

    // 基本配置
    ignoreRequireImports: true,
    ignoreGlobalThis: false,

    // 自动识别导出API，不需要手动维护reservedNames数组
    reservedNames: [],

    // 保留空字符串数组
    reservedStrings: []
  };

  // 为ES模块格式添加特殊处理，确保十六进制变量名正确应用
  if (format === 'es') {
    // 为ES模块创建专门的混淆配置，专注于变量名混淆
    return obfuscator({
      // 基础配置
      compact: true,
      target: 'browser',
      
      // 关键：变量名生成设置
      identifierNamesGenerator: 'hexadecimal',
      identifiersPrefix: '',
      
      // 自动保留API名称
      keepClassNames: true,
      keepFunctionNames: true,
      
      // 确保混淆内部逻辑
      controlFlowFlattening: true,
      controlFlowFlatteningThreshold: 1.0,
      
      // ES模块特定配置
      ignoreRequireImports: true,
      
      // 简化混淆配置，避免可能的冲突
      renameProperties: false,
      renameGlobals: false,
      simplify: false,
      
      // 不需要手动维护API列表
      reservedNames: [],
      reservedStrings: []
    });
  }

  return obfuscator(obfuscationConfig);
}

module.exports = createObfuscatorPlugin;
