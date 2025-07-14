# 🌐 Creatunion 插件说明文档

## 📌 插件作用
该插件用于在 Cesium 地球可视化场景中加载并展示空间目标（如卫星、火箭残骸等），并基于开普勒轨道六根数生成其动态轨迹、图标、模型及轨道线，支持权限验证、标签展示、图标配置等。

## ⚙️ 初始化参数（constructor(option)）

| 参数名       | 类型            | 必填 | 说明                                                                            |
| ------------ | --------------- | ---- | ------------------------------------------------------------------------------- |
| viewer       | `Cesium.Viewer` | ✅    | Cesium 实例                                                                     |
| keplers      | `Array<Object>` | ✅    | 卫星数据列表，每项包含 a,i,e,o,w,m,time,norad_cat_id,objectName,objectType,icon |
| cols         | `Object`        | ✅    | 不同对象类型的颜色映射，如 PAYLOAD, ROCKETBODY, DEBRIS 等                       |
| staticApi    | `string`        | ✅    | icon、模型等静态资源的 URL 前缀                                                 |
| models       | `Object`        | ✅    | 各对象类型对应的 3D 模型路径映射                                                |
| pixelSize    | `number`        | ❌    | 点大小（默认值推荐 8）                                                          |
| outlineWidth | `number`        | ❌    | 点轮廓宽度（默认 1~2）                                                          |
| token        | `string`        | ✅    | 加密的授权令牌                                                                  |
| settings     | `Object`        | ❌    | 展示设置 { point, icon, model, orbit, label, orbitMaterial, defaultIcon }       |
| callback     | `Function`      | ❌    | 自定义回调函数，未使用                                                          |

## 📚 类方法说明

### 📍 数据加载与展示

- **init()**
  - 初始化时调用，进行授权验证并加载实体。

### 🛰 轨道显示

- **_displayOrbit(obj)**
  - 为指定实体绘制轨道线并可添加 label。

- **_deleteOrbit(ID)**
  - 删除指定 ID 的轨道线，或清除全部轨道。

### 🔄 数据更新

- **reloadPoint(points)**
  - 重新加载一组新的轨道对象数据并重绘。


## ✅ 使用说明（使用示例）

1. **引入依赖(建议全局引入)**

   使用 npm:
   ```bash
   npm install crypto-js jquery
   ```

   使用 yarn:
   ```bash
   yarn add crypto-js jquery
   ```

   ```js
    import * as Cesium from 'cesium'
    import $ from 'jquery'
    import CryptoJS from 'crypto-js'
    window.$ = $
    window.jQuery = $
    window.Cesium = Cesium
    window.CryptoJS = CryptoJS
    import { createApp } from 'vue'
    import { createPinia } from 'pinia'
    import App from './App.vue'
    import router from './router'
    const app = createApp(App)
    app.use(createPinia())
    app.use(router)
    app.mount('#app')
   ```


2. **初始化插件**

   ```js
   import Creatunion from './Creatunion.js'

   const plugin = new Creatunion({
     viewer: viewer, 
     keplers: [
      {
        "norad_cat_id": "5",
        "time": "2025-06-03T01:07:29.003808Z",
        "step": null,
        "period": null,
        "objectName": "VANGUARD 1",
        "objectType": "Track",
        "region": "美国",
        "isSelf": 0,
        "type": 0,
        "siteName": "美国佛罗里达州空军东部试验场",
        "launch_DATE": "1958-03-17",
        "a": 8618699.612482272,
        "i": 0.5979236217944773,
        "e": 0.1841544,
        "o": 0.7770293096341355,
        "w": 3.9981321826277822,
        "m": 1.981590982178298,
        "periapsis": 649.508,
        "apoapsis": 3822.097
      }
     ],
     cols: {
       PAYLOAD: Cesium.Color.LIME,
       ROCKETBODY: Cesium.Color.ORANGE,
       DEBRIS: Cesium.Color.GRAY,
       TBA: Cesium.Color.WHITE,
       UNKNOWN: Cesium.Color.RED,
       Creatunion: Cesium.Color.CYAN,
       Track: Cesium.Color.BLUE
     },
     staticApi: 'https://XXXXXX/',
     models: {
       PAYLOAD: 'models/payload.glb',
       ROCKETBODY: 'models/rocket.glb',
       DEBRIS: 'models/debris.glb'
     },
     pixelSize: 8,
     outlineWidth: 1,
     token: '加密授权字符串',
     settings: {
       point: true,
       icon: true,
       model: true,
       orbit: true,
       label: true,
       defaultIcon: 'icons/default.png',
       orbitMaterial: Cesium.Color.CYAN
     }
   })
   ```
  
3. **必须字段（字段名不能更改）**
| 字段名           | 说明                           | 作用                           |
|-----------------|--------------------------------|------------------------------|
| `norad_cat_id`  | 卫星/物体编号（字符串或数字）     | 用作实体 ID，关键唯一标识     |
| `time`          | 轨道参数的历元时间               | 转换为 JulianDate 用于初始轨道计算 |
| `a`             | 半长轴（单位：米）               | 轨道计算核心参数（SMA）       |
| `i`             | 轨道倾角（单位：弧度）           | 轨道计算核心参数（Inc）       |
| `e`             | 偏心率                          | 轨道计算核心参数（Ecc）       |
| `o`             | 升交点赤经（RAAN，单位：弧度）    | 轨道计算核心参数（RAAN）      |
| `w`             | 近地点幅角（ArgP，单位：弧度）    | 轨道计算核心参数（ArgP）      |
| `m`             | 平近点角（MeanAnom，单位：弧度）  | 轨道计算核心参数（MeanAnom） |
| `objectName`    | 物体名称                        | 用于实体显示与 label          |
| `objectType`    | 物体类型（如 Track / Payload）   | 用于确定颜色等样式分类       |

4. **动态更新数据**

   ```js
   plugin.reloadPoint(newKeplerArray)
   ```

5. **删除轨道或全部轨道**

   ```js
   plugin._deleteOrbit('12345') // 删除特定轨道
   plugin._deleteOrbit() // 清空全部轨道
   ```
