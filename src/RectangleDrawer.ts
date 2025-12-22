// 声明 Cesium 全局变量
declare const Cesium: any;

/**
 * 样式配置接口
 */
export interface RectangleStyle {
    // 正常状态 (Normal)
    themeColor?: string;       // 主色调 (默认天蓝色)
    themeColorDark?: string;   // 渐变暗部颜色
    capsuleColor?: string;     // 胶囊标签颜色
    // 警告状态 (Warning) - <minLimit 或 >maxLimit
    warningColor?: string;     // 警告主色 (默认柔和红)
    warningColorDark?: string; // 警告暗部

    fillAlpha?: number;        // 填充透明度
    lineWidth?: number;        // 边框线宽
    cornerSize?: number;       // 顶点大小 (像素)
    font?: string;             // 标签字体 (Canvas格式)
    minLimit?: number;         // 最小限制 (米)
    maxLimit?: number;         // 最大限制 (米)
    activeLimit?: number;      // 默认绘制尺寸 (米)
}

/**
 * 回调数据结构
 */
export interface DrawResult {
    width: number;            // 宽 (米)
    height: number;           // 高 (米)
    area: number;             // 面积 (平方公里)
    center: { lon: number, lat: number, alt: number };
    coordinates: Array<{ lon: number, lat: number }>;
    isWarning: boolean;       // 是否处于警告状态
}

/**
 * 矩形绘制工具类
 */
export class RectangleDrawer {
    private viewer: Cesium.Viewer;
    private handler: Cesium.ScreenSpaceEventHandler;

    // 状态标识
    private isDrawing: boolean = false;
    private activeOperation: 'none' | 'drag-center' | 'resize' = 'none';

    // 数据模型
    private state: {
        center: any;  // Cesium.Cartographic
        width: number;
        height: number;
    } | null = null;

    // 阈值常量
    private readonly MIN_LIMIT: number;    // 最小限制 (米)
    private readonly MAX_LIMIT: number;    // 最大限制 (米)
    private readonly ACTIVE_LIMIT: number; // 默认绘制尺寸 (米)

    // 样式配置
    private style: RectangleStyle;

    // 缓存的图形资源
    private assets: {
        normal: {
            color: any;           // Cesium.Color
            colorCss: string;     // CSS String
            pointIcon: string;    // DataURL
            moveIcon: string;     // DataURL
            capsuleColor: string; // DataURL
        },
        warning: {
            color: any;
            colorCss: string;
            pointIcon: string;
            moveIcon: string;
            capsuleColor: string;
        }
    };

    // 实体集合
    private entities: {
        fill: Cesium.Entity | null;
        outline: Cesium.Entity | null;
        centerPoint: Cesium.Entity | null;
        corners: Cesium.Entity[];
        labels: Cesium.Entity[];
    } = { fill: null, outline: null, centerPoint: null, corners: [], labels: [] };

    // 辅助计算对象
    private scratchGeodesic: any;

    // 事件回调
    public onChange: ((result: DrawResult) => void) | null = null;

