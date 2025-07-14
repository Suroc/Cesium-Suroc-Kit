/*
 * @Author: Suroc
 * @Date: 2024-05-06 10:20:58
 * @LastEditTime: 2025-02-19 16:58:42
 * @Description: 绘制工具
 */
export default class DrawTool {
  constructor(viewer, callBcak, config) {
    /**cesium实例对象 */
    this.viewer = viewer
    /**绘制要素的相关配置*/
    this.config = config || {
      borderColor: Cesium.Color.fromCssColorString('#FFFF00'),
      borderWidth: 1,
      material: Cesium.Color.fromCssColorString('#FFFF00').withAlpha(0.3),
    }
    this.callback = callBcak
    /**存贮绘制的数据 坐标 */
    this.infoDetail = { point: [], line: [], rectangle: [], circle: [], planeSelf: [] }
    this.handler = null
    this.drawObj = null
  }

  /**
   * @return {*}
   * @author: Suroc
   * @description: 绘制点数据
   */
  drawPoint() {
    this.removeEntity()
    this.handler.setInputAction((click) => {
      if (click && click.position) {
        /**点击位置笛卡尔坐标 */
        let cartesian = this.viewer.camera.pickEllipsoid(click.position, this.viewer.scene.globe.ellipsoid)
        /**笛卡尔转弧度坐标 */
        if (!cartesian) return
        let cartographic = Cesium.Cartographic.fromCartesian(cartesian, this.viewer.scene.globe.ellipsoid, new Cesium.Cartographic())
        /**点击位置经度 */
        let lon = Cesium.Math.toDegrees(cartographic.longitude)
        /**点击位置维度 */
        let lat = Cesium.Math.toDegrees(cartographic.latitude)
        /**实体的唯一标注 */
        let id = new Date().getTime()
        this.viewer.entities.add({
          position: Cesium.Cartesian3.fromDegrees(lon, lat, 0),
          name: 'point',
          id: id,
          point: {
            color: this.config.material,
            pixelSize: 12,
            outlineColor: this.config.borderColor,
            outlineWidth: this.config.borderWidth
          }
        })
        this.infoDetail.point = { id: id, positions: [lon, lat] }
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

    this.handler.setInputAction(() => {
      this.handler.destroy();
      if (typeof this.callback == "function") {
        this.callback(this.infoDetail.point);
      }
      setTimeout(() => {
        this.handler = null
      }, 1);
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK)
  }

  /**
   * @return {*}
   * @author: Suroc
   * @description: 绘制线段
   */
  drawLine() {
    this.removeEntity()
    /**实体的唯一标注 */
    let id = null
    /**记录拐点坐标 */
    let positions = [],
      /**记录返回结果 */
      codeInfo = [],
      /**面的hierarchy属性 */
      polygon = new Cesium.PolygonHierarchy(),
      _polygonEntity = new Cesium.Entity()
    // left
    id = new Date().getTime()
    this.handler.setInputAction((movement) => {
      if (movement && movement.position) {
        let cartesian = this.viewer.camera.pickEllipsoid(movement.position, this.viewer.scene.globe.ellipsoid);
        if (!cartesian) return
        let cartographic = Cesium.Cartographic.fromCartesian(cartesian, this.viewer.scene.globe.ellipsoid, new Cesium.Cartographic())
        let lon = Cesium.Math.toDegrees(cartographic.longitude)
        let lat = Cesium.Math.toDegrees(cartographic.latitude)
        if (cartesian && cartesian.x) {
          if (positions.length == 0) {
            positions.push(cartesian.clone());
          }
          codeInfo.push([lon, lat])
          positions.push(cartesian.clone());
          polygon.positions.push(cartesian.clone())
          if (!this.drawObj) {
            _polygonEntity.polyline = {
              width: this.config.borderWidth,
              material: this.config.borderColor,
              clampToGround: false
            }
            _polygonEntity.polyline.positions = new Cesium.CallbackProperty(function () {
              return positions
            }, false)
            _polygonEntity.name = 'line'
            _polygonEntity._id = id

            this.drawObj = this.viewer.entities.add(_polygonEntity)
          }
        }
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    // mouse
    this.handler.setInputAction((movement) => {
      if (movement && movement.endPosition) {
        let cartesian = this.viewer.camera.pickEllipsoid(movement.endPosition, this.viewer.scene.globe.ellipsoid);
        if (!cartesian) return
        let cartographic = Cesium.Cartographic.fromCartesian(cartesian, this.viewer.scene.globe.ellipsoid, new Cesium.Cartographic())
        let lon = Cesium.Math.toDegrees(cartographic.longitude)
        let lat = Cesium.Math.toDegrees(cartographic.latitude)

        if (positions.length >= 0) {
          if (cartesian && cartesian.x) {
            positions.pop()
            positions.push(cartesian);
            codeInfo.pop()
            codeInfo.push([lon, lat]);
          }
        }
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    // right
    this.handler.setInputAction(() => {
      this.infoDetail.line = { id: id, positions: codeInfo }
      this.handler.destroy();
      this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas)
      if (typeof this.callback == "function") {
        this.callback(this.infoDetail.line);
      }
      setTimeout(() => {
        this.handler = null
      }, 1);
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
  }

  /**
 * @description: 绘制矩形区域(优化版)
 * @return {*}
 * @author: Suroc
 */
  drawRect() {
    let _self = this;
    let pointsArr = [];
    let _selfPoints = []
    let _selfRect = null
    let id = new Date().getTime()
    var tempPosition;
    //鼠标左键单击画点
    this.handler.setInputAction((click) => {
      tempPosition = _self.getPointFromWindowPoint(click.position);
      //选择的点在球面上
      if (tempPosition) {
        if (_selfPoints.length == 0) {
          let cartesian = this.viewer.camera.pickEllipsoid(click.position, this.viewer.scene.globe.ellipsoid)
          if (!cartesian) return
          /**笛卡尔转弧度坐标 */
          let cartographic = Cesium.Cartographic.fromCartesian(cartesian, this.viewer.scene.globe.ellipsoid, new Cesium.Cartographic())
          /**点击位置经度 */
          let lng1 = Cesium.Math.toDegrees(cartographic.longitude)
          /**点击位置维度 */
          let lat1 = Cesium.Math.toDegrees(cartographic.latitude)
          pointsArr.push(lng1);
          pointsArr.push(lat1);
          _selfPoints.push(_self.viewer.scene.globe.ellipsoid.cartesianToCartographic(tempPosition));
          _selfRect = Cesium.Rectangle.fromCartographicArray(_selfPoints);
          _selfRect.east += 0.000001;
          _selfRect.north += 0.000001;
          this.drawObj = _self.viewer.entities.add({
            id: id,
            rectangle: {
              coordinates: _selfRect,
              material: this.config.material,
              outline: true,
              outlineWidth: 10,
              outlineColor: this.config.borderColor,
              height: 0
            }
          });
        }
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    //鼠标移动

    this.handler.setInputAction((movement) => {
      if (_selfPoints.length == 0) {
        return;
      }
      var moveEndPosition = _self.getPointFromWindowPoint(movement.endPosition);
      //选择的点在球面上
      if (moveEndPosition) {
        let cartesian = this.viewer.camera.pickEllipsoid(movement.endPosition, this.viewer.scene.globe.ellipsoid)
        if (!cartesian) return
        /**笛卡尔转弧度坐标 */
        let cartographic = Cesium.Cartographic.fromCartesian(cartesian, this.viewer.scene.globe.ellipsoid, new Cesium.Cartographic())
        /**点击位置经度 */
        let lng1 = Cesium.Math.toDegrees(cartographic.longitude)
        /**点击位置维度 */
        let lat1 = Cesium.Math.toDegrees(cartographic.latitude)
        pointsArr[2] = lng1;
        pointsArr[3] = lat1;
        _selfPoints[1] = _self.viewer.scene.globe.ellipsoid.cartesianToCartographic(moveEndPosition);
        _selfRect = Cesium.Rectangle.fromCartographicArray(_selfPoints);
        if (_selfRect.west == _selfRect.east)
          _selfRect.east += 0.000001;
        if (_selfRect.south == _selfRect.north)
          _selfRect.north += 0.000001;
        this.drawObj.rectangle.coordinates = _selfRect;
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
    this.handler.setInputAction((click) => {
      tempPosition = _self.getPointFromWindowPoint(click.position);
      if (tempPosition) {
        if (_selfPoints.length > 0) {
          this.handler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
          this.handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
        }
      }
      this.infoDetail.rectangle = {
        id: id, positions: [
          {
            lon: pointsArr[0],
            lat: pointsArr[1],
          },
          {
            lon: pointsArr[2],
            lat: pointsArr[1],
          },
          {
            lon: pointsArr[2],
            lat: pointsArr[3],
          },
          {
            lon: pointsArr[0],
            lat: pointsArr[3],
          },
        ],
      }
      this.handler.destroy();
      this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas)
      if (typeof this.callback == "function") {
        this.callback(this.infoDetail.rectangle);
      }
      setTimeout(() => {
        this.handler = null
      }, 1);
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK)
  }

  //验证选择的点在球面上
  getPointFromWindowPoint(point) {
    if (this.viewer.scene.terrainProvider.constructor.name == "EllipsoidTerrainProvider") {
      return this.viewer.camera.pickEllipsoid(point, this.viewer.scene.globe.ellipsoid);
    } else {
      var ray = this.viewer.scene.camera.getPickRay(point);
      return this.viewer.scene.globe.pick(ray, this.viewer.scene);
    }
  }

  /**
   * @description: 绘制矩形区域
   * @return {*}
   * @author: Suroc
   */
  drawRectangle() {
    this.removeEntity()
    /**
     * 矩形四点坐标
     */
    let westSouthEastNorth = []
    /**实体的唯一标注 */
    let id = null
    /**地图点击对象 */
    this.handler.setInputAction((click) => {
      if (click && click.position) {
        /**点击位置笛卡尔坐标 */
        let cartesian = this.viewer.camera.pickEllipsoid(click.position, this.viewer.scene.globe.ellipsoid)
        if (!cartesian) return
        /**笛卡尔转弧度坐标 */
        let cartographic = Cesium.Cartographic.fromCartesian(cartesian, this.viewer.scene.globe.ellipsoid, new Cesium.Cartographic())
        /**点击位置经度 */
        let lng1 = Cesium.Math.toDegrees(cartographic.longitude)
        /**点击位置维度 */
        let lat1 = Cesium.Math.toDegrees(cartographic.latitude)
        /**边框坐标 */
        westSouthEastNorth = [lng1, lat1]
        id = new Date().getTime()
        if (westSouthEastNorth) {
          this.handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK)
        }
        /**面实例对象 */
        this.drawObj = this.viewer.entities.add({
          name: 'rectangle',
          id: id,
          polygon: {
            hierarchy: new Cesium.CallbackProperty(function () {
              return {
                positions: Cesium.Cartesian3.fromDegreesArray(westSouthEastNorth)
              }
            }, false),
            height: 0,
            // 填充的颜色，withAlpha透明度
            material: this.config.material,
            // 是否被提供的材质填充
            fill: true,
            // 是否显示
            show: true,
          },
          polyline: {
            positions: new Cesium.CallbackProperty(function () { return Cesium.Cartesian3.fromDegreesArray(westSouthEastNorth) }, false),
            material: this.config.borderColor,
            width: this.config.borderWidth,
            zIndex: 1
          }
        })
        this.handler.setInputAction((move) => {
          if (move && move.endPosition) {
            let cartesian = this.viewer.camera.pickEllipsoid(move.endPosition, this.viewer.scene.globe.ellipsoid)
            if (!cartesian) return
            let cartographic = Cesium.Cartographic.fromCartesian(cartesian, this.viewer.scene.globe.ellipsoid, new Cesium.Cartographic())
            let lon = Cesium.Math.toDegrees(cartographic.longitude)
            let lat = Cesium.Math.toDegrees(cartographic.latitude)
            westSouthEastNorth = [lng1, lat1, lng1, lat, lon, lat, lon, lat1, lng1, lat1]
          }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE)
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

    this.handler.setInputAction(() => {
      this.infoDetail.rectangle = {
        id: id, positions: [
          {
            lon: westSouthEastNorth[0],
            lat: westSouthEastNorth[1],
          },
          {
            lon: westSouthEastNorth[6],
            lat: westSouthEastNorth[7],
          },
          {
            lon: westSouthEastNorth[4],
            lat: westSouthEastNorth[5],
          },
          {
            lon: westSouthEastNorth[2],
            lat: westSouthEastNorth[3],
          },
        ],
        westSouthEastNorth: westSouthEastNorth
      }
      this.handler.destroy();
      this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas)
      if (typeof this.callback == "function") {
        this.callback(this.infoDetail.rectangle);
      }
      setTimeout(() => {
        this.handler = null
      }, 1);
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK)
  }

  /**
   * @description: 绘制圆形区域
   * @return {*}
   * @author: Suroc
   */
  drawCircle() {
    this.removeEntity()
    /**实体的唯一标注 */
    let id = null

    /**圆半径 */
    let radius = 0
    /**圆心 */
    let lngLat = []
    /**鼠标事件 */
    id = new Date().getTime()
    this.handler.setInputAction((click) => {
      if (click && click.position) {
        let cartesian = this.viewer.camera.pickEllipsoid(click.position, this.viewer.scene.globe.ellipsoid)
        if (!cartesian) return
        let cartographic = Cesium.Cartographic.fromCartesian(cartesian, this.viewer.scene.globe.ellipsoid, new Cesium.Cartographic())
        let lon = Cesium.Math.toDegrees(cartographic.longitude)
        let lat = Cesium.Math.toDegrees(cartographic.latitude)
        lngLat = [lon, lat]
        this.drawObj = this.viewer.entities.add({
          position: new Cesium.CallbackProperty(function () { return new Cesium.Cartesian3.fromDegrees(...lngLat, 0) }, false),
          name: 'circle',
          id: id,
          ellipse: {
            width: this.config.borderWidth,
            height: 0,
            outline: true,
            material: this.config.material,
            outlineColor: this.config.borderColor,
            outlineWidth: this.config.borderWidth
          }
        })
        this.drawObj.ellipse.semiMajorAxis = new Cesium.CallbackProperty(function () { return radius }, false)
        this.drawObj.ellipse.semiMinorAxis = new Cesium.CallbackProperty(function () { return radius }, false)

        if (lngLat) {
          this.handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK)
        }
        this.handler.setInputAction((move) => {
          if (move && move.endPosition) {
            let cartesian2 = this.viewer.camera.pickEllipsoid(move.endPosition, this.viewer.scene.globe.ellipsoid)
            if (!cartesian2) return
            radius = Cesium.Cartesian3.distance(cartesian, cartesian2)
          }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE)
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

    this.handler.setInputAction(() => {
      this.infoDetail.circle = { id: id, center: lngLat, radius: radius }
      this.handler.destroy();
      this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas)
      if (typeof this.callback == "function") {
        this.callback(this.infoDetail.circle);
      }
      setTimeout(() => {
        this.handler = null
      }, 1);
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK)


  }

  /**
 * @description: 绘制多边形区域（圆）
 * @params {Number} radius 半径
 * @params {Number} steps  步长
 * @params {Number} turf   turf工具
 * @return {*}
 * @author: Suroc
 */
  drawCirclePlane(turf, radius, steps) {
    this.removeEntity()
    /**实体的唯一标注 */
    let id = null
    /**记录拐点坐标 */
    let positions = []
    /**圆心 */
    let lngLat = []
    let polygon = []
    /**配置 */
    let options = { steps: steps, units: "kilometers", properties: { foo: "bar" } };
    id = new Date().getTime()
    this.handler.setInputAction((click) => {
      if (click && click.position) {
        if (this.drawObj) this.viewer.entities.remove(this.drawObj)
        let cartesian = this.viewer.camera.pickEllipsoid(click.position, this.viewer.scene.globe.ellipsoid)
        if (!cartesian) return
        let cartographic = Cesium.Cartographic.fromCartesian(cartesian, this.viewer.scene.globe.ellipsoid, new Cesium.Cartographic())
        let lon = Cesium.Math.toDegrees(cartographic.longitude)
        let lat = Cesium.Math.toDegrees(cartographic.latitude)
        lngLat = [lon, lat]
        let turfPos = turf.circle(lngLat, radius, options);
        let convertedCoords = turfPos.geometry.coordinates[0];
        positions = convertedCoords.map(coord => ([
          coord[0], coord[1]
        ]));
        if (positions.length > 2) {
          polygon = positions.map(coord => {
            return Cesium.Cartesian3.fromDegrees(coord[0], coord[1], 0);
          });
          this.drawObj = this.viewer.entities.add({
            id: id,
            name: 'planeSelf',
            polyline: {
              width: this.config.borderWidth - 0.5,
              material: this.config.borderColor,
              clampToGround: false,
              positions: polygon
            },
            polygon: {
              hierarchy: new Cesium.PolygonHierarchy(polygon),
              material: this.config.material,
              clampToGround: false,
            }
          });
        }
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
    this.handler.setInputAction(() => {
      this.infoDetail.planeSelf = { id: id, center: lngLat, positions: positions }
      this.handler.destroy();
      this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas)
      if (typeof this.callback == "function") {
        this.callback(this.infoDetail.planeSelf);
      }
      setTimeout(() => {
        this.handler = null
      }, 1);
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);

  }

  /**
   * @description: 自定义区域绘制
   * @return {*}
   * @author: Suroc
   */
  drawPlane() {
    this.removeEntity()
    /**实体的唯一标注 */
    let id = new Date().getTime()
    /**记录拐点坐标 */
    let positions = [],
      /**记录返回结果 */
      codeInfo = [],
      /**面的hierarchy属性 */
      polygon = new Cesium.PolygonHierarchy()
    // left
    this.handler.setInputAction((movement) => {
      if (movement && movement.position) {
        let cartesian = this.viewer.camera.pickEllipsoid(movement.position, this.viewer.scene.globe.ellipsoid);
        if (!cartesian) return
        let cartographic = Cesium.Cartographic.fromCartesian(cartesian, this.viewer.scene.globe.ellipsoid, new Cesium.Cartographic())
        if (!cartographic) return
        let lon = Cesium.Math.toDegrees(cartographic.longitude)
        let lat = Cesium.Math.toDegrees(cartographic.latitude)
        if (cartesian && cartesian.x) {
          if (positions.length == 0) {
            positions.push(cartesian.clone());
          }
          codeInfo.push({ lon: lon, lat: lat })
          positions.push(cartesian.clone());
          polygon.positions.push(cartesian.clone())
          if (!this.drawObj) {
            this.drawObj = this.viewer.entities.add({
              id: id,
              name: 'planeSelf',
              polyline: {
                width: this.config.borderWidth - 0.5,
                material: this.config.borderColor,
                clampToGround: false,
                positions: new Cesium.CallbackProperty(() => {
                  return positions
                }, false)
              },
              polygon: {
                hierarchy: new Cesium.CallbackProperty(() => {
                  return polygon
                }, false),
                material: this.config.material,
                clampToGround: false,
              }
            });
          }
        }
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    // mouse
    this.handler.setInputAction((movement) => {
      if (movement && movement.endPosition) {
        let cartesian = this.viewer.camera.pickEllipsoid(movement.endPosition, this.viewer.scene.globe.ellipsoid);
        if (!cartesian) return
        let cartographic = Cesium.Cartographic.fromCartesian(cartesian, this.viewer.scene.globe.ellipsoid, new Cesium.Cartographic())
        let lon = Cesium.Math.toDegrees(cartographic.longitude)
        let lat = Cesium.Math.toDegrees(cartographic.latitude)
        if (positions.length >= 0) {
          if (cartesian && cartesian.x) {
            positions.pop()
            positions.push(cartesian);
            polygon.positions.pop()
            polygon.positions.push(cartesian);
            codeInfo.pop()
            codeInfo.push({ lon: lon, lat: lat })
          }
        }
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
    // RIGHT
    this.handler.setInputAction(() => {
      codeInfo.push(codeInfo[0]);
      this.infoDetail.planeSelf = { id: id, positions: codeInfo }
      this.handler.destroy();
      this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas)
      if (typeof this.callback == "function") {
        this.callback(this.infoDetail.planeSelf);
      }
      setTimeout(() => {
        this.handler = null
      }, 1);
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
  }

  /**
   * @description: 移除实体对象
   * @return {*}
   * @author: Suroc
   */
  removeEntity() {
    if (this.drawObj) this.viewer.entities.remove(this.drawObj)
    this.drawObj = null
    if (this.handler) this.handler.destroy();
    this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas)
  }

  /**
   * @return {*}
   * @author: Suroc
   * @description: 返回绘制数据
   */
  backInfoDetail() {
    return this.infoDetail
  }
}
