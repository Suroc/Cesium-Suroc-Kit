/*
 * @Author: Suroc
 * @Date: 2024-07-30 15:02:31
 * @LastEditTime: 2025-07-14 17:09:42
 * @Description: 函数集
 */
import PolylineTrailMaterial from '../material/line/PolylineTrail.js'

let Object = {}

/**
 * @description 判断星下点是否在区域范围内
 * @param {entity} entitya
 * @param {entity} entityb
 * @param {bottomRadius} 底部半径
 * @param {color} 颜色
 * @param {material}  材质
 */
Object.satelliteBoShu = (options) => {
  let BoShu = viewer.entities.add({
    id: options.id,
    orientation: new Cesium.CallbackProperty(function (time, result) {
      var sourpos = options.entitya.position.getValue(time);
      var cartographic1 = Cesium.Ellipsoid.WGS84.cartesianToCartographic(sourpos);
      var lon1 = Cesium.Math.toDegrees(cartographic1.longitude);
      var lat1 = Cesium.Math.toDegrees(cartographic1.latitude);
      var height1 = cartographic1.height;

      var tarpos = options.entityb.position.getValue(time);
      var cartographic = Cesium.Ellipsoid.WGS84.cartesianToCartographic(tarpos);
      var lon2 = Cesium.Math.toDegrees(cartographic.longitude);
      var lat2 = Cesium.Math.toDegrees(cartographic.latitude);
      var height2 = cartographic.height;

      let m = Object.getModelMatrix(Cesium.Cartesian3.fromDegrees(lon1, lat1, height1), Cesium.Cartesian3.fromDegrees(lon2, lat2, height2));
      let hpr = Object.getDefaultHeadingPitchRoll(m);
      hpr.pitch = hpr.pitch + 3.14 / 2 + 3.14;
      return Cesium.Transforms.headingPitchRollQuaternion(Cesium.Cartesian3.fromDegrees(lon1, lat1, height1), hpr);
    }, false),
    position: new Cesium.CallbackProperty(function (time, result) {
      var sourpos = options.entitya.position.getValue(time);
      var cartographic1 = Cesium.Ellipsoid.WGS84.cartesianToCartographic(sourpos);
      var lon1 = Cesium.Math.toDegrees(cartographic1.longitude);
      var lat1 = Cesium.Math.toDegrees(cartographic1.latitude);
      var height1 = cartographic1.height;

      var tarpos = options.entityb.position.getValue(time);
      var cartographic = Cesium.Ellipsoid.WGS84.cartesianToCartographic(tarpos);
      var lon2 = Cesium.Math.toDegrees(cartographic.longitude);
      var lat2 = Cesium.Math.toDegrees(cartographic.latitude);
      var height2 = cartographic.height;

      return Cesium.Cartesian3.midpoint(Cesium.Cartesian3.fromDegrees(lon1, lat1, height1),
        Cesium.Cartesian3.fromDegrees(lon2, lat2, height2), new Cesium.Cartesian3())
    }, false),
    cylinder: {
      show: new Cesium.CallbackProperty(function (time, result) {
        var sourpos = options.entitya.position.getValue(time);
        var tarpos = options.entityb.position.getValue(time);
        var distance = Cesium.Cartesian3.distance(sourpos, tarpos);
        return distance <= options.apart * 1000; // 范围千米以内显示，超出隐藏
      }, false),
      length: new Cesium.CallbackProperty(function (time, result) {
        var sourpos = options.entitya.position.getValue(time);
        var tarpos = options.entityb.position.getValue(time);
        return Cesium.Cartesian3.distance(sourpos, tarpos);
      }, false),
      topRadius: options.topRadius,
      bottomRadius: options.bottomRadius,
      material: options.material ? options.material : Cesium.Color.fromCssColorString(options.color).withAlpha(0.3),
    },
    polyline: {
      show: options.entityb.type != 'Star',
      positions: new Cesium.CallbackProperty((time) => {
        var sourpos = options.entitya.position.getValue(time);
        var tarpos = options.entityb.position.getValue(time);
        var cartographic1 = Cesium.Ellipsoid.WGS84.cartesianToCartographic(sourpos);
        var cartographic2 = Cesium.Ellipsoid.WGS84.cartesianToCartographic(tarpos);
        var lon1 = Cesium.Math.toDegrees(cartographic1.longitude);
        var lat1 = Cesium.Math.toDegrees(cartographic1.latitude);
        var height1 = cartographic1.height;
        var lon2 = Cesium.Math.toDegrees(cartographic2.longitude);
        var lat2 = Cesium.Math.toDegrees(cartographic2.latitude);
        var height2 = cartographic2.height;
        return Cesium.Cartesian3.fromDegreesArrayHeights([
          lon1, lat1, height1,
          lon2, lat2, height2
        ]);
      }, false),
      width: options.width || 1,
      material: new PolylineTrailMaterial({
        color: options.color || Cesium.Color.RED,
        image: options.image || null,
        speed: options.speed || 1
      }),
    }
  });
  return BoShu
}
/**
 * @description 根据矩阵求方位角
 * @param {m} 矩阵
 */
