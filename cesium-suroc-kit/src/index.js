/**
 * 测试项目入口文件
 * 用于测试npm依赖包
 */

// 引入依赖包
const { Utils } = require('npm-package-template');

// 测试Utils类的功能
console.log('============ 测试Utils类 ============');
console.log('Utils.isEmpty(null):', Utils.isEmpty(null));
console.log('Utils.isEmpty(""):', Utils.isEmpty(''));
console.log('Utils.isEmpty([]):', Utils.isEmpty([]));
console.log('Utils.isEmpty({}):', Utils.isEmpty({}));
console.log('Utils.isEmpty("hello"):', Utils.isEmpty('hello'));

// 测试DOM操作相关功能（仅在浏览器环境中可用）
console.log('\n如果需要测试DOM相关功能，请创建HTML文件并在浏览器中测试。');

console.log('\n测试完成！'); 