/*
 * @Author: Suroc
 * @Date: 2025-02-20 14:49:56
 * @LastEditTime: 2025-02-20 15:24:15
 * @Description: 
 */
import * as Cesium from 'cesium';
// new WaveMaterialProperty(
//   new Cesium.Color(0.1, 1, 0, 0.6),
//   10000, // 循环时长
//   1.0, // 速度
//   10, // 圈数
//   0.2 // 环高
// )
export default class WaveMaterialProperty {
  constructor(color = new Cesium.Color(0.1, 1, 0, 1), duration = 10000, d = 1, repeat = 10, thickness = 0.2) {
    this._definitionChanged = new Cesium.Event();
    this._color = color;
    this.duration = duration;
    this._time = (new Date()).getTime();
    this._d = d;
    this._repeat = repeat * 2.0;
    this._thickness = thickness;
    this._initMaterial();
  }

  getType() {
    return 'Wave';
  }

  getValue(time, result) {
    if (!Cesium.defined(result)) {
      result = {};
    }
    result.color = this._color;
    result.repeat = this._repeat;
    result.thickness = this._thickness;
    result.duration = this.duration;
    result.d = this._d;
    result.time = (((new Date()).getTime() - this._time) % this.duration) / this.duration * this._d;
    return result;
  }

  equals(other) {
    return this === other;
  }

  _initMaterial() {
    // 注册一个新的 Wave 材质类型
    Cesium.Material.WaveType = 'Wave';
    Cesium.Material._materialCache.addMaterial(Cesium.Material.WaveType, {
      fabric: {
        type: Cesium.Material.WaveType,
        uniforms: {
          color: this._color,
          repeat: this._repeat,
          time: this._time,
          thickness: this._thickness
        },
        source: `
          uniform vec4 color;
          uniform float repeat;
          uniform float offset;
          uniform float thickness;
          czm_material czm_getMaterial(czm_materialInput materialInput)
          {
            czm_material material = czm_getDefaultMaterial(materialInput);
            float sp = 1.0 / repeat;
            vec2 st = materialInput.st;
            float dis = distance(st, vec2(0.5, 0.5)) + fract(materialInput.s - time);
            float dis2 = distance(st, vec2(0.5, 0.5));
            float m = mod(dis, sp);
            float a = step(m, sp * thickness);
            material.diffuse = color.rgb;
            material.alpha = a * color.a * (1.0 - dis2); // 渐变透明度
            return material;
          }
        `
      },
      translucent() {
        return true;
      }
    });
  }
}
