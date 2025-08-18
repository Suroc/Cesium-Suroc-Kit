## 开发流程

### 1. 准备工作

1. 复制此模板到你的项目中
2. 修改`package.json`中的基本信息（名称、描述、版本、作者等）
3. 安装依赖:

```bash
npm install
# 或
yarn
# 或
pnpm install
```

### 2. 开发你的库

1. 编辑`src/index.ts`，实现你的库的主要功能
2. 如果需要，添加更多的源文件并在`index.ts`中导出它们
3. 编写文档和示例

### 3. 构建

```bash
# 开发环境构建（不压缩，带sourcemap）
npm run build:dev

# 生产环境构建（压缩，不带sourcemap）
npm run build:pro

# 生产构建（压缩+混淆）
npm run build:all

# 生产构建（压缩+混淆+二次加密）
npm run build:secure

# 构建特定格式（如UMD格式，用于浏览器中使用）
npm run build:umd
```

### 4. 测试

开发过程中，可以使用内置的测试项目快速验证：

```bash
# 快速开发测试（构建并在Node.js中测试）
npm run dev

# 在浏览器中测试
npm run test:browser
```

另外，也可以通过本地链接的方式测试你的包:

```bash
# 在你的包目录中
npm link

# 在其他测试项目中
npm link your-package-name
```

### 5. 发布

准备好发布时，更新版本号并执行：

```bash
npm run toPublish
```

## 项目结构

```
├── build/                      # 构建配置目录
│   ├── config.js               # 主要配置文件（修改此文件自定义配置）
│   ├── create-config.js        # 配置生成函数
│   └── plugins/                # 插件配置目录
│       ├── css.js              # CSS/SCSS处理插件配置
│       ├── terser.js           # 代码压缩插件配置
│       └── typescript.js       # TypeScript插件配置
├── dist/                       # 构建输出目录
│   ├── index.js                # CommonJS格式输出
│   ├── index.mjs               # ES Module格式输出
│   ├── index.umd.js            # UMD格式输出（可选）
│   ├── index.min.js            # IIFE格式输出（可选）
│   └── styles.css              # 提取的CSS文件（可选）
├── src/                        # 源代码目录
│   ├── index.ts                # 入口文件
│   └── styles/                 # 样式文件目录
│       ├── style.css           # CSS样式示例
│       └── style.scss          # SCSS样式示例
├── test-project/               # 测试项目目录
│   ├── src/                    # 测试项目源代码
│   │   └── index.js            # Node.js测试入口文件
│   ├── public/                 # 浏览器测试文件
│   │   └── index.html          # 浏览器测试页面
│   └── package.json            # 测试项目配置文件
├── types/                      # 类型定义输出目录
│   └── index.d.ts              # 类型声明文件
├── LICENSE                     # 开源许可证文件（需替换为您自己的）
├── package.json                # 包配置文件
├── tsconfig.json               # TypeScript配置
├── rollup.config.js            # Rollup主配置文件（入口点）
└── README.md                   # 文档
```

## package.json 关键字段说明

| 字段              | 描述                                |
| ----------------- | ----------------------------------- |
| `name`            | NPM包的名称，请使用唯一的名称       |
| `version`         | 版本号，遵循语义化版本规范          |
| `description`     | 包的简短描述                        |
| `main`            | CommonJS格式的入口文件路径          |
| `module`          | ES Module格式的入口文件路径         |
| `typings`         | TypeScript类型定义文件路径          |
| `exports`         | 提供更精确的模块导出映射            |
| `files`           | 发布到NPM仓库的文件列表             |
| `scripts`         | 定义npm命令脚本                     |
| `keywords`        | 包的关键词，有助于在npm搜索时被找到 |
| `author`          | 包的作者信息                        |
| `license`         | 开源许可证类型                      |
| `devDependencies` | 开发时依赖的包列表                  |

## 构建配置说明

本模板采用模块化的构建配置，主要配置文件已被拆分到`build/`目录下，使配置更清晰、易于维护。

### 配置文件结构

- `rollup.config.js`: 主配置文件入口点，通常不需要修改
- `build/config.js`: 集中管理所有可配置选项的地方，**修改此文件来自定义配置**
- `build/create-config.js`: 创建Rollup配置对象的函数
- `build/plugins/`: 包含各种插件配置的目录

### 主要配置项

要自定义构建配置，只需编辑`build/config.js`文件中的选项：

