/*
 * @Author: Suroc
 * @Date: 2024-05-06 10:20:58
 * @LastEditTime: 2025-08-21 11:00:00
 * @Description: Cesium绘制工具 - 提供点、线、矩形、圆形、多边形等绘制功能
 */

// 声明Cesium类型
interface Cesium {
  Viewer: any;
  Color: any;
  Cartesian3: any;
  ScreenSpaceEventHandler: any;
  ScreenSpaceEventType: any;
  ColorMaterialProperty: any;
  ConstantProperty: any;
  CallbackProperty: any;
  PolygonHierarchy: any;
  Entity: any;
  PolylineGraphics: any;
  Math: any;
  Cartographic: any;
  Transforms: any;
  HeadingPitchRoll: any;
  HeadingPitchRollQuaternion: any;
  ArcType: any;
  ClassificationType: any;
}

declare const Cesium: Cesium;
// 定义接口
interface DrawConfig {
  borderColor: Cesium.Color;
  borderWidth: number;
  material: Cesium.Color;
  turf?: any; // turf库实例，用于绘制圆形平面
}

interface PointPosition {
  id: string;
  positions: [number, number][];
}

interface LinePosition {
  id: string;
  positions: [number, number][];
}

interface RectanglePosition {
  id: string;
  positions: Array<{ lon: number; lat: number; }>;
  westSouthEastNorth?: number[];
}

interface CirclePosition {
  id: string;
  center: [number, number];
  radius: number;
}

interface PlanePosition {
  id: string;
  center?: [number, number];
  positions: Array<{ lon: number; lat: number; }>;
}

interface InfoDetail {
  point: PointPosition[];
  line: LinePosition[];
  rectangle: RectanglePosition[];
  circle: CirclePosition[];
  planeSelf: PlanePosition[];
}

class DrawTool {
  private viewer: Cesium.Viewer;
  private config: DrawConfig;
  private callback: ((data: any) => void) | null;
  private infoDetail: InfoDetail;
  private handler: Cesium.ScreenSpaceEventHandler | null;
  private drawObj: Cesium.Entity | null;
  // 用于生成唯一ID的计数器
  private idCounter: number = 0;

  constructor(viewer: Cesium.Viewer, callback?: ((data: any) => void), config?: Partial<DrawConfig>) {
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
    /**存储绘制的数据坐标 - 数组形式，支持多个图形 */
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
  private showMouseTip(tipText: string): void {
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
      const move = (e: MouseEvent): void => {
        tip!.style.left = e.clientX + 'px';
        tip!.style.top = e.clientY + 'px';
      };
      document.addEventListener('mousemove', move);
      (tip as any)._moveHandler = move;
    } else {
      tip.innerText = tipText;
    }
  }

  /**
   * @description: 移除鼠标提示
   */
  private removeMouseTip(): void {
    const tip = document.getElementById('cesium-mouse-tip');
    if (tip) {
      document.removeEventListener('mousemove', (tip as any)._moveHandler);
      tip.remove();
    }
  }

  /**
   * @description: 移除临时绘制实体
   * 注意：该方法只移除临时绘制对象(this.drawObj)，不会影响已存储的图形
   * 这样可以避免在开始新的绘制任务时导致已完成图形闪烁
   */
  public removeEntity(): void {
    this.removeMouseTip();

    // 只移除当前正在绘制的临时对象，保留已完成绘制的图形
    if (this.drawObj) {
      this.viewer.entities.remove(this.drawObj);
      this.drawObj = null;
    }
  }

  /**
   * @description: 生成唯一ID
   * 使用时间戳+计数器的方式确保在同一毫秒内绘制多个图形时ID也唯一
   * @returns {string} 唯一的ID
   */
  private generateUniqueId(): string {
    return `${Date.now()}_${this.idCounter++}`;
  }

