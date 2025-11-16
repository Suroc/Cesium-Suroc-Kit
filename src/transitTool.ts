/*
 * @Author: Suroc
 * @Description: Cesium 绘制工具 - 提供点、矩形、多边形绘制功能，支持鼠标提示和label显示
 */

// Cesium 全局变量声明
declare const Cesium: any;

// 定义图形类型枚举
enum ShapeType {
  POINT = 'point',
  RECTANGLE = 'rectangle',
  POLYGON = 'polygon'
}

// 定义配置接口
interface TransitConfig {
  borderColor: any; // Cesium.Color
  borderWidth: number;
  fillColor: any; // Cesium.Color
}

// 定义点位数据接口
interface PointData {
  lon: number;
  lat: number;
  height?: number;
}

// 定义图形回显数据接口
interface EchoData {
  type: ShapeType;
  positions: PointData[];
  label?: string;
  id?: string;
}

// 节流函数 - 泛型实现，保留类型安全
function throttle<T extends (...args: any[]) => any>(func: T, delay: number = 16): (...args: Parameters<T>) => void {
  let lastCall = 0;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      func(...args);
    }
  };
}

// 定义绘制结果类型
interface DrawingResult {
  type?: ShapeType;
  entity: any; // Cesium.Entity
  positions: any[]; // Cesium.Cartesian3[]
}

class TransitTool {
  private viewer: any; // Cesium.Viewer
  private config: TransitConfig;
  private currentShapeType: ShapeType | null = null;
  private handler: any | null = null; // Cesium.ScreenSpaceEventHandler
  private drawObj: any | null = null; // Cesium.Entity
  private currentPositions: any[] = []; // Cesium.Cartesian3[]
  private currentLabel: string = '';
  private allDrawings: Map<string, any> = new Map(); // Map<string, Cesium.Entity>
  private callback?: (data: DrawingResult) => void;

  /**
   * 构造函数
   * @param viewer Cesium Viewer实例
   * @param callback 绘制完成后的回调函数
   * @param config 配置选项
   */
  constructor(viewer: any, callback?: (data: DrawingResult) => void, config?: Partial<TransitConfig>) {
    if (!viewer) {
      throw new Error('Cesium Viewer实例是必需的');
    }

    this.viewer = viewer;
    this.config = {
      borderColor: config?.borderColor || Cesium.Color.fromCssColorString('#FFFF00'),
      borderWidth: config?.borderWidth || 2,
      fillColor: config?.fillColor || Cesium.Color.fromCssColorString('#FFFF00').withAlpha(0.3)
    };
    this.callback = callback;

    // 初始化事件处理器
    this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
  }

  /**
   * 开始绘制点
   * @param label 点的标签文本（可选）
   */
  public drawPoint(label?: string): void {
    this._prepareAndStartDrawing(ShapeType.POINT, label, '点击添加点');
  }

  /**
   * 开始绘制矩形
   * @param label 矩形的标签文本（可选）
   */
  public drawRectangle(label?: string): void {
    this._prepareAndStartDrawing(ShapeType.RECTANGLE, label, '点击开始，拖动调整，再次点击完成');
  }

  /**
   * 开始绘制多边形
   * @param label 多边形的标签文本（可选）
   */
  public drawPlane(label?: string): void {
    this._prepareAndStartDrawing(ShapeType.POLYGON, label, '点击添加顶点，双击完成');
  }

  /**
   * 准备并启动绘制（合并重复逻辑）
   * @private
   */
  private _prepareAndStartDrawing(type: ShapeType, label?: string, tipText?: string): void {
    this._prepareDrawing(type, label);

    // 显示鼠标提示（如果有）
    if (tipText) {
      this._showMouseTip(tipText);
    }

    // 根据类型设置相应的事件处理器
    switch (type) {
      case ShapeType.POINT:
        this._setupPointDrawingHandler();
        break;
      case ShapeType.RECTANGLE:
        this._setupRectangleDrawingHandler();
        break;
      case ShapeType.POLYGON:
        this._setupPolygonDrawingHandler();
        break;
    }
  }

  /**
   * 清除所有绘制的图形
   */
  public clearAll(): void {
    this._cleanupDrawing();
    // 优化清除逻辑，添加存在性检查
    this.allDrawings.forEach(entity => {
      if (this.viewer.entities.contains(entity)) {
        this.viewer.entities.remove(entity);
      }
    });
    this.allDrawings.clear();
  }

