// 验证脚本 - 自动检测构建后的文件中哪些函数名被混淆
const fs = require('fs');
const path = require('path');

// 源代码目录和构建后的JS文件路径
const srcDir = path.join(__dirname, 'src');
const jsFilePath = path.join(__dirname, 'dist/index.js');
const mjsFilePath = path.join(__dirname, 'dist/index.mjs');

// JavaScript关键字列表，这些不应被视为API名称
const JS_KEYWORDS = new Set([
  'abstract', 'arguments', 'await', 'boolean', 'break', 'byte', 'case', 'catch', 'char',
  'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do', 'double', 'else',
  'enum', 'eval', 'export', 'extends', 'false', 'final', 'finally', 'float', 'for',
  'function', 'goto', 'if', 'implements', 'import', 'in', 'instanceof', 'int', 'interface',
  'let', 'long', 'native', 'new', 'null', 'package', 'private', 'protected', 'public',
  'return', 'short', 'static', 'super', 'switch', 'synchronized', 'this', 'throw', 'throws',
  'transient', 'true', 'try', 'typeof', 'var', 'void', 'volatile', 'while', 'with', 'yield',
  't', 'setTimeout'
]);

// 从源代码中提取类名和函数名
function extractAPINames() {
  const apiNames = new Set();
  const publicAPIs = new Set(); // 专门存储公共API

  const apiPatterns = [
    // 匹配类定义
    { pattern: /class\s+([A-Z][a-zA-Z0-9_$]*)/g, isPublic: false },
    // 匹配导出的函数/变量 - 公共API
    { pattern: /export\s+(?:function|const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g, isPublic: true },
    // 匹配类中的方法
    { pattern: /(?:^|\s|\{|;)\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\([^)]*\)\s*(?:=>|\{)/g, isPublic: false },
    // 匹配导出的默认内容中的名称 - 公共API
    { pattern: /export\s+default\s+(?:class\s+)?([A-Z][a-zA-Z0-9_$]*)/g, isPublic: true },
    // 匹配从类中导出的方法
    { pattern: /(?:class\s+[A-Z]\w*\s*\{[\s\S]*?)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\([^)]*\)\s*(?:=>|\{)/g, isPublic: false }
  ];

  // 读取源代码文件
  function readSourceFiles(dir) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        readSourceFiles(filePath);
      } else if (file.endsWith('.js') || file.endsWith('.ts')) {
        try {
          const content = fs.readFileSync(filePath, 'utf-8');

          // 找出所有导出的类名
          const exportedClasses = new Set();
          let classMatch;
          const classExportPattern = /export\s+(?:class|default\s+class)\s+([A-Z][a-zA-Z0-9_$]*)/g;
          while ((classMatch = classExportPattern.exec(content)) !== null) {
            if (classMatch[1]) {
              exportedClasses.add(classMatch[1]);
            }
          }

          // 处理每种模式
          apiPatterns.forEach(({ pattern, isPublic }) => {
            let match;
            while ((match = pattern.exec(content)) !== null) {
              const name = match[1];
              // 过滤条件：不是关键字、不是私有方法、名称长度合理
              if (name && !name.startsWith('_') && name.length > 2 && !JS_KEYWORDS.has(name)) {
                apiNames.add(name);

                // 如果是公共API或者是导出类的方法，则标记为公共API
                if (isPublic || exportedClasses.has(name)) {
                  publicAPIs.add(name);
                }
              }
            }
          });
        } catch (error) {
          console.error(`读取文件失败: ${filePath}`, error.message);
        }
      }
    });
  }

  readSourceFiles(srcDir);

  return {
    allNames: Array.from(apiNames),
    publicNames: Array.from(publicAPIs)
  };
}