  /**
   * @description: 从infoDetail渲染所有已存储的图形
   * @author: Suroc
   */
  private renderStoredGraphics(): void {
    // 优化渲染流程：先收集所有需要保留的实体ID，包括已存储图形的ID和当前临时对象ID
    const entitiesToKeep: string[] = this.drawObj ? [this.drawObj.id] : [];

    // 添加所有已存储图形的ID到保留列表
    this.infoDetail.point.forEach(point => entitiesToKeep.push(point.id));
    this.infoDetail.line.forEach(line => entitiesToKeep.push(line.id));
    this.infoDetail.rectangle.forEach(rect => entitiesToKeep.push(rect.id));
    this.infoDetail.circle.forEach(circle => entitiesToKeep.push(circle.id));
    this.infoDetail.planeSelf.forEach((plane: any) => entitiesToKeep.push(plane.id));

    // 只移除不属于保留列表的实体
    const entitiesToRemove: any[] = [];
    this.viewer.entities.values.forEach((entity: any) => {
      if (!entitiesToKeep.includes(entity.id)) {
        entitiesToRemove.push(entity);
      }
    });

    // 批量移除不需要的实体，减少渲染次数
    entitiesToRemove.forEach(entity => this.viewer.entities.remove(entity));

    // 重新渲染所有存储的图形
    this.renderPoints();
    this.renderLines();
    this.renderRectangles();
    this.renderCircles();
    this.renderPlanes();
  }

  /**
   * @description: 渲染已存储的点图形
   * @author: Suroc
   */
  private renderPoints(): void {
    // 收集所有已存在的实体ID，避免重复添加
    const existingEntityIds = new Set<string>();
    this.viewer.entities.values.forEach((entity: any) => {
      existingEntityIds.add(entity.id);
    });

    this.infoDetail.point.forEach((point: PointPosition) => {
      if (point.positions && point.positions.length > 0) {
        // 对于每个点位置，创建点实体
        point.positions.forEach((pos, index) => {
          const entityId = `${point.id}-${index}`;
          // 只添加不存在的实体，避免重复添加导致闪烁
          if (!existingEntityIds.has(entityId)) {
            this.viewer.entities.add({
              name: 'point',
              id: entityId,
              position: Cesium.Cartesian3.fromDegrees(pos[0], pos[1], 0),
              point: {
                pixelSize: 10,
                color: this.config.material,
                outlineColor: this.config.borderColor,
                outlineWidth: 2
              }
            } as any);
          }
        });
      }
    });
  }

  /**
   * @description: 渲染已存储的线图形
   * @author: Suroc
   */
  private renderLines(): void {
    // 收集所有已存在的实体ID，避免重复添加
    const existingEntityIds = new Set<string>();
    this.viewer.entities.values.forEach((entity: any) => {
      existingEntityIds.add(entity.id);
    });

    this.infoDetail.line.forEach((line: LinePosition) => {
      if (line.positions && line.positions.length > 1) {
        // 只添加不存在的实体，避免重复添加导致闪烁
        if (!existingEntityIds.has(line.id)) {
          // 收集所有线的坐标点
          const positions: number[] = [];
          line.positions.forEach(pos => {
            positions.push(pos[0], pos[1]);
          });

          this.viewer.entities.add({
            name: 'line',
            id: line.id,
            polyline: {
              positions: Cesium.Cartesian3.fromDegreesArray(positions),
              material: new Cesium.ColorMaterialProperty(this.config.borderColor),
              width: new Cesium.ConstantProperty(this.config.borderWidth),
              zIndex: new Cesium.ConstantProperty(1)
            } as any
          } as any);
        }
      }
    });
  }