  /**
   * 根据点位数据进行图形回显
   * @param data 图形回显数据
   */
  public echoShape(data: EchoData): Cesium.Entity | null {
    if (!data || !data.positions || data.positions.length === 0) {
      console.warn('回显数据不完整');
      return null;
    }

    const { type, positions, label, id } = data;
    const entityId = id || `echo_${Date.now()}`;

    try {
      // 根据类型判断并回显图形
      switch (type) {
        case ShapeType.POINT:
          if (positions.length == 1) {
            return this._echoPoint(entityId, positions[0], label || '');
          }
          break;

        case ShapeType.RECTANGLE:
          if (positions.length == 4) {
            return this._echoRectangle(entityId, positions, label || '');
          }
          break;

        case ShapeType.POLYGON:
          if (positions.length > 4) {
            return this._echoPolygon(entityId, positions, label || '');
          }
          break;

        default:
          console.warn('不支持的图形类型');
      }
    } catch (error) {
      console.error('图形回显失败:', error);
    }

    return null;
  }

  /**
   * 准备绘制环境
   * @private
   */
  private _prepareDrawing(type: ShapeType, label?: string): void {
    this._cleanupDrawing();
    this.currentShapeType = type;
    this.currentLabel = label || '';
    this.currentPositions = [];
  }

  /**
   * 清理绘制状态
   * @private
   */
  private _cleanupDrawing(): void {
    // 移除鼠标提示
    this._removeMouseTip();

    // 清理临时对象
    if (this.drawObj) {
      this.viewer.entities.remove(this.drawObj);
      this.drawObj = null;
    }

    // 重置事件处理器
    this._resetHandler();
  }

  /**
   * 重置事件处理器
   * @private
   */
  private _resetHandler(): void {
    // 简化的事件处理器重置，确保总是有可用的处理器
    if (this.handler) {
      try {
        (this.handler as any).destroy?.();
      } catch (e) {
        console.warn('销毁事件处理器失败:', e);
      }
    }

    // 总是创建新的处理器
    this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
  }

  /**
   * 显示鼠标提示
   * @private
   */
  private _showMouseTip(tipText: string): void {
    let tip = document.getElementById('transit-mouse-tip');
    if (!tip) {
      tip = document.createElement('div');
      tip.id = 'transit-mouse-tip';
      tip.style.cssText = `
        position: fixed;
        z-index: 999999;
        pointer-events: none;
        background: rgba(0, 0, 0, 0.7);
        color: #fff;
        padding: 6px 12px;
        border-radius: 4px;
        font-size: 10px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        user-select: none;
        white-space: nowrap;
      `;
      document.body.appendChild(tip);
    }

    // 更新或创建移动事件处理器
    if ((tip as any)._moveHandler) {
      document.removeEventListener('mousemove', (tip as any)._moveHandler);
    }

    (tip as any)._moveHandler = (e: MouseEvent): void => {
      tip!.style.left = (e.clientX + 15) + 'px';
      tip!.style.top = (e.clientY - 30) + 'px';
    };

    document.addEventListener('mousemove', (tip as any)._moveHandler);
    tip.innerText = tipText;
  }

  /**
   * 移除鼠标提示
   * @private
   */
  private _removeMouseTip(): void {
    const tip = document.getElementById('transit-mouse-tip');
    if (tip) {
      document.removeEventListener('mousemove', (tip as any)._moveHandler);
      tip.remove();
    }
  }