// 检查构建后的文件中API名称是否被保留
function checkExportedAPIs(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`文件不存在: ${filePath}`);
    return;
  }

  console.log(`\n========================================`);
  console.log(`检查文件: ${filePath}`);
  console.log(`========================================`);

  const content = fs.readFileSync(filePath, 'utf-8');

  // 提取API名称
  console.log('正在从源代码中提取API名称...');
  const { allNames, publicNames } = extractAPINames();
  console.log(`找到 ${allNames.length} 个潜在的API名称，其中 ${publicNames.length} 个可能是公共API`);

  // 分类统计结果
  const foundNames = [];
  const notFoundNames = [];
  const foundPublicNames = [];
  const notFoundPublicNames = [];

  // 检查所有API名称
  allNames.forEach(name => {
    if (content.includes(name)) {
      foundNames.push(name);
      if (publicNames.includes(name)) {
        foundPublicNames.push(name);
      }
    } else {
      notFoundNames.push(name);
      if (publicNames.includes(name)) {
        notFoundPublicNames.push(name);
      }
    }
  });

  // 输出所有API检查结果
  console.log(`\n📊 所有API名称检查结果:`);
  console.log(`   保留: ${foundNames.length} / ${allNames.length} (${Math.round((foundNames.length / allNames.length) * 100)}%)`);

  // 输出公共API检查结果（更重要）
  console.log(`\n🔍 公共API名称检查结果:`);
  console.log(`   保留: ${foundPublicNames.length} / ${publicNames.length} (${Math.round((foundPublicNames.length / publicNames.length) * 100)}%)`);

  if (foundPublicNames.length > 0) {
    console.log(`\n✅ 成功保留的公共API (${foundPublicNames.length}个):`);
    foundPublicNames.sort().forEach(name => {
      console.log(`  - ${name}`);
    });
  }

  if (notFoundPublicNames.length > 0) {
    console.log(`\n❌ 可能被混淆的公共API (${notFoundPublicNames.length}个):`);
    notFoundPublicNames.sort().forEach(name => {
      console.log(`  - ${name}`);
    });

    // 如果有公共API被混淆，给出警告
    console.log(`\n⚠️  警告: 有公共API名称可能被混淆，这可能会导致API无法正常使用！`);
  }

  // 检查整体结构
  if (content.includes('export default')) {
    console.log('\n✅ 找到export default');
  }

  // 改进的混淆程度检测
  const obfuscationIndicators = {
    // 增强的十六进制变量名检测，适应ES模块格式
    hasHexNames: /\b_?0x[0-9a-fA-F]{2,}\b/.test(content) ||
      /(?<=\s|\(|\{|=|,|:|\[|\.)_?0x[0-9a-fA-F]{2,}(?=\s|\)|\}|=|,|;|\.|\[|\]|\()/.test(content) ||
      /import\s+\{[^}]*_?0x[0-9a-fA-F]{2,}[^}]*\}/.test(content) ||
      /export\s+\{[^}]*_?0x[0-9a-fA-F]{2,}[^}]*\}/.test(content),
    hasShortVars: /\b[a-zA-Z]{1,2}\b(?=\s*[=\(\{\[]|\s*:\s*)/.test(content), // 增强短变量名检测
    hasControlFlowObf: /\bswitch\b[^}]*\bcase\b[^}]*\bbreak\b/.test(content) ||
      /\bfor\b[^}]*\b\([^)]*\)/.test(content) ||
      /\bif\b[^}]*\belse\b[^}]*\bif\b/.test(content) ||
      /\bwhile\b[^}]*\b\([^)]*\)/.test(content), // 增强控制流混淆检测
    hasStringArray: /stringArray|decodeURIComponent|atob|fromCharCode|_0x/.test(content) || /\b[a-zA-Z]{1,2}\s*\[/.test(content) // 增强字符串数组检测
  };

  const obfuscationScore = Object.values(obfuscationIndicators).filter(Boolean).length;
  let obfuscationLevel = '';
  let obfuscationDesc = '';

  // 更精确的混淆等级判定
  if (obfuscationScore >= 3 || (obfuscationScore >= 2 && obfuscationIndicators.hasControlFlowObf)) {
    obfuscationLevel = '高';
    obfuscationDesc = '包含高级混淆技术';
  } else if (obfuscationScore >= 2) {
    obfuscationLevel = '中高';
    obfuscationDesc = '包含中等程度混淆';
  } else if (obfuscationScore >= 1) {
    obfuscationLevel = '中';
    obfuscationDesc = '包含基本混淆';
  } else {
    obfuscationLevel = '低';
    obfuscationDesc = '可能没有或轻微混淆';
  }

  console.log(`\n🔒 混淆分析:`);
  console.log(`   混淆等级: ${obfuscationLevel}`);
  console.log(`   描述: ${obfuscationDesc}`);
  console.log(`   特征:`);
  console.log(`     - 十六进制变量名: ${obfuscationIndicators.hasHexNames ? '✅' : '❌'}`);
  console.log(`     - 短变量名: ${obfuscationIndicators.hasShortVars ? '✅' : '❌'}`);
  console.log(`     - 控制流混淆: ${obfuscationIndicators.hasControlFlowObf ? '✅' : '❌'}`);
  console.log(`     - 字符串数组: ${obfuscationIndicators.hasStringArray ? '✅' : '❌'}`);
}

// 检查两个构建后的文件
checkExportedAPIs(jsFilePath);
checkExportedAPIs(mjsFilePath);

console.log('\n========================================');
console.log('验证完成！');
console.log('========================================');