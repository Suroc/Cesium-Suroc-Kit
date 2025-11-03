interface DrawConfig {
    borderColor: Cesium.Color;
    borderWidth: number;
    material: Cesium.Color;
    turf?: any;
}
interface PointPosition {
    lon: number;
    lat: number;
    height: number;
}
interface LinePosition {
    id: string;
    positions: [number, number][];
}
interface RectanglePosition {
    id: string;
    positions: Array<{
        lon: number;
        lat: number;
    }>;
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
    positions: Array<{
        lon: number;
        lat: number;
    }>;
}
interface InfoDetail {
    point: PointPosition | [];
    line: LinePosition | [];
    rectangle: RectanglePosition | [];
    circle: CirclePosition | [];
    planeSelf: PlanePosition | [];
}
declare class DrawTool {
    private viewer;
    private config;
    private callback;
    private infoDetail;
    private handler;
    private drawObj;
    constructor(viewer: Cesium.Viewer, callback?: ((data: any) => void), config?: Partial<DrawConfig>);
    /**
     * @description: 显示鼠标提示
     * @param {string} tipText - 提示文本
     */
    private showMouseTip;
    /**
     * @description: 移除鼠标提示
     */
    private removeMouseTip;
    /**
      * @description: 移除实体对象和清理资源
      * @author: Suroc
      */
    private removeEntity;
    /**
     * @description: 安全地销毁事件处理器
     */
    private safelyDestroyHandler;
    /**
     * @description: 返回绘制数据
     * @return {InfoDetail} - 绘制数据
     * @author: Suroc
     */
    backInfoDetail(): InfoDetail;
    /**
     * @description: 绘制点数据（支持手动输入）
     * @param {number} [lon] - 经度（可选）
     * @param {number} [lat] - 纬度（可选）
     * @param {number} [alt] - 高度（可选）
     * @param {Cesium.Color} [pointColor] - 点颜色（可选）
     * @param {Cesium.Color} [outlineColor] - 边框颜色（可选）
     */
    drawPoint(id?: string, lon?: number, lat?: number, alt?: number, pointColor?: Cesium.Color, outlineColor?: Cesium.Color, length?: number, topRadius?: number): void;
    /**
     * @description: 绘制线段
     * @param {Cesium.Color} [lineColor] - 线条颜色（可选）
     * @author: Suroc
     */
    drawLine(lineColor?: Cesium.Color): void;
    /**
     * @description: 绘制矩形区域
     * @param {Cesium.Color} [fillColor] - 填充颜色（可选）
     * @param {Cesium.Color} [borderColor] - 边框颜色（可选）
     * @author: Suroc
     */
    drawRectangle(fillColor?: Cesium.Color, borderColor?: Cesium.Color): void;
    /**
     * @description: 绘制圆形区域
     * @param {Cesium.Color} [fillColor] - 填充颜色（可选）
     * @param {Cesium.Color} [borderColor] - 边框颜色（可选）
     * @author: Suroc
     */
    drawCircle(fillColor?: Cesium.Color, borderColor?: Cesium.Color): void;
    /**
     * @description: 绘制多边形区域（圆）
     * @param { number } steps - 步长（多边形边数）
     * @param { number } [radius] - 半径（可选，单位：千米），如果不提供则通过鼠标移动动态确定半径
     * @param { Cesium.Color } [fillColor] - 填充颜色（可选）
     * @param { Cesium.Color } [borderColor] - 边框颜色（可选）
     * @author: Suroc
     */
    drawCirclePlane(steps: number, radius?: number, fillColor?: Cesium.Color, borderColor?: Cesium.Color): void;
    /**
     * @description: 自定义区域绘制（多边形）
     * @param {Cesium.Color} [fillColor] - 填充颜色（可选）
     * @param {Cesium.Color} [borderColor] - 边框颜色（可选）
     * @author: Suroc
     */
    drawPlane(fillColor?: Cesium.Color, borderColor?: Cesium.Color): void;
    /**
     * @description: 清理所有资源
     */
    destroy(): void;
}
export default DrawTool;
