/*
 * @Author: Suroc
 * @Date: 2024-07-30 15:02:31
 * @LastEditTime: 2025-02-12 15:36:58
 * @Description: 函数集
 */
import * as turf from '@turf/turf';
import WallGradientMaterial from '../material/wall/WallGradient.js'
import PolylineTrailMaterial from '../material/line/PolylineTrail.js'
let Object = {}

/**
 * @description 初始化六边形
 * @param {viewer} 操作容器
 * @param {CallbackProperty} 发送点-pointA/接收点-pointB
 * @param {options} 自定义样式
 */
Object.initTransmitData = (viewer, CallbackProperty, options) => {
  viewer.entities.add({
    id: options.id,
    type: 'TransmitData',
    polyline: {
      positions: CallbackProperty,
      width: options.width || 1,
      material: new PolylineTrailMaterial({
        color: options.color || Cesium.Color.RED,
        image: options.image || null,
        speed: options.speed || 1
      }),
    }
  });
}

/**
 * @description 初始化六边形
 * @param {viewer} 操作容器
 * @param {item} 区域信息
 * @param {options} 自定义样式
 */
Object.initHexagon = (viewer, item, options) => {
  let cartesianPositions = item.positions.map((pos) => {
    return Cesium.Cartesian3.fromDegrees(pos[0], pos[1])
  })
  let wallEntity = viewer.entities.add({
    id: options.id,
    type: 'Hexagon',
    wall: {
      width: options.width || 1,
      positions: cartesianPositions,
      // 设置高度
      minimumHeights: new Array(cartesianPositions.length).fill(options.minimumHeights || 1),
      maximumHeights: new Array(cartesianPositions.length).fill(options.maximumHeights || 10000),
      material: new WallGradientMaterial({
        color: options.color || Cesium.Color.GREEN.withAlpha(0.5),
        duration: options.duration || 3000,
        trailImage: options.trailImage || null
      })
    },
    polygon: {
      hierarchy: new Cesium.PolygonHierarchy(
        Cesium.Cartesian3.fromDegreesArray(item.positions.flatMap((coord) => [coord[0], coord[1]]))
      ),
      outline: options.outline || false,
      outlineColor: options.outlineColor || Cesium.Color.WHITE,
      outlineWidth: options.outlineWidth || 4,
      material: options.pgColor || Cesium.Color.GREEN.withAlpha(0.2)
    }
  })
  return wallEntity
}
/**
 * @description 选中/取消选中
 * @param {viewer} 操作容器
 * @param {flag} 是否开启
 * @param {id} id
 * @param {options} 自定义样式
 */
Object.activeHexagon = (viewer, flag, id, options) => {
  let x = 0.3;
  let flog = true;
  const wallEntity = viewer.entities.getById(id);
  if (!wallEntity) return
  wallEntity.wall.material = new WallGradientMaterial({
    color: options.color ? options.color : Cesium.Color.RED.withAlpha(0.5),
    duration: options.duration ? options.duration : 3000,
    trailImage: options.trailImage ? options.trailImage : wallEntity.wall.trailImage,
  });
  if (flag) {
    wallEntity.polygon.material = new Cesium.ColorMaterialProperty(
      new Cesium.CallbackProperty(() => {
        if (flog) {
          x = x - 0.01;
          if (x <= 0.08) {
            flog = false;
          }
        } else {
          x = x + 0.01;
          if (x >= 0.3) {
            flog = true;
          }
        }
        return options.polygonMaterial ? options.polygonMaterial.withAlpha(x) : Cesium.Color.RED.withAlpha(x);
      }, false)
    );
  } else {
    wallEntity.polygon.material = new Cesium.ColorMaterialProperty(options.polygonMaterial ? options.polygonMaterial : Cesium.Color.RED.withAlpha(0.3));
  }
}
/**
 * @description 绘制倒锥标记
 * @param {viewer} 操作容器
 * @param {id} 区域ID
 */
Object.drawBackTaper = (viewer, options) => {
  let start = 0
  let Yoffset = 0
  let maxoffset = 300 * 1000
  let isUp = true
  let cylinderEntity = viewer.entities.add({
    id: options.id,
    position: new Cesium.CallbackProperty(() => {
      if (isUp) {
        Yoffset += 1500
      } else {
        Yoffset -= 1500
      }
      if (Yoffset >= maxoffset) {
        isUp = false
      }
      if (Yoffset <= -1) {
        isUp = true
      }
      return Cesium.Cartesian3.fromDegrees(options.lon, options.lat, options.alt);
    }, false),
    orientation: new Cesium.CallbackProperty(() => {
      start += 1
      let roll = Cesium.Math.toRadians(start)
      Cesium.Math.zeroToTwoPi(roll)
      return Cesium.Transforms.headingPitchRollQuaternion(
        Cesium.Cartesian3.fromDegrees(options.lon, options.lat, options.alt),
        new Cesium.HeadingPitchRoll(roll, 0, 0.0)
      )
    }, false),
    cylinder: {
      length: 300 * 1000,
      topRadius: 180 * 1000,
      bottomRadius: 0,
      slices: 4,
      outline: true,
      outlineColor: Cesium.Color.LIME,
      material: Cesium.Color.AQUAMARINE.withAlpha(0.5)
    }
  });

  return cylinderEntity
}

/**
 * @description 删除图形
 * @param {viewer} 操作容器
 * @param {id} 区域ID
 */