  /**
   * @description: 渲染已存储的矩形图形
   * @author: Suroc
   */
  private renderRectangles(): void {
    // 收集所有已存在的实体ID，避免重复添加
    const existingEntityIds = new Set<string>();
    this.viewer.entities.values.forEach((entity: any) => {
      existingEntityIds.add(entity.id);
    });

    this.infoDetail.rectangle.forEach((rectangle: RectanglePosition) => {
      if (rectangle.westSouthEastNorth && rectangle.westSouthEastNorth.length >= 8) {
        // 只添加不存在的实体，避免重复添加导致闪烁
        if (!existingEntityIds.has(rectangle.id)) {
          this.viewer.entities.add({
            name: 'rectangle',
            id: rectangle.id,
            polygon: {
              hierarchy: {
                positions: Cesium.Cartesian3.fromDegreesArray(rectangle.westSouthEastNorth)
              },
              height: new Cesium.ConstantProperty(0),
              material: new Cesium.ColorMaterialProperty(this.config.material),
              fill: true,
              show: new Cesium.ConstantProperty(true),
            } as any,
            polyline: {
              positions: Cesium.Cartesian3.fromDegreesArray(rectangle.westSouthEastNorth),
              material: new Cesium.ColorMaterialProperty(this.config.borderColor),
              width: new Cesium.ConstantProperty(this.config.borderWidth),
              zIndex: new Cesium.ConstantProperty(1)
            } as any,
          } as any);
        }
      }
    });
  }

  /**
   * @description: 渲染已存储的圆形图形
   * @author: Suroc
   */
  private renderCircles(): void {
    // 收集所有已存在的实体ID，避免重复添加
    const existingEntityIds = new Set<string>();
    this.viewer.entities.values.forEach((entity: any) => {
      existingEntityIds.add(entity.id);
    });

    this.infoDetail.circle.forEach((circle: CirclePosition) => {
      if (circle.center && circle.radius) {
        // 只添加不存在的实体，避免重复添加导致闪烁
        if (!existingEntityIds.has(circle.id)) {
          // 使用椭圆实体表示圆形
          this.viewer.entities.add({
            name: 'circle',
            id: circle.id,
            position: Cesium.Cartesian3.fromDegrees(circle.center[0], circle.center[1], 0),
            ellipse: {
              semiMinorAxis: new Cesium.ConstantProperty(circle.radius * 1000), // 转换为米
              semiMajorAxis: new Cesium.ConstantProperty(circle.radius * 1000),
              material: new Cesium.ColorMaterialProperty(this.config.material),
              outline: true,
              outlineColor: this.config.borderColor,
              outlineWidth: this.config.borderWidth
            } as any
          } as any);
        }
      }
    });
  }

  /**
   * @description: 渲染已存储的多边形图形
   * @author: Suroc
   */
  private renderPlanes(): void {
    // 收集所有已存在的实体ID，避免重复添加
    const existingEntityIds = new Set<string>();
    this.viewer.entities.values.forEach((entity: any) => {
      existingEntityIds.add(entity.id);
    });

    this.infoDetail.planeSelf.forEach((plane: PlanePosition) => {
      if (plane.positions && plane.positions.length >= 3) {
        // 只添加不存在的实体，避免重复添加导致闪烁
        if (!existingEntityIds.has(plane.id)) {
          // 收集所有多边形顶点坐标
          const positions: number[] = [];
          plane.positions.forEach(pos => {
            positions.push(pos.lon, pos.lat);
          });

          // 确保多边形闭合
          if (positions.length >= 4) {
            positions.push(positions[0], positions[1]);
          }

          this.viewer.entities.add({
            name: 'polygon',
            id: plane.id,
            polygon: {
              hierarchy: {
                positions: Cesium.Cartesian3.fromDegreesArray(positions)
              },
              height: new Cesium.ConstantProperty(0),
              material: new Cesium.ColorMaterialProperty(this.config.material),
              fill: true,
              outline: true,
              outlineColor: this.config.borderColor,
              outlineWidth: this.config.borderWidth,
              show: new Cesium.ConstantProperty(true)
            } as any
          } as any);
        }
      }
    });
  }