  /**
   * 设置通用事件处理器（右键取消绘制）
   * @private
   */
  private _setupCommonEventHandlers(cleanupFn?: () => void): void {
    // 无需检查handler，由_resetHandler确保可用性
    this.handler.setInputAction(() => {
      cleanupFn?.(); // 使用可选链调用简化代码
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
  }

  /**
   * 设置点绘制的事件处理器
   * @private
   */
  private _setupPointDrawingHandler(): void {
    // 无需额外检查，_resetHandler确保handler总是可用
    this.handler.setInputAction((event: any) => {
      const position = this._getPositionFromEvent(event);
      if (position) {
        const entityId = `point_${Date.now()}`;
        const pointEntity = this._createPoint(entityId, position, this.currentLabel);

        this._completeDrawing({
          entity: pointEntity,
          positions: [position]
        });
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // 设置通用事件处理器
    this._setupCommonEventHandlers();
  }

  /**
   * 设置矩形绘制的事件处理器
   * @private
   */
  private _setupRectangleDrawingHandler(): void {

    let isDrawing = false;
    let startPosition: Cesium.Cartesian3 | null = null;

    // 左键点击开始/结束绘制
    this.handler.setInputAction((event: any) => {
      const position = this._getPositionFromEvent(event);
      if (!position) return;

      if (!isDrawing) {
        // 第一次点击，记录起始点
        isDrawing = true;
        startPosition = position;
        this._showMouseTip('拖动调整，点击完成');
      } else {
        // 第二次点击，完成绘制
        isDrawing = false;
        const entityId = `rect_${Date.now()}`;
        const rectEntity = this._createRectangle(entityId, startPosition!, position, this.currentLabel);

        this._completeDrawing({
          type: ShapeType.RECTANGLE,
          entity: rectEntity,
          positions: [startPosition!, position]
        });
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // 创建节流版本的更新函数
    const throttledUpdateRectangle = throttle((position: Cesium.Cartesian3) => {
      if (!this.drawObj) {
        // 只在第一次创建实体
        this.drawObj = this._createRectangle(undefined, startPosition!, position, '', true);
      } else if (this.drawObj.rectangle) {
        // 更新现有实体的属性，避免重新创建
        const bounds = this._getCoordinatesBounds(startPosition!, position);
        (this.drawObj.rectangle as any).west = bounds.west;
        (this.drawObj.rectangle as any).south = bounds.south;
        (this.drawObj.rectangle as any).east = bounds.east;
        (this.drawObj.rectangle as any).north = bounds.north;
      }
    }, 50); // 50ms的节流间隔

    // 鼠标移动，动态更新矩形
    this.handler.setInputAction((event: any) => {
      if (isDrawing && startPosition) {
        const position = this._getPositionFromEvent(event);
        if (position) {
          throttledUpdateRectangle(position);
        }
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    // 设置通用事件处理器
    this._setupCommonEventHandlers(() => {
      isDrawing = false;
    });
  }

  /**
   * 设置多边形绘制的事件处理器
   * @private
   */
  private _setupPolygonDrawingHandler(): void {

    // 左键点击添加顶点
    this.handler.setInputAction((event: any) => {
      const position = this._getPositionFromEvent(event);
      if (!position) return;

      if (this.currentPositions.length === 0) {
        this.currentPositions.push(position);
        this._showMouseTip('继续添加顶点，双击或闭合完成');
      } else {
        // 检查是否点击了第一个点（完成多边形）
        const firstPosition = this.currentPositions[0];
        const distance = Cesium.Cartesian3.distance(position, firstPosition);

        if (distance < 10000) { // 10km以内视为点击了第一个点
          this._finalizePolygon();
        } else {
          this.currentPositions.push(position);
          this._updateTemporaryPolygon();
        }
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // 双击完成绘制
    this.handler.setInputAction(() => {
      if (this.currentPositions.length >= 3) {
        this._finalizePolygon();
      }
    }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

    // 创建节流版本的更新函数
    const throttledUpdatePolygon = throttle((position: Cesium.Cartesian3) => {
      // 创建临时多边形（包括当前鼠标位置）
      const tempPositions = [...this.currentPositions, position];
      this._updateTemporaryPolygon(tempPositions);
    }, 50); // 50ms的节流间隔

    // 鼠标移动，动态更新多边形
    this.handler.setInputAction((event: any) => {
      if (this.currentPositions.length > 0) {
        const position = this._getPositionFromEvent(event);
        if (position) {
          throttledUpdatePolygon(position);
        }
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    // 设置通用事件处理器
    this._setupCommonEventHandlers();
  }

  /**
   * 完成多边形绘制
   * @private
   */
  private _finalizePolygon(): void {
    if (this.currentPositions.length < 3) return;

    const entityId = `polygon_${Date.now()}`;
    // 创建positions的副本避免引用问题
    const positionsCopy = [...this.currentPositions];
    const polygonEntity = this._createPolygon(entityId, positionsCopy, this.currentLabel);

    this._completeDrawing({
      entity: polygonEntity,
      positions: positionsCopy
    });
  }

  /**
   * 更新临时多边形
   * @private
   */
  private _updateTemporaryPolygon(positions?: Cesium.Cartesian3[]): void {
    const tempPositions = positions || this.currentPositions;

    if (tempPositions.length >= 2) {
      // 如果临时对象类型不匹配，需要重新创建
      if (!this.drawObj || !this.drawObj.polygon) {
        // 先清理现有临时对象
        if (this.drawObj) {
          this.viewer.entities.remove(this.drawObj);
          this.drawObj = null;
        }

        // 创建新的临时多边形
        this.drawObj = new Cesium.Entity({
          polygon: {
            hierarchy: new Cesium.PolygonHierarchy(tempPositions),
            material: this.config.fillColor,
            outline: true,
            outlineWidth: this.config.borderWidth,
            outlineColor: this.config.borderColor
          }
        });
        this.viewer.entities.add(this.drawObj);
      } else {
        // 直接更新多边形层次结构，避免重新创建
        this.drawObj.polygon.hierarchy = new Cesium.PolygonHierarchy(tempPositions);
      }
    }
  }

  /**
   * 从事件中获取位置
   * @private
   */
  private _getPositionFromEvent(event: any): Cesium.Cartesian3 | null {
    const ray = this.viewer.camera.getPickRay(event.position);
    if (!ray) return null;

    const position = this.viewer.scene.globe.pick(ray, this.viewer.scene);
    if (!position) {
      // 如果没有在地球上拾取到点，尝试在椭球上拾取
      const cartesian = this.viewer.scene.camera.pickEllipsoid(event.position);
      return cartesian;
    }

    return position;
  }

  /**
   * 创建点实体
   * @private
   */
  private _createPoint(id: string, position: Cesium.Cartesian3, label: string): Cesium.Entity {
    const entity = new Cesium.Entity({
      id: id,
      name: 'Point',
      position: position,
      point: {
        pixelSize: 10,
        color: this.config.borderColor,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      }
    });

    // 添加标签
    if (label) {
      entity.label = {
        ...this._createLabelOptions(label),
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -15)
      };
    }

    this.viewer.entities.add(entity);
    this.allDrawings.set(id, entity);
    return entity;
  }

  /**
   * 提取坐标边界
   * @private
   */
  private _getCoordinatesBounds(start: Cesium.Cartesian3, end: Cesium.Cartesian3): { west: number; east: number; south: number; north: number } {
    const startCartographic = Cesium.Cartographic.fromCartesian(start);
    const endCartographic = Cesium.Cartographic.fromCartesian(end);

    return {
      west: Math.min(Cesium.Math.toDegrees(startCartographic.longitude), Cesium.Math.toDegrees(endCartographic.longitude)),
      east: Math.max(Cesium.Math.toDegrees(startCartographic.longitude), Cesium.Math.toDegrees(endCartographic.longitude)),
      south: Math.min(Cesium.Math.toDegrees(startCartographic.latitude), Cesium.Math.toDegrees(endCartographic.latitude)),
      north: Math.max(Cesium.Math.toDegrees(startCartographic.latitude), Cesium.Math.toDegrees(endCartographic.latitude))
    };
  }

  /**
   * 创建矩形实体（可用于正式和临时矩形）
   * @private
   */
  private _createRectangle(id: string | undefined, start: Cesium.Cartesian3, end: Cesium.Cartesian3, label: string = '', isTemporary: boolean = false): Cesium.Entity {
    const bounds = this._getCoordinatesBounds(start, end);

    const entity = new Cesium.Entity({
      id: id,
      name: 'Rectangle',
      rectangle: {
        coordinates: Cesium.Rectangle.fromDegrees(bounds.west, bounds.south, bounds.east, bounds.north),
        material: this.config.fillColor,
        outline: true,
        outlineWidth: this.config.borderWidth,
        outlineColor: this.config.borderColor
      }
    });

    // 添加标签（放在矩形中心）
    if (label) {
      const centerLon = (bounds.west + bounds.east) / 2;
      const centerLat = (bounds.south + bounds.north) / 2;
      entity.position = Cesium.Cartesian3.fromDegrees(centerLon, centerLat);
      entity.label = this._createLabelOptions(label);
    }

    this.viewer.entities.add(entity);

    // 只在非临时矩形时添加到allDrawings
    if (!isTemporary && id) {
      this.allDrawings.set(id, entity);
    }

    return entity;
  }

  /**
   * 创建标签选项配置
   * @private
   */
  private _createLabelOptions(text: string): any {
    return {
      text: text,
      showBackground: true,
      backgroundColor: new Cesium.Color(0, 0, 0, 0.7),
      font: '14px sans-serif'
    };
  }

  /**
   * 创建多边形实体
   * @private
   */
  private _createPolygon(id: string, positions: Cesium.Cartesian3[], label: string): Cesium.Entity {
    const entity = new Cesium.Entity({
      id: id,
      name: 'Polygon',
      polygon: {
        hierarchy: new Cesium.PolygonHierarchy(positions),
        material: this.config.fillColor,
        outline: true,
        outlineWidth: this.config.borderWidth,
        outlineColor: this.config.borderColor
      }
    });

    // 添加标签（放在多边形中心）
    if (label) {
      // 计算多边形中心点
      const center = this._calculatePolygonCenter(positions);
      if (center) {
        entity.position = center;
        entity.label = this._createLabelOptions(label);
      }
    }

    this.viewer.entities.add(entity);
    this.allDrawings.set(id, entity);
    return entity;
  }

  /**
   * 计算多边形中心点
   * @private
   */
  private _calculatePolygonCenter(positions: Cesium.Cartesian3[]): Cesium.Cartesian3 | null {
    if (positions.length === 0) return null;

    let sumLon = 0;
    let sumLat = 0;
    let sumHeight = 0;

    for (const position of positions) {
      const cartographic = Cesium.Cartographic.fromCartesian(position);
      sumLon += Cesium.Math.toDegrees(cartographic.longitude);
      sumLat += Cesium.Math.toDegrees(cartographic.latitude);
      sumHeight += cartographic.height || 0;
    }

    const avgLon = sumLon / positions.length;
    const avgLat = sumLat / positions.length;
    const avgHeight = sumHeight / positions.length;

    return Cesium.Cartesian3.fromDegrees(avgLon, avgLat, avgHeight);
  }

  /**
   * 完成绘制
   * @private
   */
  private _completeDrawing(result: any): void {
    // 保存当前绘制状态（类型和标签）
    const drawType = this.currentShapeType;
    const drawLabel = this.currentLabel;

    // 使用统一的清理方法
    this._cleanupDrawing();

    // 确保结果中包含必要的信息
    const drawingResult = {
      type: drawType,
      ...result,
      label: drawLabel
    };

    // 使用可选链简化回调执行
    this.callback?.(drawingResult);
  }

  /**
   * 回显点图形
   * @private
   */
  private _echoPoint(id: string, point: PointData, label: string): Cesium.Entity {
    const position = Cesium.Cartesian3.fromDegrees(point.lon, point.lat, point.height || 0);
    return this._createPoint(id, position, label);
  }

  /**
   * 回显矩形图形
   * @private
   */
  private _echoRectangle(id: string, points: PointData[], label: string): Cesium.Entity {
    // 找到边界点
    let minLon = Infinity, maxLon = -Infinity;
    let minLat = Infinity, maxLat = -Infinity;

    points.forEach(point => {
      minLon = Math.min(minLon, point.lon);
      maxLon = Math.max(maxLon, point.lon);
      minLat = Math.min(minLat, point.lat);
      maxLat = Math.max(maxLat, point.lat);
    });

    const start = Cesium.Cartesian3.fromDegrees(minLon, minLat);
    const end = Cesium.Cartesian3.fromDegrees(maxLon, maxLat);
    return this._createRectangle(id, start, end, label);
  }

  /**
   * 回显多边形图形
   * @private
   */
  private _echoPolygon(id: string, points: PointData[], label: string): Cesium.Entity {
    const positions = points.map(point =>
      Cesium.Cartesian3.fromDegrees(point.lon, point.lat, point.height || 0)
    );

    return this._createPolygon(id, positions, label);
  }

  /**
   * 销毁工具实例，清理资源
   */
  public destroy(): void {
    this.clearAll();
    this._removeMouseTip();

    // 简化销毁逻辑，使用可选链避免类型检查
    if (this.handler) {
      this.handler.destroy?.();
      this.handler = null;
    }
  }
}

export default TransitTool;