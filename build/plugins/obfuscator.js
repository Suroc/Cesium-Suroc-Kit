/*
 * @Author: Suroc
 * @Date: 2025-07-14 15:16:25
 * @LastEditTime: 2025-08-18 10:33:31
 * @Description: 
 */
/**
 * 二次混淆配置
 */
const obfuscator = require('rollup-plugin-obfuscator');
const config = require('../config');

function createObfuscatorPlugin() {
  // 只有生产环境且启用 OBFUSCATE 才混淆
  if (!config.IS_PRODUCTION || !process.env.OBFUSCATE) return null;

  return obfuscator({
    compact: true,            // 压缩
    controlFlowFlattening: true, // 控制流平坦化
    deadCodeInjection: true,  // 注入无用代码
    debugProtection: false,
    disableConsoleOutput: true,
    identifierNamesGenerator: 'hexadecimal', // 变量名十六进制
    rotateStringArray: true,
    selfDefending: true,
    stringArray: true,
    stringArrayEncoding: ['base64'],
    stringArrayThreshold: 0.75
  });
}

module.exports = createObfuscatorPlugin;
