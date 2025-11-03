/*
 * @Author: Suroc
 * @Date: 2024-05-06 10:20:58
 * @LastEditTime: 2025-08-21 11:00:00
 * @Description: Cesium绘制工具 - 提供点、线、矩形、圆形、多边形等绘制功能
 */
class DrawTool {
    viewer;
    config;
    callback;
    infoDetail;
    handler;
    drawObj;
    constructor(viewer, callback, config) {
        if (!viewer) {
            throw new Error('Cesium Viewer instance is required');
        }
        /**cesium实例对象 */
        this.viewer = viewer;
        /**绘制要素的相关配置*/
        this.config = {
            borderColor: config?.borderColor || Cesium.Color.fromCssColorString('#FFFF00'),
            borderWidth: config?.borderWidth || 1,
            material: config?.material || Cesium.Color.fromCssColorString('#FFFF00').withAlpha(0.3),
            turf: config?.turf,
        };
        this.callback = callback || null;
        /**存储绘制的数据坐标 */
        this.infoDetail = { point: [], line: [], rectangle: [], circle: [], planeSelf: [] };
        this.handler = null;
        this.drawObj = null;
        // 初始化事件处理器
        this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
    }
    /**
     * @description: 显示鼠标提示
     * @param {string} tipText - 提示文本
     */
    showMouseTip(tipText) {
        let tip = document.getElementById('cesium-mouse-tip');
        if (!tip) {
            tip = document.createElement('div');
            tip.id = 'cesium-mouse-tip';
            tip.style.cssText = `
      width:200px;
      text-align: center;
      position: fixed;
      z-index: 999999;
      pointer-events: none;
      background: rgba(0,0,0,0.5);
      color: #fff;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 10px;
      user-select: none;
      right: 0; top: -40px;
    `;
            tip.innerText = tipText;
            document.body.appendChild(tip);
            const move = (e) => {
                tip.style.left = e.clientX + 'px';
                tip.style.top = e.clientY + 'px';
            };
            document.addEventListener('mousemove', move);
            tip._moveHandler = move;
        }
        else {
            tip.innerText = tipText;
        }
    }
    /**
     * @description: 移除鼠标提示
     */
    removeMouseTip() {
        const tip = document.getElementById('cesium-mouse-tip');
        if (tip) {
            document.removeEventListener('mousemove', tip._moveHandler);
            tip.remove();
        }
    }
    /**
      * @description: 移除实体对象和清理资源
      * @author: Suroc
      */
    removeEntity() {
        this.removeMouseTip();
        // 移除绘制对象
        if (this.drawObj) {
            this.viewer.entities.remove(this.drawObj);
            this.drawObj = null;
        }
        // 销毁并重新创建事件处理器
        if (this.handler) {
            try {
                this.handler.destroy();
            }
            catch (e) {
                console.error('Error destroying handler:', e);
            }
            this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
        }
    }
    /**
     * @description: 安全地销毁事件处理器
     */
    safelyDestroyHandler() {
        if (this.handler && typeof this.handler.isDestroyed !== 'function' || !this.handler.isDestroyed) {
            try {
                if (typeof this.handler.destroy === 'function') {
                    this.handler.destroy();
                }
            }
            catch (e) {
                console.warn('Failed to destroy handler:', e);
            }
        }
        this.handler = null;
    }
    /**
     * @description: 返回绘制数据
     * @return {InfoDetail} - 绘制数据
     * @author: Suroc
     */
    backInfoDetail() {
        return this.infoDetail;
    }
    /**
     * @description: 绘制点数据（支持手动输入）
     * @param {number} [lon] - 经度（可选）
     * @param {number} [lat] - 纬度（可选）
     * @param {number} [alt] - 高度（可选）
     * @param {Cesium.Color} [pointColor] - 点颜色（可选）
     * @param {Cesium.Color} [outlineColor] - 边框颜色（可选）
     */
    drawPoint(id, lon, lat, alt, pointColor, outlineColor, length = 3000, topRadius = 1800) {
        this.removeEntity();
        // 如果未提供id，则生成默认id
        const entityId = id || new Date().getTime().toString();
        let lastPosition = null;
        let codeInfo = { lon: 0, lat: 0, height: 0 };
        // 动态旋转圆锥体实体参数
        let start = 0;
        const Yoffset = 0;
        // 参数验证：用户传了有效经纬度和高度，直接绘制
        if (lon !== undefined && lat !== undefined && alt !== undefined &&
            typeof lon === 'number' && typeof lat === 'number' && typeof alt === 'number') {
            lastPosition = Cesium.Cartesian3.fromDegrees(lon, lat, alt);
            codeInfo = { lon, lat, height: alt };
            this.drawObj = this.viewer.entities.add({
                id: entityId,
                name: 'point',
                position: new Cesium.ConstantProperty(lastPosition),
                point: {
                    color: new Cesium.ColorMaterialProperty(pointColor || this.config.material),
                    pixelSize: new Cesium.ConstantProperty(12),
                    outlineColor: new Cesium.ColorMaterialProperty(outlineColor || this.config.borderColor),
                    outlineWidth: new Cesium.ConstantProperty(this.config.borderWidth)
                },
                orientation: new Cesium.CallbackProperty(() => {
                    start += 1;
                    const roll = Cesium.Math.toRadians(start);
                    Cesium.Math.zeroToTwoPi(roll);
                    return Cesium.Transforms.headingPitchRollQuaternion(Cesium.Cartesian3.fromDegrees(lon, lat, alt), new Cesium.HeadingPitchRoll(roll, 0, 0.0));
                }, false),
                cylinder: new Cesium.CallbackProperty(() => {
                    // 获取相机位置
                    const cameraPosition = this.viewer.camera.position;
                    // 计算相机到点的距离
                    const distance = Cesium.Cartesian3.distance(cameraPosition, lastPosition);
                    // 根据距离动态调整大小（远大近小）
                    // 基础大小 * 距离缩放因子，添加最小值避免太小
                    const scaleFactor = Math.max(0.5, distance / 5000000); // 调整除数以改变缩放敏感度
                    return {
                        length: length * scaleFactor,
                        topRadius: topRadius * scaleFactor,
                        bottomRadius: 0,
                        slices: 4,
                        outline: true,
                        outlineColor: pointColor || Cesium.Color.LIME,
                        material: outlineColor || Cesium.Color.LIME.withAlpha(0.5)
                    };
                }, false)
            });
            this.infoDetail.point = { position: codeInfo };
            if (this.callback) {
                this.callback(this.infoDetail.point);
            }
            return; // 直接返回，跳过鼠标交互
        }
        // 否则，进入鼠标拾取模式
        this.showMouseTip('左键点击添加点，右键完成');
        this.handler?.setInputAction((click) => {
            if (!click || !click.position)
                return;
            const cartesian = this.viewer.camera.pickEllipsoid(click.position, this.viewer.scene.globe.ellipsoid);
            if (!cartesian)
                return;
            const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
            const lon = Cesium.Math.toDegrees(cartographic.longitude);
            const lat = Cesium.Math.toDegrees(cartographic.latitude);
            const height = cartographic.height;
            lastPosition = Cesium.Cartesian3.fromDegrees(lon, lat, height);
            codeInfo = { lon, lat, height };
            if (this.drawObj) {
                this.viewer.entities.remove(this.drawObj);
            }
            this.drawObj = this.viewer.entities.add({
                id: entityId,
                name: 'point',
                position: new Cesium.ConstantProperty(lastPosition),
                point: {
                    color: new Cesium.ColorMaterialProperty(pointColor || this.config.material),
                    pixelSize: new Cesium.ConstantProperty(12),
                    outlineColor: new Cesium.ColorMaterialProperty(outlineColor || this.config.borderColor),
                    outlineWidth: new Cesium.ConstantProperty(this.config.borderWidth)
                },
                orientation: new Cesium.CallbackProperty(() => {
                    start += 1;
                    const roll = Cesium.Math.toRadians(start);
                    Cesium.Math.zeroToTwoPi(roll);
                    return Cesium.Transforms.headingPitchRollQuaternion(Cesium.Cartesian3.fromDegrees(lon, lat, height), new Cesium.HeadingPitchRoll(roll, 0, 0.0));
                }, false),
                cylinder: new Cesium.CallbackProperty(() => {
                    // 获取相机位置
                    const cameraPosition = this.viewer.camera.position;
                    // 计算相机到点的距离
                    const distance = Cesium.Cartesian3.distance(cameraPosition, lastPosition);
                    // 根据距离动态调整大小（远大近小）
                    // 基础大小 * 距离缩放因子，添加最小值避免太小
                    const scaleFactor = Math.max(0.5, distance / 5000000); // 调整除数以改变缩放敏感度
                    return {
                        length: length * scaleFactor,
                        topRadius: topRadius * scaleFactor,
                        bottomRadius: 0,
                        slices: 4,
                        outline: true,
                        outlineColor: pointColor || Cesium.Color.LIME,
                        material: outlineColor || Cesium.Color.LIME.withAlpha(0.5)
                    };
                }, false)
            });
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
        this.handler?.setInputAction(() => {
            this.handler?.destroy();
            this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
            if (lastPosition) {
                this.infoDetail.point = { position: codeInfo };
                if (this.callback) {
                    this.callback(this.infoDetail.point);
                }
            }
            this.removeMouseTip();
        }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
    }
    /**
     * @description: 绘制线段
     * @param {Cesium.Color} [lineColor] - 线条颜色（可选）
     * @author: Suroc
     */
    drawLine(lineColor) {
        this.removeEntity();
        this.showMouseTip('左键点击添加拐点，右键完成线段');
        const id = new Date().getTime().toString();
        let positions = [];
        let codeInfo = [];
        let polygon = new Cesium.PolygonHierarchy();
        let _polygonEntity = new Cesium.Entity();
        this.handler?.setInputAction((movement) => {
            if (movement && movement.position) {
                let cartesian = this.viewer.camera.pickEllipsoid(movement.position, this.viewer.scene.globe.ellipsoid);
                if (!cartesian)
                    return;
                let cartographic = Cesium.Cartographic.fromCartesian(cartesian, this.viewer.scene.globe.ellipsoid, new Cesium.Cartographic());
                let lon = Cesium.Math.toDegrees(cartographic.longitude);
                let lat = Cesium.Math.toDegrees(cartographic.latitude);
                if (positions.length === 0) {
                    positions.push(cartesian.clone());
                }
                codeInfo.push([lon, lat]);
                positions.push(cartesian.clone());
                polygon.positions.push(cartesian.clone());
                if (!this.drawObj) {
                    _polygonEntity.polyline = new Cesium.PolylineGraphics({
                        width: new Cesium.ConstantProperty(this.config.borderWidth),
                        material: new Cesium.ColorMaterialProperty(lineColor || this.config.borderColor),
                    });
                    _polygonEntity.polyline.positions = new Cesium.CallbackProperty(() => positions, false);
                    _polygonEntity.name = 'line';
                    _polygonEntity._id = id;
                    this.drawObj = this.viewer.entities.add(_polygonEntity);
                }
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
        this.handler?.setInputAction((movement) => {
            if (movement && movement.endPosition) {
                let cartesian = this.viewer.camera.pickEllipsoid(movement.endPosition, this.viewer.scene.globe.ellipsoid);
                if (!cartesian)
                    return;
                let cartographic = Cesium.Cartographic.fromCartesian(cartesian, this.viewer.scene.globe.ellipsoid, new Cesium.Cartographic());
                let lon = Cesium.Math.toDegrees(cartographic.longitude);
                let lat = Cesium.Math.toDegrees(cartographic.latitude);
                if (positions.length > 0) {
                    positions.pop();
                    positions.push(cartesian);
                    codeInfo.pop();
                    codeInfo.push([lon, lat]);
                }
            }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
        this.handler?.setInputAction(() => {
            this.infoDetail.line = { id, positions: codeInfo };
            this.handler?.destroy();
            this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
            if (this.callback) {
                this.callback(this.infoDetail.line);
            }
            // 移除鼠标提示
            this.removeMouseTip();
        }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
    }
    /**
     * @description: 绘制矩形区域
     * @param {Cesium.Color} [fillColor] - 填充颜色（可选）
     * @param {Cesium.Color} [borderColor] - 边框颜色（可选）
     * @author: Suroc
     */
    drawRectangle(fillColor, borderColor) {
        this.removeEntity();
        this.showMouseTip('左键点击设置起点，移动鼠标调整，右键完成');
        let westSouthEastNorth = [];
        const id = new Date().getTime().toString();
        this.handler?.setInputAction((click) => {
            if (click && click.position) {
                let cartesian = this.viewer.camera.pickEllipsoid(click.position, this.viewer.scene.globe.ellipsoid);
                if (!cartesian)
                    return;
                let cartographic = Cesium.Cartographic.fromCartesian(cartesian, this.viewer.scene.globe.ellipsoid, new Cesium.Cartographic());
                let lng1 = Cesium.Math.toDegrees(cartographic.longitude);
                let lat1 = Cesium.Math.toDegrees(cartographic.latitude);
                westSouthEastNorth = [lng1, lat1];
                if (westSouthEastNorth) {
                    this.handler?.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
                }
                this.drawObj = this.viewer.entities.add({
                    name: 'rectangle',
                    id,
                    polygon: {
                        hierarchy: new Cesium.CallbackProperty(() => ({
                            positions: Cesium.Cartesian3.fromDegreesArray(westSouthEastNorth)
                        }), false),
                        height: new Cesium.ConstantProperty(0),
                        material: new Cesium.ColorMaterialProperty(fillColor || this.config.material),
                        fill: true,
                        show: new Cesium.ConstantProperty(true)
                    },
                    polyline: {
                        positions: new Cesium.CallbackProperty(() => Cesium.Cartesian3.fromDegreesArray(westSouthEastNorth), false),
                        material: new Cesium.ColorMaterialProperty(borderColor || this.config.borderColor),
                        width: new Cesium.ConstantProperty(this.config.borderWidth),
                        zIndex: new Cesium.ConstantProperty(1)
                    },
                });
                this.handler?.setInputAction((move) => {
                    if (move && move.endPosition) {
                        let cartesian = this.viewer.camera.pickEllipsoid(move.endPosition, this.viewer.scene.globe.ellipsoid);
                        if (!cartesian)
                            return;
                        let cartographic = Cesium.Cartographic.fromCartesian(cartesian, this.viewer.scene.globe.ellipsoid, new Cesium.Cartographic());
                        let lon = Cesium.Math.toDegrees(cartographic.longitude);
                        let lat = Cesium.Math.toDegrees(cartographic.latitude);
                        westSouthEastNorth = [lng1, lat1, lng1, lat, lon, lat, lon, lat1, lng1, lat1];
                    }
                }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
        this.handler?.setInputAction(() => {
            if (!id)
                return;
            this.infoDetail.rectangle = {
                id,
                positions: [
                    { lon: westSouthEastNorth[0], lat: westSouthEastNorth[1] },
                    { lon: westSouthEastNorth[6], lat: westSouthEastNorth[7] },
                    { lon: westSouthEastNorth[4], lat: westSouthEastNorth[5] },
                    { lon: westSouthEastNorth[2], lat: westSouthEastNorth[3] }
                ],
                westSouthEastNorth
            };
            this.handler?.destroy();
            this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
            if (this.callback) {
                this.callback(this.infoDetail.rectangle);
            }
            // 移除鼠标提示
            this.removeMouseTip();
        }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
    }
    /**
     * @description: 绘制圆形区域
     * @param {Cesium.Color} [fillColor] - 填充颜色（可选）
     * @param {Cesium.Color} [borderColor] - 边框颜色（可选）
     * @author: Suroc
     */
    drawCircle(fillColor, borderColor) {
        this.removeEntity();
        this.showMouseTip('左键点击设置圆心，移动鼠标调整半径，右键完成');
        const id = new Date().getTime().toString();
        let radius = 0;
        let lngLat = [0, 0];
        let centerCartesian = null;
        this.handler?.setInputAction((click) => {
            if (click && click.position) {
                let cartesian = this.viewer.camera.pickEllipsoid(click.position, this.viewer.scene.globe.ellipsoid);
                if (!cartesian)
                    return;
                let cartographic = Cesium.Cartographic.fromCartesian(cartesian, this.viewer.scene.globe.ellipsoid, new Cesium.Cartographic());
                let lon = Cesium.Math.toDegrees(cartographic.longitude);
                let lat = Cesium.Math.toDegrees(cartographic.latitude);
                lngLat = [lon, lat];
                centerCartesian = cartesian;
                this.drawObj = this.viewer.entities.add({
                    position: new Cesium.CallbackProperty(() => Cesium.Cartesian3.fromDegrees(...lngLat, 0), false),
                    name: 'circle',
                    id,
                    ellipse: {
                        height: new Cesium.ConstantProperty(0),
                        outline: new Cesium.ConstantProperty(true),
                        material: new Cesium.ColorMaterialProperty(fillColor || this.config.material),
                        outlineColor: new Cesium.ColorMaterialProperty(borderColor || this.config.borderColor),
                        outlineWidth: new Cesium.ConstantProperty(this.config.borderWidth),
                        semiMajorAxis: new Cesium.CallbackProperty(() => radius, false),
                        semiMinorAxis: new Cesium.CallbackProperty(() => radius, false)
                    }
                });
                this.handler?.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
                this.handler?.setInputAction((move) => {
                    if (move && move.endPosition) {
                        let cartesian2 = this.viewer.camera.pickEllipsoid(move.endPosition, this.viewer.scene.globe.ellipsoid);
                        if (!cartesian2)
                            return;
                        if (centerCartesian) {
                            radius = Cesium.Cartesian3.distance(centerCartesian, cartesian2);
                        }
                    }
                }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
        this.handler?.setInputAction(() => {
            this.infoDetail.circle = { id, center: lngLat, radius };
            this.handler?.destroy();
            this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
            if (this.callback) {
                this.callback(this.infoDetail.circle);
            }
            // 移除鼠标提示
            this.removeMouseTip();
        }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
    }
    /**
     * @description: 绘制多边形区域（圆）
     * @param { number } steps - 步长（多边形边数）
     * @param { number } [radius] - 半径（可选，单位：千米），如果不提供则通过鼠标移动动态确定半径
     * @param { Cesium.Color } [fillColor] - 填充颜色（可选）
     * @param { Cesium.Color } [borderColor] - 边框颜色（可选）
     * @author: Suroc
     */
    drawCirclePlane(steps, radius, fillColor, borderColor) {
        this.removeEntity();
        // 参数验证
        if (!this.config.turf) {
            console.warn('turf库未在初始化时传入，无法绘制圆形平面。请在创建DrawTool实例时通过config.turf传入turf库。');
            return;
        }
        // 根据是否提供半径参数显示不同的提示
        const hasFixedRadius = typeof radius === 'number' && !isNaN(radius) && radius > 0;
        this.showMouseTip(hasFixedRadius ? '左键点击设置圆心，右键完成' : '左键点击设置圆心，移动鼠标调整半径，右键完成');
        // 参数验证和默认值设置
        let validRadius = hasFixedRadius ? radius : 1;
        const validSteps = typeof steps === 'number' && !isNaN(steps) && steps > 3 ? steps : 64;
        const id = new Date().getTime().toString();
        let lngLat = [0, 0];
        let centerCartesian = null;
        let positions = [];
        // 生成多边形坐标的回调函数
        const generatePolygonPositions = () => {
            if (!this.config.turf || !lngLat)
                return [];
            try {
                const options = {
                    steps: validSteps,
                    units: "kilometers"
                };
                const turfPos = this.config.turf.circle(lngLat, validRadius, options);
                if (!turfPos || !turfPos.geometry || !turfPos.geometry.coordinates || !Array.isArray(turfPos.geometry.coordinates[0])) {
                    return [];
                }
                const convertedCoords = turfPos.geometry.coordinates[0];
                positions = convertedCoords.filter((coord) => Array.isArray(coord) && coord.length >= 2 && !isNaN(coord[0]) && !isNaN(coord[1]))
                    .map((coord) => ({ lon: coord[0], lat: coord[1] }));
                return positions.map(coord => Cesium.Cartesian3.fromDegrees(coord.lon, coord.lat, 0));
            }
            catch (error) {
                console.error('生成多边形坐标出错:', error);
                return [];
            }
        };
        this.handler?.setInputAction((click) => {
            if (click && click.position) {
                let cartesian = this.viewer.camera.pickEllipsoid(click.position, this.viewer.scene.globe.ellipsoid);
                if (!cartesian)
                    return;
                let cartographic = Cesium.Cartographic.fromCartesian(cartesian, this.viewer.scene.globe.ellipsoid, new Cesium.Cartographic());
                let lon = Cesium.Math.toDegrees(cartographic.longitude);
                let lat = Cesium.Math.toDegrees(cartographic.latitude);
                // 确保坐标是有效的数字
                if (typeof lon !== 'number' || isNaN(lon) || typeof lat !== 'number' || isNaN(lat)) {
                    console.warn('无效的坐标值，无法绘制圆形平面');
                    return;
                }
                lngLat = [lon, lat];
                centerCartesian = cartesian;
                // turf库已在函数开始处检查，这里无需重复检查
                // 使用CallbackProperty实现动态更新，参考d  rawCircle函数的实现方式
                this.drawObj = this.viewer.entities.add({
                    id,
                    name: 'planeSelf',
                    polyline: {
                        width: new Cesium.ConstantProperty(this.config.borderWidth - 0.5),
                        material: new Cesium.ColorMaterialProperty(borderColor || this.config.borderColor),
                        positions: new Cesium.CallbackProperty(generatePolygonPositions, false)
                    },
                    polygon: {
                        hierarchy: new Cesium.CallbackProperty(() => {
                            const positions = generatePolygonPositions();
                            return new Cesium.PolygonHierarchy(positions);
                        }, false),
                        material: new Cesium.ColorMaterialProperty(fillColor || this.config.material)
                    }
                });
                // 如果没有固定半径，则添加鼠标移动事件来动态调整半径
                if (!hasFixedRadius) {
                    this.handler?.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
                    this.handler?.setInputAction((move) => {
                        if (move && move.endPosition) {
                            let cartesian2 = this.viewer.camera.pickEllipsoid(move.endPosition, this.viewer.scene.globe.ellipsoid);
                            if (!cartesian2 || !centerCartesian)
                                return;
                            // 计算两点之间的距离（米），然后转换为千米用于turf.circle
                            const distanceMeters = Cesium.Cartesian3.distance(centerCartesian, cartesian2);
                            validRadius = distanceMeters / 1000; // 转换为千米
                            // Callba  ckProperty会自动更新，无需额外操作
                        }
                    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
                }
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
        this.handler?.setInputAction(() => {
            this.infoDetail.planeSelf = { id, center: lngLat, positions };
            this.handler?.destroy();
            this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
            if (this.callback) {
                this.callback(this.infoDetail.planeSelf);
            }
            // 移除鼠标提示
            this.removeMouseTip();
        }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
    }
    /**
     * @description: 自定义区域绘制（多边形）
     * @param {Cesium.Color} [fillColor] - 填充颜色（可选）
     * @param {Cesium.Color} [borderColor] - 边框颜色（可选）
     * @author: Suroc
     */
    drawPlane(fillColor, borderColor) {
        this.removeEntity();
        const id = Date.now().toString();
        const ellipsoid = this.viewer.scene.globe.ellipsoid;
        let positions = [];
        let codeInfo = [];
        let finished = false;
        let isDrawing = true;
        const MAIN_TIP = '点击左键选择位置，点击右键结束';
        const WARN_TIP = '至少需要三个点';
        let warnTimer = null;
        const showMainTip = () => {
            this.showMouseTip(MAIN_TIP);
        };
        const showWarnTip = () => {
            this.showMouseTip(WARN_TIP);
            if (warnTimer)
                clearTimeout(warnTimer);
            warnTimer = setTimeout(() => {
                showMainTip();
            }, 1000);
        };
        showMainTip();
        // 动态回调属性，返回最新的多边形顶点
        const dynamicPositions = new Cesium.CallbackProperty(() => {
            return positions;
        }, false);
        this.drawObj = this.viewer.entities.add({
            id,
            name: 'planeSelf',
            polyline: {
                width: new Cesium.ConstantProperty(this.config.borderWidth - 0.5),
                material: new Cesium.ColorMaterialProperty(borderColor || this.config.borderColor),
                positions: dynamicPositions,
                arcType: new Cesium.ConstantProperty(Cesium.ArcType.NONE),
                classificationType: new Cesium.ConstantProperty(Cesium.ClassificationType.BOTH)
            },
            polygon: {
                hierarchy: new Cesium.CallbackProperty(() => {
                    return new Cesium.PolygonHierarchy(positions);
                }, false),
                material: new Cesium.ColorMaterialProperty(fillColor || this.config.material),
                show: new Cesium.ConstantProperty(true),
                fill: true,
                outline: new Cesium.ConstantProperty(false)
            }
        });
        // 鼠标左键点击，添加点
        this.handler?.setInputAction((movement) => {
            if (!isDrawing || finished)
                return;
            const cartesian = this.viewer.camera.pickEllipsoid(movement.position, ellipsoid);
            if (!cartesian)
                return;
            const cartographic = Cesium.Cartographic.fromCartesian(cartesian, ellipsoid);
            const lon = Cesium.Math.toDegrees(cartographic.longitude);
            const lat = Cesium.Math.toDegrees(cartographic.latitude);
            positions.push(cartesian);
            codeInfo.push({ lon, lat });
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
        // 鼠标移动动态更新最后一个点（临时点）
        let lastTempPoint = null;
        this.handler?.setInputAction((movement) => {
            if (!isDrawing || positions.length === 0 || finished)
                return;
            const cartesian = this.viewer.camera.pickEllipsoid(movement.endPosition, ellipsoid);
            if (!cartesian)
                return;
            // 先移除之前的临时点
            if (lastTempPoint) {
                positions.pop();
            }
            positions.push(cartesian);
            lastTempPoint = cartesian;
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
        // 右键结束绘制，自动闭合多边形
        this.handler?.setInputAction(() => {
            if (!isDrawing || finished)
                return;
            if (positions.length < 3) {
                showWarnTip();
                return;
            }
            finished = true;
            // 移除临时点（最后一个点）
            if (lastTempPoint) {
                positions.pop();
            }
            // 自动闭合
            positions.push(positions[0]);
            codeInfo.push(codeInfo[0]);
            this.infoDetail.planeSelf = { id, positions: codeInfo };
            // 安全销毁事件处理器
            this.safelyDestroyHandler();
            if (this.callback) {
                this.callback(this.infoDetail.planeSelf);
            }
            setTimeout(() => {
                this.removeMouseTip();
                if (warnTimer)
                    clearTimeout(warnTimer);
            }, 1);
        }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
    }
    /**
     * @description: 清理所有资源
     */
    destroy() {
        this.removeEntity();
        this.infoDetail = { point: [], line: [], rectangle: [], circle: [], planeSelf: [] };
        this.callback = null;
        this.handler = null;
        this.drawObj = null;
    }
}
export default DrawTool;