Object.getDefaultHeadingPitchRoll = (m) => {
  var m1 = Cesium.Transforms.eastNorthUpToFixedFrame(Cesium.Matrix4.getTranslation(m, new Cesium.Cartesian3()), Cesium.Ellipsoid.WGS84, new Cesium.Matrix4());
  var m3 = Cesium.Matrix4.multiply(Cesium.Matrix4.inverse(m1, new Cesium.Matrix4()), m, new Cesium.Matrix4());
  var mat3 = Cesium.Matrix4.getMatrix3(m3, new Cesium.Matrix3());
  var q = Cesium.Quaternion.fromRotationMatrix(mat3);
  var hpr = Cesium.HeadingPitchRoll.fromQuaternion(q);
  return hpr
}
/**
 * @description 两点创建模型矩阵
 * @param {pointA} pointA
 * @param {pointB} pointB
 */
Object.getModelMatrix = (pointA, pointB) => {
  // 向量AB
  const vector2 = Cesium.Cartesian3.subtract(pointB, pointA, new Cesium.Cartesian3());
  //归一化
  const normal = Cesium.Cartesian3.normalize(vector2, new Cesium.Cartesian3());
  // 旋转模型矩阵（rotationMatrixFromPositionVelocity源码方法）
  const rotationMatrix3 = Cesium.Transforms.rotationMatrixFromPositionVelocity(pointA, normal, Cesium.Ellipsoid.WGS84);
  const orientation = Cesium.Quaternion.fromRotationMatrix(rotationMatrix3);
  const modelMatrix4 = Cesium.Matrix4.fromRotationTranslation(rotationMatrix3, pointA);
  const hpr = Cesium.HeadingPitchRoll.fromQuaternion(orientation);
  return modelMatrix4;
}

/**
 * @description 判断星下点是否在区域范围内
 * @param {turf} turf工具
 * @param {points} pointsArr
 * @param {region} regionsArr
 */
Object.getInfrastellarPointRegion = (turf, points, region) => {
  let newPoint = turf.point(points);
  let newRegion = turf.polygon([region]);
  let isInRange = turf.booleanPointInPolygon(newPoint, newRegion);
  return isInRange
}
/**
 * @description 根据两个坐标点,获取Heading(朝向)
 * @param {turf} turf工具
 * @param {pointA} position
 * @param {pointB} position
 * @param {deviation} 偏差度数0-360
 */
Object.getHeadingFace = (turf, pointA, pointB, deviation) => {
  const entityA = turf.point(pointA);
  const entityB = turf.point(pointB);
  const heading = turf.bearing(entityA, entityB);
  return heading + deviation
}
/**
 * @description 根据两个坐标点,获取Heading(朝向)、Pitch(俯仰角)、Roll(滚转角)
 * @param {pointA} position 起始点
 * @param {pointB} position 目标点
 * @param {deviation} 偏差度数0-360
 */
Object.getHeadingPitchRoll = (pointA, pointB, deviation) => {
  // 获取朝向（Heading）
  const heading = Object.getHeadingFace(pointA, pointB, deviation);
  // 计算目标点相对于起始点的向量
  const positionVector = Cesium.Cartesian3.subtract(
    pointB,
    pointA,
    new Cesium.Cartesian3()
  );
  // 计算俯仰角（Pitch）
  const pitch = Math.asin(positionVector.z / Cesium.Cartesian3.magnitude(positionVector));
  // 计算滚转角（Roll），假设没有滚转，默认为 0
  const roll = 0; // 默认没有滚转
  // 返回Heading、Pitch、Roll
  return new Cesium.HeadingPitchRoll(heading, pitch, roll);
}


export default Object