    constructor(viewer: Cesium.Viewer, options?: RectangleStyle) {
        this.viewer = viewer;
        this.handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        this.scratchGeodesic = new Cesium.EllipsoidGeodesic();

        // 1. 初始化样式
        this.style = {
            themeColor: '#00A1FF',      // 亮部
            themeColorDark: '#0065ca',  // 暗部
            warningColor: '#E57373',    // 警告红
            warningColorDark: '#B71C1C',// 警告暗部
            capsuleColor: '#FFFFFF',   // 胶囊标签颜色
            fillAlpha: 0.15,
            lineWidth: 2,
            cornerSize: 12,
            font: 'bold 12px "Helvetica Neue", Helvetica, Arial, sans-serif',
            minLimit: 5000,            // 默认5km
            maxLimit: 1000000,          // 默认1000km
            activeLimit: 5000,          // 默认5km
            ...options
        };

        // 2. 初始化阈值常量
        this.MIN_LIMIT = this.style.minLimit!;
        this.MAX_LIMIT = this.style.maxLimit!;
        this.ACTIVE_LIMIT = this.style.activeLimit!;

        // 2. 预生成静态资源
        this.assets = {
            normal: {
                color: Cesium.Color.fromCssColorString(this.style.themeColor!),
                colorCss: this.style.themeColor!,
                pointIcon: this.createGradientPoint(this.style.themeColor!, this.style.themeColorDark!, this.style.cornerSize!),
                moveIcon: this.createMoveIcon(this.style.themeColor!),
                capsuleColor: this.style.capsuleColor!,
            },
            warning: {
                color: Cesium.Color.fromCssColorString(this.style.warningColor!),
                colorCss: this.style.warningColor!,
                pointIcon: this.createGradientPoint(this.style.warningColor!, this.style.warningColorDark!, this.style.cornerSize!),
                moveIcon: this.createMoveIcon(this.style.warningColor!),
                capsuleColor: this.style.capsuleColor!,
            }
        };

        this.initEvents();
    }

    // --- 公共 API ---

    public startDraw() {
        this.clear();
        this.isDrawing = true;
        this.viewer.canvas.style.cursor = 'crosshair';
        this.viewer.scene.screenSpaceCameraController.enableInputs = true;
    }

    public drawAt(longitude: number, latitude: number) {
        this.clear();
        const cartesian = Cesium.Cartesian3.fromDegrees(longitude, latitude);
        this.createEntities(cartesian);
        this.triggerCallback();
    }

    public clear() {
        const { fill, outline, centerPoint, corners, labels } = this.entities;
        if (fill) this.viewer.entities.remove(fill);
        if (outline) this.viewer.entities.remove(outline);
        if (centerPoint) this.viewer.entities.remove(centerPoint);
        corners.forEach(e => this.viewer.entities.remove(e));
        labels.forEach(e => this.viewer.entities.remove(e));

        this.entities = { fill: null, outline: null, centerPoint: null, corners: [], labels: [] };
        this.state = null;
        this.isDrawing = false;
        this.activeOperation = 'none';
        this.unlockCamera();
        this.viewer.canvas.style.cursor = 'default';
    }

    // --- 核心逻辑 ---

