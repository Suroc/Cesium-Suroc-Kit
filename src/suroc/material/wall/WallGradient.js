/*
 * @Author: Suroc
 * @Date: 2024-07-22 16:23:42
 * @LastEditTime: 2025-01-16 09:33:51
 * @Description: 
 * 
 */
import * as Cesium from 'cesium'
/**
 * @description: 动态立体墙材质
 * @date: 2022-02-11
 */
class WallGradientMaterial {
  constructor(options = {}) {
    this._definitionChanged = new Cesium.Event();
    this._color = undefined;
    this._colorSubscription = undefined;
    this.color = options.color || Cesium.Color.WHITE;
    this.duration = options.duration || 1000;
    this.trailImage = options.trailImage || '/visualization/static/assets/cos.png';
    this._time = Date.now();
  }

  get isConstant() {
    return false;
  }

  get definitionChanged() {
    return this._definitionChanged;
  }

  getType(time) {
    return 'wallMaterial';
  }

  getValue(time, result) {
    if (!Cesium.defined(result)) {
      result = {};
    }
    result.color = Cesium.Property.getValueOrClonedDefault(this._color, time, Cesium.Color.WHITE, result.color);
    result.image = this.trailImage;
    result.time = (((Date.now() - this._time) % this.duration) / this.duration);
    viewer.scene.requestRender();
    return result;
  }

  equals(other) {
    return this === other ||
      (other instanceof WallGradientMaterial && Cesium.Property.equals(this._color, other._color));
  }
}

Object.defineProperties(WallGradientMaterial.prototype, {
  color: Cesium.createPropertyDescriptor('color')
});

Cesium.Material._materialCache.addMaterial('wallMaterial', {
  fabric: {
    type: 'wallMaterial',
    uniforms: {
      color: new Cesium.Color(1.0, 1.0, 1.0, 1),
      image: '/visualization/static/assets/cos.png',
      time: 0
    },
    source: `
      czm_material czm_getMaterial(czm_materialInput materialInput) {
        czm_material material = czm_getDefaultMaterial(materialInput);
        vec2 st = materialInput.st;
        vec4 colorImage = texture(image, vec2(fract(st.t - time), st.t));
        vec4 fragColor;
        fragColor.rgb = color.rgb / 1.0;
        fragColor = czm_gammaCorrect(fragColor);
        material.alpha = colorImage.a * color.a;
        material.diffuse = color.rgb;
        material.emission = fragColor.rgb;
        return material;
      }
    `
  },
});

export default WallGradientMaterial;