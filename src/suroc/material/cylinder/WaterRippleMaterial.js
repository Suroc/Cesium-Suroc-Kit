/*
 * @Author: Suroc
 * @Date: 2025-02-20 14:49:56
 * @LastEditTime: 2025-02-20 15:24:15
 * @Description: 
 */
import * as Cesium from 'cesium';
// material: new WaterRippleMaterialProperty(
//   new Cesium.Color(0.1, 1, 0, 0.6),
//   3000, // 循环时长
//   1, // 波纹扩散速度
//   8, // 波纹频率
//   1 // 波纹幅度
// ),
export default class WaterRippleMaterialProperty {
  constructor(color = new Cesium.Color(0.1, 1, 0, 1), duration = 10000, rippleSpeed = 1.0, rippleFrequency = 10, rippleAmplitude = 0.2) {
    this._definitionChanged = new Cesium.Event();
    this._color = color;
    this.duration = duration;
    this._time = (new Date()).getTime();
    this._rippleSpeed = rippleSpeed;
    this._rippleFrequency = rippleFrequency;
    this._rippleAmplitude = rippleAmplitude;
    this._initMaterial();
  }

  getType() {
    return 'WaterRippleCylinder';
  }

  getValue(time, result) {
    if (!Cesium.defined(result)) {
      result = {};
    }
    result.color = this._color;
    result.rippleSpeed = this._rippleSpeed;
    result.rippleFrequency = this._rippleFrequency;
    result.rippleAmplitude = this._rippleAmplitude;
    result.time = (((new Date()).getTime() - this._time) % this.duration) / this.duration * this._rippleSpeed;
    return result;
  }

  equals(other) {
    return this === other;
  }

  _initMaterial() {
    // 注册一个新的 WaterRippleCylinder 材质类型
    Cesium.Material.WaterRippleCylinderType = 'WaterRippleCylinder';
    Cesium.Material._materialCache.addMaterial(Cesium.Material.WaterRippleCylinderType, {
      fabric: {
        type: Cesium.Material.WaterRippleCylinderType,
        uniforms: {
          color: this._color,
          rippleSpeed: this._rippleSpeed,
          rippleFrequency: this._rippleFrequency,
          rippleAmplitude: this._rippleAmplitude,
          time: this._time
        },
        source: `
          uniform vec4 color;
          uniform float rippleSpeed;
          uniform float rippleFrequency;
          uniform float rippleAmplitude;
          uniform float time;

          czm_material czm_getMaterial(czm_materialInput materialInput)
          {
            czm_material material = czm_getDefaultMaterial(materialInput);

            // 计算波纹的动态效果
            float rippleEffect = sin(time * rippleSpeed + length(materialInput.st - vec2(0.5, 0.5)) * rippleFrequency);
            float alpha = rippleAmplitude * abs(rippleEffect); // 控制波纹的透明度

            material.diffuse = color.rgb;
            material.alpha = alpha * color.a; // 波纹的透明度

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