  /**
   * @description: 返回绘制数据
   * @return {InfoDetail} - 绘制数据
   * @author: Suroc
   */
  public backInfoDetail(): InfoDetail {
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
  public drawPoint(lon?: number, lat?: number, alt?: number, pointColor?: Cesium.Color, outlineColor?: Cesium.Color, length: number = 300000, topRadius: number = 180000): void {
    this.removeEntity();
    // 渲染已存储的所有图形，确保保留之前绘制的图形
    this.renderStoredGraphics();

    // 如果未提供id，则生成默认id
    const id = this.generateUniqueId();
    let lastPosition: Cesium.Cartesian3 | null = null;
    let codeInfo: number[] = [];
    // 动态旋转圆锥体实体参数
    let start = 0;

    // 参数验证：用户传了有效经纬度和高度，直接绘制
    if (lon !== undefined && lat !== undefined && alt !== undefined &&
      typeof lon === 'number' && typeof lat === 'number' && typeof alt === 'number') {
      lastPosition = Cesium.Cartesian3.fromDegrees(lon, lat, alt + (length / 2));
      codeInfo = [lon, lat];

      this.drawObj = this.viewer.entities.add({
        id: id,
        name: 'point',
        position: new Cesium.ConstantProperty(lastPosition!),
        orientation: new Cesium.CallbackProperty(() => {
          start += 1;
          const roll = Cesium.Math.toRadians(start);
          Cesium.Math.zeroToTwoPi(roll);
          return Cesium.Transforms.headingPitchRollQuaternion(
            Cesium.Cartesian3.fromDegrees(lon, lat, alt + (length / 2)),
            new Cesium.HeadingPitchRoll(roll, 0, 0.0)
          );
        }, false),
        cylinder: {
          length: length,
          topRadius: topRadius,
          bottomRadius: 0,
          slices: 4,
          outline: true,
          outlineColor: pointColor || Cesium.Color.LIME,
          material: outlineColor || Cesium.Color.LIME.withAlpha(0.5)
        }
      } as any);

      const pointData = { id, positions: [codeInfo] as any };
      this.infoDetail.point.push(pointData);
      if (this.callback) {
        this.callback(pointData);
      }

      return; // 直接返回，跳过鼠标交互
    }

    // 否则，进入鼠标拾取模式
    this.showMouseTip('左键点击添加点，右键完成');

    this.handler?.setInputAction((click: { position: Cesium.Cartesian2 }) => {
      if (!click || !click.position) return;

      const cartesian = this.viewer.camera.pickEllipsoid(click.position, this.viewer.scene.globe.ellipsoid);
      if (!cartesian) return;

      const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
      const lon = Cesium.Math.toDegrees(cartographic.longitude);
      const lat = Cesium.Math.toDegrees(cartographic.latitude);
      const height = cartographic.height;

      lastPosition = Cesium.Cartesian3.fromDegrees(lon, lat, height + (length / 2));
      codeInfo = [lon, lat];

      if (this.drawObj) {
        this.viewer.entities.remove(this.drawObj);
      }

      this.drawObj = this.viewer.entities.add({
        id: id,
        name: 'point',
        position: new Cesium.ConstantProperty(lastPosition),
        orientation: new Cesium.CallbackProperty(() => {
          start += 1;
          const roll = Cesium.Math.toRadians(start);
          Cesium.Math.zeroToTwoPi(roll);
          return Cesium.Transforms.headingPitchRollQuaternion(
            Cesium.Cartesian3.fromDegrees(lon, lat, height + (length / 2)),
            new Cesium.HeadingPitchRoll(roll, 0, 0.0)
          );
        }, false),
        cylinder: {
          length: length,
          topRadius: topRadius,
          bottomRadius: 0,
          slices: 4,
          outline: true,
          outlineColor: pointColor || Cesium.Color.LIME,
          material: outlineColor || Cesium.Color.LIME.withAlpha(0.5)
        }
      } as any);
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    this.handler?.setInputAction(() => {
      this.handler?.destroy();
      this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);

      if (lastPosition) {
        const pointData = { id, positions: [codeInfo] as any };
        this.infoDetail.point.push(pointData);

        if (this.callback) {
          this.callback(pointData);
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
  public drawLine(lineColor?: Cesium.Color): void {
    // 优化绘制流程：先移除临时绘制对象，再渲染已存储图形，避免闪烁
    this.removeEntity();
    // 渲染已存储的所有图形，确保保留之前绘制的图形
    this.renderStoredGraphics();

    this.showMouseTip('点击左键添加点，右键结束');
    const id: string = this.generateUniqueId();
    let positions: Cesium.Cartesian3[] = [];
    let codeInfo: [number, number][] = [];
    let polygon = new Cesium.PolygonHierarchy();
    let _polygonEntity = new Cesium.Entity();

    this.handler?.setInputAction((movement: { position: Cesium.Cartesian2 }) => {
      if (movement && movement.position) {
        let cartesian = this.viewer.camera.pickEllipsoid(movement.position, this.viewer.scene.globe.ellipsoid);
        if (!cartesian) return;

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
            material: new Cesium.ColorMaterialProperty(this.config.borderColor),

          });
          _polygonEntity.polyline.positions = new Cesium.CallbackProperty(() => positions, false);
          _polygonEntity.name = 'line';
          (_polygonEntity as any)._id = id;

          this.drawObj = this.viewer.entities.add(_polygonEntity);
        }
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    this.handler?.setInputAction((movement: { endPosition: Cesium.Cartesian2 }) => {
      if (movement && movement.endPosition) {
        let cartesian = this.viewer.camera.pickEllipsoid(movement.endPosition, this.viewer.scene.globe.ellipsoid);
        if (!cartesian) return;

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
      const lineData = { id, positions: codeInfo };
      this.infoDetail.line.push(lineData);
      this.handler?.destroy();
      this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);

      if (this.callback) {
        this.callback(lineData);
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
  public drawRectangle(fillColor?: Cesium.Color, borderColor?: Cesium.Color): void {
    this.removeEntity();
    // 渲染已存储的所有图形，确保保留之前绘制的图形
    this.renderStoredGraphics();

    this.showMouseTip('左键点击设置起点，移动鼠标调整，右键完成');

    let westSouthEastNorth: number[] = [];
    const id: string = this.generateUniqueId();

    this.handler?.setInputAction((click: { position: Cesium.Cartesian2 }) => {
      if (click && click.position) {
        let cartesian = this.viewer.camera.pickEllipsoid(click.position, this.viewer.scene.globe.ellipsoid);
        if (!cartesian) return;
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
            show: new Cesium.ConstantProperty(true),
          } as any,
          polyline: {
            positions: new Cesium.CallbackProperty(() => Cesium.Cartesian3.fromDegreesArray(westSouthEastNorth), false),
            material: new Cesium.ColorMaterialProperty(borderColor || this.config.borderColor),
            width: new Cesium.ConstantProperty(this.config.borderWidth),
            zIndex: new Cesium.ConstantProperty(1)
          } as any,
        } as any);

        this.handler?.setInputAction((move: { endPosition: Cesium.Cartesian2 }) => {
          if (move && move.endPosition) {
            let cartesian = this.viewer.camera.pickEllipsoid(move.endPosition, this.viewer.scene.globe.ellipsoid);
            if (!cartesian) return;
            let cartographic = Cesium.Cartographic.fromCartesian(cartesian, this.viewer.scene.globe.ellipsoid, new Cesium.Cartographic());
            let lon = Cesium.Math.toDegrees(cartographic.longitude);
            let lat = Cesium.Math.toDegrees(cartographic.latitude);

            westSouthEastNorth = [lng1, lat1, lng1, lat, lon, lat, lon, lat1, lng1, lat1];
          }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    this.handler?.setInputAction(() => {
      if (!id) return;

      const rectangleData = {
        id,
        positions: [
          { lon: westSouthEastNorth[0], lat: westSouthEastNorth[1] },
          { lon: westSouthEastNorth[6], lat: westSouthEastNorth[7] },
          { lon: westSouthEastNorth[4], lat: westSouthEastNorth[5] },
          { lon: westSouthEastNorth[2], lat: westSouthEastNorth[3] }
        ],
        westSouthEastNorth
      };
      this.infoDetail.rectangle.push(rectangleData);

      this.handler?.destroy();
      this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);

      if (this.callback) {
        this.callback(rectangleData);
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
  public drawCircle(fillColor?: Cesium.Color, borderColor?: Cesium.Color): void {
    this.removeEntity();
    // 渲染已存储的所有图形，确保保留之前绘制的图形
    this.renderStoredGraphics();

    this.showMouseTip('左键点击设置圆心，移动鼠标调整半径，右键完成');

    const id: string = this.generateUniqueId();
    let radius = 0;
    let lngLat: [number, number] = [0, 0];
    let centerCartesian: Cesium.Cartesian3 | null = null;

    this.handler?.setInputAction((click: { position: Cesium.Cartesian2 }) => {
      if (click && click.position) {
        let cartesian = this.viewer.camera.pickEllipsoid(click.position, this.viewer.scene.globe.ellipsoid);
        if (!cartesian) return;

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
          } as any
        } as any);

        this.handler?.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);

        this.handler?.setInputAction((move: { endPosition: Cesium.Cartesian2 }) => {
          if (move && move.endPosition) {
            let cartesian2 = this.viewer.camera.pickEllipsoid(move.endPosition, this.viewer.scene.globe.ellipsoid);
            if (!cartesian2) return;

            if (centerCartesian) {
              radius = Cesium.Cartesian3.distance(centerCartesian, cartesian2);
            }
          }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    this.handler?.setInputAction(() => {
      const circleData = { id, center: lngLat, radius };
      this.infoDetail.circle.push(circleData);
      this.handler?.destroy();
      this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);

      if (this.callback) {
        this.callback(circleData);
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
  public drawCirclePlane(steps: number, radius?: number, fillColor?: Cesium.Color, borderColor?: Cesium.Color): void {
    this.removeEntity();
    // 渲染已存储的所有图形，确保保留之前绘制的图形
    this.renderStoredGraphics();

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

    const id: string = this.generateUniqueId();
    let lngLat: [number, number] = [0, 0];
    let centerCartesian: Cesium.Cartesian3 | null = null;
    let positions: Array<{ lon: number; lat: number; }> = [];

    // 生成多边形坐标的回调函数
    const generatePolygonPositions = (): Cesium.Cartesian3[] => {
      if (!this.config.turf || !lngLat) return [];

      try {
        const options = {
          steps: validSteps,
          units: "kilometers" as const
        };

        const turfPos = this.config.turf.circle(lngLat, validRadius, options);
        if (!turfPos || !turfPos.geometry || !turfPos.geometry.coordinates || !Array.isArray(turfPos.geometry.coordinates[0])) {
          return [];
        }

        const convertedCoords = turfPos.geometry.coordinates[0];
        positions = convertedCoords.filter((coord: any) => Array.isArray(coord) && coord.length >= 2 && !isNaN(coord[0]) && !isNaN(coord[1]))
          .map((coord: [number, number]) => ({ lon: coord[0], lat: coord[1] }));

        return positions.map(coord => Cesium.Cartesian3.fromDegrees(coord.lon, coord.lat, 0));
      } catch (error) {
        console.error('生成多边形坐标出错:', error);
        return [];
      }
    };

    this.handler?.setInputAction((click: { position: Cesium.Cartesian2 }) => {
      if (click && click.position) {
        let cartesian = this.viewer.camera.pickEllipsoid(click.position, this.viewer.scene.globe.ellipsoid);
        if (!cartesian) return;

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
            positions: new Cesium.CallbackProperty(generatePolygonPositions, false) as any
          } as any,
          polygon: {
            hierarchy: new Cesium.CallbackProperty(() => {
              const positions = generatePolygonPositions();
              return new Cesium.PolygonHierarchy(positions);
            }, false) as any,
            material: new Cesium.ColorMaterialProperty(fillColor || this.config.material)
          } as any
        } as any);

        // 如果没有固定半径，则添加鼠标移动事件来动态调整半径
        if (!hasFixedRadius) {
          this.handler?.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);

          this.handler?.setInputAction((move: { endPosition: Cesium.Cartesian2 }) => {
            if (move && move.endPosition) {
              let cartesian2 = this.viewer.camera.pickEllipsoid(move.endPosition, this.viewer.scene.globe.ellipsoid);
              if (!cartesian2 || !centerCartesian) return;

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
      const planeData = { id, center: lngLat, positions };
      this.infoDetail.planeSelf.push(planeData);
      this.handler?.destroy();
      this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);

      if (this.callback) {
        this.callback(planeData);
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
  public drawPlane(fillColor?: Cesium.Color, borderColor?: Cesium.Color): void {
    this.removeEntity();
    // 渲染已存储的所有图形，确保保留之前绘制的图形
    this.renderStoredGraphics();
    const id = this.generateUniqueId();
    const ellipsoid = this.viewer.scene.globe.ellipsoid;

    let positions: Cesium.Cartesian3[] = [];
    let codeInfo: Array<{ lon: number; lat: number; }> = [];
    let finished = false;
    let isDrawing = true;

    const MAIN_TIP = '点击左键选择位置，点击右键结束';
    const WARN_TIP = '至少需要三个点';
    let warnTimer: NodeJS.Timeout | null = null;

    const showMainTip = (): void => {
      this.showMouseTip(MAIN_TIP);
    };

    const showWarnTip = (): void => {
      this.showMouseTip(WARN_TIP);
      if (warnTimer) clearTimeout(warnTimer);
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
      } as any,
      polygon: {
        hierarchy: new Cesium.CallbackProperty(() => {
          return new Cesium.PolygonHierarchy(positions);
        }, false),
        heightReference: (Cesium as any).HeightReference?.NONE,
        material: new Cesium.ColorMaterialProperty(fillColor || this.config.material),
        show: new Cesium.ConstantProperty(true),
        fill: true,
        outline: new Cesium.ConstantProperty(false)
      } as any
    } as any);

    // 鼠标左键点击，添加点
    this.handler?.setInputAction((movement: { position: Cesium.Cartesian2 }) => {
      if (!isDrawing || finished) return;
      const cartesian = this.viewer.camera.pickEllipsoid(movement.position, ellipsoid);
      if (!cartesian) return;
      const cartographic = Cesium.Cartographic.fromCartesian(cartesian, ellipsoid);
      const lon = Cesium.Math.toDegrees(cartographic.longitude);
      const lat = Cesium.Math.toDegrees(cartographic.latitude);

      positions.push(cartesian);
      codeInfo.push({ lon, lat });
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // 鼠标移动动态更新最后一个点（临时点）
    let lastTempPoint: Cesium.Cartesian3 | null = null;
    this.handler?.setInputAction((movement: { endPosition: Cesium.Cartesian2 }) => {
      if (!isDrawing || positions.length === 0 || finished) return;
      const cartesian = this.viewer.camera.pickEllipsoid(movement.endPosition, ellipsoid);
      if (!cartesian) return;
      // 先移除之前的临时点
      if (lastTempPoint) {
        positions.pop();
      }
      positions.push(cartesian);
      lastTempPoint = cartesian;
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    // 右键结束绘制，自动闭合多边形
    this.handler?.setInputAction(() => {
      if (!isDrawing || finished) return;
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

      const planeData = { id, positions: codeInfo };
      this.infoDetail.planeSelf.push(planeData);

      // 安全销毁事件处理器
      this.handler?.destroy();
      this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
      isDrawing = true; // 重置绘制状态，允许再次绘制

      if (this.callback) {
        this.callback(planeData);
      }
      setTimeout(() => {
        this.removeMouseTip();
        if (warnTimer) clearTimeout(warnTimer);
      }, 1);
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
  }

  /**
   * @description: 清理所有资源
   */
  public destroy(): void {
    this.removeEntity();
    this.infoDetail = { point: [], line: [], rectangle: [], circle: [], planeSelf: [] };
    this.callback = null;
    this.handler = null;
    this.drawObj = null;
  }
}

export default DrawTool;