Object.removeDraws = (viewer, id) => {
  if (!areasID || !areasID.length) return
  areasID.map(item => {
    if (id) {
      if (item === id) {
        const wallEntity = viewer.entities.getById(`wall_${id}`);
        const labelEntity = viewer.entities.getById(`label_${id}`);
        const polygonEntity = viewer.entities.getById(`polygon_${id}`);
        const cylinderEntity = viewer.entities.getById(`cylinder_${id}`);
        viewer.entities.remove(wallEntity)
        viewer.entities.remove(labelEntity)
        viewer.entities.remove(polygonEntity)
        viewer.entities.remove(cylinderEntity)
      }
    } else {
      const wallEntity = viewer.entities.getById(`wall_${item}`);
      const labelEntity = viewer.entities.getById(`label_${item}`);
      const polygonEntity = viewer.entities.getById(`polygon_${item}`);
      const cylinderEntity = viewer.entities.getById(`cylinder_${item}`);
      viewer.entities.remove(wallEntity)
      viewer.entities.remove(labelEntity)
      viewer.entities.remove(polygonEntity)
      viewer.entities.remove(cylinderEntity)
    }
  })
}
/**
 * @description 计算中心点
 * @param {Pos} 多边形坐标
 */
Object.centroidPoint = (Pos) => {
  const polygon = turf.polygon([Pos]);
  // 计算多边形的中心点
  const centroid = turf.centroid(polygon);
  return {
    lon: centroid.geometry.coordinates[0],
    lat: centroid.geometry.coordinates[1],
  }
}
/**
 * @description 目标动态悬停
 */
Object.updatePosition = () => {
  let hoverDirection = 1; // 1表示向上，-1表示向下
  let hoverHeight = 10; // 悬停的最大高度
  let hoverSpeed = 1; // 悬停的速度（秒）
  viewer.clock.onTick.addEventListener(() => {
    const time = Cesium.JulianDate.now();
    const position = entity.position.getValue(Cesium.JulianDate.now());
    const height = position.z;
    const newHeight = height + hoverDirection * hoverSpeed;

    if (newHeight >= 1000 + hoverHeight || newHeight <= 1000 - hoverHeight) {
      hoverDirection *= -1; // 反向悬停
    }
    entity.position = Cesium.Cartesian3.fromDegrees(pointPos.lon, pointPos.lat, newHeight);
  });
};

/**
 * @description 雷达扫描卫星
 * @param {pos} 位置信息
 * @param {radarLength} 雷达波的扩展长度
 * @param {radarRadius} 雷达图形的底部半径
 * @param {options} 雷达图形的底部半径
 */
Object.customRadar = (pos, radarLength = 1000000.0, radarRadius = 200000.0, options) => {
  // 创建一个圆锥体的几何体
  const coneGeometry = new Cesium.CylinderGeometry({
    length: radarLength, // 圆锥的高度
    topRadius: 0.0, // 圆锥顶端的半径，0表示尖顶
    bottomRadius: radarRadius, // 圆锥底部的半径
    vertexFormat: Cesium.VertexFormat.POSITION_AND_NORMAL // 顶点格式包含位置和法线
  });

  // 创建 GeometryInstance 实例，并指定其位置、颜色等属性
  const redCone = new Cesium.GeometryInstance({
    geometry: coneGeometry,  // 圆锥几何体
    modelMatrix: Cesium.Matrix4.fromTranslation(pos),  // 位置
    attributes: {
      color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.RED)  // 设置圆锥的颜色为红色
    }
  });
  const materialSource = `
    uniform vec4 color;
    uniform float repeat;
    uniform float offset;
    uniform float thickness;
    czm_material czm_getMaterial(czm_materialInput materialInput) {
        czm_material material = czm_getDefaultMaterial(materialInput);
        float sp = 1.0 / repeat;
        vec2 st = materialInput.st;
        float dis = distance(st, vec2(0.5));
        float m = mod(dis + offset, sp);
        float a = step(sp * (1.0 - thickness), m);
        material.diffuse = color.rgb;
        material.alpha = a * color.a;
        vec3 normalMC = material.normal;
        if (normalMC.y < 0.0 && normalMC.z < 0.0) { 
            discard;
        }
        return material;
    }
`;
  const vertexShaderSource = `
    in vec3 position3DHigh;
    in vec3 position3DLow;
    in vec3 normal;
    in vec2 st;
    in float batchId;

    out vec3 v_positionEC;
    out vec3 v_normalEC;
    out vec2 v_st;

    void main() {
        vec4 p = czm_computePosition();
        v_positionEC = (czm_modelViewRelativeToEye * p).xyz;
        v_normalEC = normal;
        v_st = st;
        gl_Position = czm_modelViewProjectionRelativeToEye * p;
    }
`;
  const material = new Cesium.Material({
    fabric: {
      uniforms: { color: options.color, repeat: options.repeat, offset: options.offset, thickness: options.thickness },
      source: materialSource,
    },
    translucent: true,
  });
  const appearance = new Cesium.MaterialAppearance({
    material,
    vertexShaderSource,
    faceForward: false,
    closed: true,
  });
  let radarPrimitive = viewer.scene.primitives.add(
    new Cesium.Primitive({
      geometryInstances: redCone,
      appearance,
    })
  );
  viewer.scene.primitives.add(radarPrimitive);
  return radarPrimitive;
};

export default Object
