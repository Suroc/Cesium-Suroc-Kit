import * as Cesium from 'cesium';

class PolylineTrailMaterial {
  constructor(options) {
    this._definitionChanged = new Cesium.Event();
    this._color = undefined;
    this._colorSubscription = undefined;
    this.color = options.color || new Cesium.Color(0, 0, 0, 0.01);
    this.image = options.image; // 动态传入的图片路径
    this.duration = options.duration || 10000; // 默认持续时间为10秒
    this._time = (new Date()).getTime();
  }

  get isConstant() {
    return false;
  }

  get definitionChanged() {
    return this._definitionChanged;
  }

  getType(time) {
    return 'PolylineTrailLink';
  }

  getValue(time, result) {
    if (!Cesium.defined(result)) {
      result = {};
    }
    result.color = Cesium.Property.getValueOrClonedDefault(this._color, time, Cesium.Color.WHITE, result.color);
    result.image = this.image; // 动态设置图片
    result.time = (((new Date()).getTime() - this._time) % this.duration) / this.duration;
    return result;
  }

  equals(other) {
    return this === other ||
      (other instanceof PolylineTrailMaterial &&
        Cesium.Property.equals(this._color, other._color));
  }
}

// 注册材质类型
Cesium.Material.PolylineTrailLinkType = 'PolylineTrailLink';

Cesium.Material.PolylineTrailLinkSource = `
czm_material czm_getMaterial(czm_materialInput materialInput)
{
    czm_material material = czm_getDefaultMaterial(materialInput);
    vec2 st = materialInput.st;
    vec4 colorImage = texture(image, vec2(fract(st.s - time), st.t));
    material.alpha = colorImage.a * color.a;
    material.diffuse = (colorImage.rgb + color.rgb) / 2.0;
    return material;
}`;

Cesium.Material._materialCache.addMaterial(Cesium.Material.PolylineTrailLinkType, {
  fabric: {
    type: Cesium.Material.PolylineTrailLinkType,
    uniforms: {
      color: new Cesium.Color(0, 0, 0, 0.01),
      image: '', // 这里不需要设置默认图片，因为图片会动态传入
      time: 0
    },
    source: Cesium.Material.PolylineTrailLinkSource
  },
  translucent: function (material) {
    return true;
  }
});

export default PolylineTrailMaterial;