    private initEvents() {
        this.handler.setInputAction((event: any) => {
            if (this.isDrawing) {
                const cartesian = this.getCartesianFromScreen(event.position);
                if (cartesian) {
                    this.createEntities(cartesian);
                    this.isDrawing = false;
                    this.viewer.canvas.style.cursor = 'default';
                    this.triggerCallback();
                }
                return;
            }

            const picked = this.viewer.scene.pick(event.position);
            if (Cesium.defined(picked) && this.state) {
                const id = picked.id;
                if (id === this.entities.centerPoint) {
                    this.activeOperation = 'drag-center';
                    this.lockCamera();
                } else if (this.entities.corners.includes(id)) {
                    this.activeOperation = 'resize';
                    this.lockCamera();
                }
            }
        }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

        this.handler.setInputAction((event: any) => {
            const pos = event.endPosition || event.position;

            if (this.activeOperation === 'none') {
                this.updateCursorStyle(pos);
                return;
            }

            if (!this.state) return;
            const cartesian = this.getCartesianFromScreen(pos);
            if (!cartesian) return;

            if (this.activeOperation === 'drag-center') {
                this.state.center = Cesium.Cartographic.fromCartesian(cartesian);
            } else if (this.activeOperation === 'resize') {
                const currentGeo = Cesium.Cartographic.fromCartesian(cartesian);
                this.scratchGeodesic.setEndPoints(this.state.center, currentGeo);
                const distance = this.scratchGeodesic.surfaceDistance;
                const azimuth = this.scratchGeodesic.startHeading;

                const distEast = Math.abs(distance * Math.sin(azimuth));
                const distNorth = Math.abs(distance * Math.cos(azimuth));
                this.state.width = distEast * 2;
                this.state.height = distNorth * 2;
            }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        this.handler.setInputAction(() => {
            if (this.activeOperation !== 'none') {
                this.triggerCallback();
                this.activeOperation = 'none';
                this.unlockCamera();
            }
        }, Cesium.ScreenSpaceEventType.LEFT_UP);
    }

    // --- 实体创建 ---

    private createEntities(centerCartesian: Cesium.Cartesian3) {
        const center = Cesium.Cartographic.fromCartesian(centerCartesian);
        this.state = { center, width: this.ACTIVE_LIMIT, height: this.ACTIVE_LIMIT };

        // 1. 矩形填充
        this.entities.fill = this.viewer.entities.add({
            rectangle: {
                coordinates: new Cesium.CallbackProperty(() => this.computeRect(), false),
                material: new Cesium.ColorMaterialProperty(new Cesium.CallbackProperty(() => {
                    const isWarn = this.checkWarning();
                    const baseColor = isWarn ? this.assets.warning.color : this.assets.normal.color;
                    return baseColor.withAlpha(this.style.fillAlpha!);
                }, false)),
                outline: false
            }
        } as any);

        // 2. 独立边框线
        this.entities.outline = this.viewer.entities.add({
            polyline: {
                positions: new Cesium.CallbackProperty(() => {
                    const rect = this.computeRect();
                    const corners = this.getCornerCartesians(rect);
                    return [...corners, corners[0]];
                }, false),
                width: this.style.lineWidth,
                material: new Cesium.ColorMaterialProperty(new Cesium.CallbackProperty(() => {
                    return this.checkWarning() ? this.assets.warning.color : this.assets.normal.color;
                }, false)),
                clampToGround: true
            }
        } as any);

        // 3. 中心点
        this.entities.centerPoint = this.viewer.entities.add({
            position: new Cesium.CallbackProperty(() => Cesium.Cartographic.toCartesian(this.state!.center), false),
            billboard: {
                image: new Cesium.CallbackProperty(() => {
                    return this.checkWarning() ? this.assets.warning.moveIcon : this.assets.normal.moveIcon;
                }, false),
                verticalOrigin: Cesium.VerticalOrigin.CENTER,
                horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
                disableDepthTestDistance: Number.POSITIVE_INFINITY
            }
        } as any);

        // 4. 四个顶点
        for (let i = 0; i < 4; i++) {
            this.entities.corners.push(this.viewer.entities.add({
                position: new Cesium.CallbackProperty(() => this.computeCorner(i), false),
                billboard: {
                    image: new Cesium.CallbackProperty(() => {
                        return this.checkWarning() ? this.assets.warning.pointIcon : this.assets.normal.pointIcon;
                    }, false),
                    verticalOrigin: Cesium.VerticalOrigin.CENTER,
                    horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
                    disableDepthTestDistance: Number.POSITIVE_INFINITY
                }
            } as any));
        }

        // 5. 标签 (胶囊形状)
        for (let i = 0; i < 4; i++) {
            this.entities.labels.push(this.viewer.entities.add({
                position: new Cesium.CallbackProperty(() => this.computeLabelPos(i), false),
                // 优化：拖拽时隐藏 (activeOperation !== 'none' 时返回 false)
                show: new Cesium.CallbackProperty(() => {
                    return this.activeOperation === 'none';
                }, false),
                billboard: {
                    image: new Cesium.CallbackProperty(() => {
                        // 如果正在拖拽，直接返回空或不处理，节省 Canvas 绘制开销
                        // 配合 show:false 使用，这里其实不会被渲染，但逻辑上保持安全
                        if (this.activeOperation !== 'none') return '';

                        if (!this.state) return '';
                        const val = (i % 2 === 0 ? this.state.width : this.state.height);
                        const text = (val / 1000).toFixed(2) + ' km';
                        const isWarn = this.checkWarning();

                        return this.drawCapsuleLabel(
                            text,
                            isWarn ? this.assets.warning.capsuleColor : this.assets.normal.capsuleColor
                        );
                    }, false),
                    verticalOrigin: Cesium.VerticalOrigin.CENTER,
                    horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
                    disableDepthTestDistance: Number.POSITIVE_INFINITY,
                    scale: 1.0
                }
            } as any));
        }
    }

    // --- 图形资源生成器 (Canvas) ---

    // 1. 绘制胶囊标签
    private drawCapsuleLabel(text: string, bgColorCss: string): string {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return '';

        const font = this.style.font || 'bold 12px sans-serif';
        const paddingX = 4; // 左右边距

        // 设定固定高度，确保上下绝对对称 (例如 26px)
        const fixedHeight = 20;

        // 测量文字宽度
        ctx.font = font;
        const textWidth = ctx.measureText(text).width;

        const width = textWidth + paddingX * 2;
        const height = fixedHeight;

        // 预留一些边缘 Buffer 防止 Canvas 裁剪
        canvas.width = width + 4;
        canvas.height = height + 4;

        // 必须在 resize 后重新设置 Font
        ctx.font = font;
        ctx.textBaseline = 'middle'; // 垂直居中基线
        ctx.textAlign = 'center';    // 水平居中

        const x = 2; // 画布偏移 x
        const y = 2; // 画布偏移 y
        const rectW = width;
        const rectH = height;
        const radius = rectH / 2; // 圆角为高度一半，形成完美胶囊

        // 绘制胶囊背景
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(x, y, rectW, rectH, radius);
        } else {
            // 兼容写法
            ctx.moveTo(x + radius, y);
            ctx.lineTo(x + rectW - radius, y);
            ctx.quadraticCurveTo(x + rectW, y, x + rectW, y + radius);
            ctx.lineTo(x + rectW, y + rectH - radius);
            ctx.quadraticCurveTo(x + rectW, y + rectH, x + rectW - radius, y + rectH);
            ctx.lineTo(x + radius, y + rectH);
            ctx.quadraticCurveTo(x, y + rectH, x, y + rectH - radius);
            ctx.lineTo(x, y + radius);
            ctx.quadraticCurveTo(x, y, x + radius, y);
        }

        ctx.fillStyle = bgColorCss;
        ctx.fill();

        // 白色边框 (增强清晰度)
        ctx.strokeStyle = this.applyAlphaToColor(this.style.themeColor!, this.style.fillAlpha);
        ctx.lineWidth = 1;
        ctx.stroke();

        // 绘制文字
        ctx.fillStyle = this.checkWarning() ? this.assets.warning.colorCss : this.assets.normal.colorCss;
        // 计算绝对中心点
        const justifyX = x + rectW / 2;
        const justifyY = y + rectH / 2;

        // 在某些字体下，'middle' 视觉上会偏上，+1px 像素修正通常能让视觉更完美
        ctx.fillText(text, justifyX, justifyY + 1);

        return canvas.toDataURL();
    }

    // 2. 绘制移动图标
    private createMoveIcon(colorCss: string): string {
        const size = 32;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return '';

        const center = size / 2;     // 16
        const gap = 5;               // 中心留白半径 (线条从这里开始)
        const len = 8;              // 线条长度 (延伸到边缘)
        const arrowLen = 4;          // 箭头翼长

        // 定义绘制路径的核心函数 (不包含样式，只定义形状)
        const definePath = () => {
            ctx.beginPath();

            // 四个方向的十字箭头
            const directions = [
                { x: 0, y: -1, angle: -Math.PI / 2 }, // Up
                { x: 0, y: 1, angle: Math.PI / 2 },  // Down
                { x: -1, y: 0, angle: Math.PI },      // Left
                { x: 1, y: 0, angle: 0 }             // Right
            ];

            directions.forEach(dir => {
                // 线条起点 (从中心留白处开始)
                const startX = center + dir.x * gap;
                const startY = center + dir.y * gap;
                // 线条终点 (箭头尖端)
                const endX = center + dir.x * (gap + len);
                const endY = center + dir.y * (gap + len);

                // 1. 画主轴线
                ctx.moveTo(startX, startY);
                ctx.lineTo(endX, endY);

                // 2. 画箭头翼 (根据角度旋转)
                // 左翼
                ctx.moveTo(endX, endY);
                ctx.lineTo(
                    endX - arrowLen * Math.cos(dir.angle - Math.PI / 6),
                    endY - arrowLen * Math.sin(dir.angle - Math.PI / 6)
                );
                // 右翼
                ctx.moveTo(endX, endY);
                ctx.lineTo(
                    endX - arrowLen * Math.cos(dir.angle + Math.PI / 6),
                    endY - arrowLen * Math.sin(dir.angle + Math.PI / 6)
                );
            });
        };

        // 通用绘图设置
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        // --- 第一层：白色描边 (Halo) ---
        // 作用：提供背景对比度，让主线条在任何地图背景上都清晰
        definePath();
        ctx.strokeStyle = this.applyAlphaToColor(this.style.themeColor!, this.style.fillAlpha);
        ctx.lineWidth = 4; // 比主线宽，形成轮廓
        ctx.stroke();

        // --- 第二层：中心圆点 (白色底 + 有色芯) ---
        ctx.beginPath();
        ctx.arc(center, center, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = "white"; // 先画个白底遮住可能的线条杂质
        ctx.fill();

        ctx.beginPath();
        ctx.arc(center, center, 2.5, 0, Math.PI * 2); // 稍微小一点
        ctx.fillStyle = colorCss;
        ctx.fill();

        // --- 第三层：有色主线条 ---
        // 作用：显示主题色，线条细致
        definePath();
        ctx.strokeStyle = colorCss;
        ctx.lineWidth = 1.5; // <--- 关键：线条变细，显得轻薄
        ctx.stroke();

        return canvas.toDataURL();
    }

    // 3. 绘制渐变圆点
    private createGradientPoint(centerColor: string, edgeColor: string, size: number): string {
        const canvas = document.createElement('canvas');
        const dim = size * 2;
        canvas.width = dim; canvas.height = dim;
        const ctx = canvas.getContext('2d');
        if (!ctx) return '';

        const center = dim / 2;
        const radius = size / 2;
        const grad = ctx.createRadialGradient(center, center, radius * 0.2, center, center, radius);
        grad.addColorStop(0, centerColor);
        grad.addColorStop(1, edgeColor);

        ctx.beginPath();
        ctx.arc(center, center, radius, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.strokeStyle = this.applyAlphaToColor(this.style.themeColor!, this.style.fillAlpha);
        ctx.lineWidth = 2;
        ctx.stroke();

        return canvas.toDataURL();
    }


    // 将颜色字符串添加透明度 (支持 rgba 或十六进制)
    private applyAlphaToColor(color: string, alpha: number = 1): string {
        // 如果已是 rgba，直接替换 alpha
        const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)/);
        if (rgbaMatch) {
            const [_, r, g, b] = rgbaMatch;
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }

        // 处理十六进制颜色
        let r = 0, g = 0, b = 0;
        if (color.startsWith('#')) {
            const hex = color.slice(1);

            if (hex.length === 3) {
                r = parseInt(hex[0] + hex[0], 16);
                g = parseInt(hex[1] + hex[1], 16);
                b = parseInt(hex[2] + hex[2], 16);
            } else if (hex.length === 6) {
                r = parseInt(hex.slice(0, 2), 16);
                g = parseInt(hex.slice(2, 4), 16);
                b = parseInt(hex.slice(4, 6), 16);
            }
        }

        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    // --- 几何与逻辑 ---

    private checkWarning(): boolean {
        if (!this.state) return false;
        const w = this.state.width;
        const h = this.state.height;
        return (w < this.MIN_LIMIT || h < this.MIN_LIMIT || w > this.MAX_LIMIT || h > this.MAX_LIMIT);
    }

    private computeRect(): Cesium.Rectangle {
        if (!this.state) return new Cesium.Rectangle();
        const halfW = this.state.width / 2;
        const halfH = this.state.height / 2;

        const centerC3 = Cesium.Cartographic.toCartesian(this.state.center);
        const enu = Cesium.Transforms.eastNorthUpToFixedFrame(centerC3);
        const offset = new Cesium.Cartesian3(halfW, halfH, 0);
        const neC3 = Cesium.Matrix4.multiplyByPoint(enu, offset, new Cesium.Cartesian3());
        const neCart = Cesium.Cartographic.fromCartesian(neC3);

        const dLon = Math.abs(neCart.longitude - this.state.center.longitude);
        const dLat = Math.abs(neCart.latitude - this.state.center.latitude);

        return new Cesium.Rectangle(
            this.state.center.longitude - dLon,
            this.state.center.latitude - dLat,
            this.state.center.longitude + dLon,
            this.state.center.latitude + dLat
        );
    }

    private getCornerCartesians(rect: Cesium.Rectangle): Cesium.Cartesian3[] {
        return [
            Cesium.Cartesian3.fromRadians(rect.west, rect.north), // NW
            Cesium.Cartesian3.fromRadians(rect.east, rect.north), // NE
            Cesium.Cartesian3.fromRadians(rect.east, rect.south), // SE
            Cesium.Cartesian3.fromRadians(rect.west, rect.south)  // SW
        ];
    }

    private computeCorner(i: number): Cesium.Cartesian3 {
        const rect = this.computeRect();
        const corners = this.getCornerCartesians(rect);
        return corners[i];
    }

    private computeLabelPos(i: number): Cesium.Cartesian3 {
        const rect = this.computeRect();
        const lons = [(rect.west + rect.east) / 2, rect.east, (rect.west + rect.east) / 2, rect.west];
        const lats = [rect.north, (rect.north + rect.south) / 2, rect.south, (rect.north + rect.south) / 2];
        return Cesium.Cartesian3.fromRadians(lons[i], lats[i]);
    }

    private getCartesianFromScreen(px: any): any {
        const ray = this.viewer.camera.getPickRay(px);
        if (!ray) return undefined;
        return this.viewer.scene.globe.pick(ray, this.viewer.scene);
    }

    private updateCursorStyle(px: any) {
        const p = this.viewer.scene.pick(px);
        if (Cesium.defined(p)) {
            if (p.id === this.entities.centerPoint) {
                this.viewer.canvas.style.cursor = 'move';
                return;
            }
            if (this.entities.corners.includes(p.id)) {
                this.viewer.canvas.style.cursor = 'nwse-resize';
                return;
            }
        }
        this.viewer.canvas.style.cursor = this.isDrawing ? 'crosshair' : 'default';
    }

    private lockCamera() { this.viewer.scene.screenSpaceCameraController.enableInputs = false; }
    private unlockCamera() { this.viewer.scene.screenSpaceCameraController.enableInputs = true; }

    private triggerCallback() {
        if (!this.state || !this.onChange) return;
        const rect = this.computeRect();
        const area = (this.state.width * this.state.height) / 1000000;
        const toDeg = Cesium.Math.toDegrees;

        this.onChange({
            width: this.state.width,
            height: this.state.height,
            area: area,
            center: {
                lon: toDeg(this.state.center.longitude),
                lat: toDeg(this.state.center.latitude),
                alt: this.state.center.height
            },
            coordinates: [
                { lon: toDeg(rect.west), lat: toDeg(rect.north) },
                { lon: toDeg(rect.east), lat: toDeg(rect.north) },
                { lon: toDeg(rect.east), lat: toDeg(rect.south) },
                { lon: toDeg(rect.west), lat: toDeg(rect.south) }
            ],
            isWarning: this.checkWarning()
        });
    }

    public destroy() {
        this.handler.destroy();
        this.clear();
    }
}