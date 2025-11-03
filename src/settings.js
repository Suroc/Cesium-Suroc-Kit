/*
 * @Author: Suroc
 * @Date: 2025-01-11 11:12:56
 * @LastEditTime: 2025-08-21 10:00:00
 * @Description: Cesium 基础设置类
 */
const Object = {};
// 全局保存 handler 引用
let postUpdateHandler = null;
let cameraChangedHandler = null;
let isPostUpdateAdded = false;
/**
 * @description 添加Token
 */
Object.initAccessToken = (token) => {
    Cesium.Ion.defaultAccessToken = token;
};
/**
 * @description 初始化 Viewer
 */
Object.initViewer = (options) => {
    window.viewer = new Cesium.Viewer(options.viewerId, options.config ?? {
        shouldAnimate: true,
        geocoder: false,
        homeButton: false,
        sceneModePicker: false,
        navigationHelpButton: false,
        animation: true,
        timeline: true,
        fullscreenButton: false,
        selectionIndicator: false,
        infoBox: false,
        useBrowserRecommendedResolution: false,
        baseLayerPicker: false,
    });
    return window.viewer;
};
/**
 * @description 开启地形深度检测
 */
Object.depthTest = (flag = false) => {
    viewer.scene.globe.depthTestAgainstTerrain = flag;
};
/**
 * @description 是否开启晨昏线
 */
Object.shadowChange = (flag = false) => {
    viewer.scene.globe.enableLighting = flag;
};
/**
 * @description Clock 暂停/播放
 */
Object.setShouldAnimate = (flag = false) => {
    viewer.clockViewModel.shouldAnimate = flag;
};
/**
 * @description Clock 时间
 */
Object.setClockTime = (starTime, endTime) => {
    const clockStart = starTime ?? Cesium.JulianDate.now();
    const clockStop = endTime ?? Cesium.JulianDate.addHours(clockStart, 24 * 7, new Cesium.JulianDate());
    viewer.clock.startTime = clockStart;
    viewer.clock.stopTime = clockStop;
    viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP;
    viewer.clock.currentTime = clockStart;
};
/**
 * @description Clock 速度
 */
Object.setMultiplier = (val = 1) => {
    viewer.clock.multiplier = val;
};
/**
 * @description 2D/3D切换视角
 */
Object.sceneChange = (val) => {
    const cameraController = viewer.scene.screenSpaceCameraController;
    // --- 统一清理 ---
    if (postUpdateHandler && isPostUpdateAdded) {
        viewer.scene.postUpdate.removeEventListener(postUpdateHandler);
        isPostUpdateAdded = false;
    }
    if (cameraChangedHandler) {
        viewer.scene.camera.changed.removeEventListener(cameraChangedHandler);
        cameraChangedHandler = null;
    }
    // 默认非惯性系设置
    cameraController.minimumZoomDistance = 1.0;
    cameraController.maximumZoomDistance = Number.POSITIVE_INFINITY;
    if (val === 1) {
        // --- 惯性系 ---
        viewer.scene.mode = Cesium.SceneMode.SCENE3D;
        postUpdateHandler = (scene, time) => {
            if (viewer.trackedEntity || scene.mode !== Cesium.SceneMode.SCENE3D)
                return;
            const icrfToFixed = Cesium.Transforms.computeIcrfToFixedMatrix(time);
            if (Cesium.defined(icrfToFixed)) {
                const { camera } = scene;
                const offset = Cesium.Cartesian3.clone(camera.position);
                const transform = Cesium.Matrix4.fromRotationTranslation(icrfToFixed);
                camera.lookAtTransform(transform, offset);
            }
        };
        viewer.scene.postUpdate.addEventListener(postUpdateHandler);
        isPostUpdateAdded = true;
        cameraController.minimumZoomDistance = 10;
        cameraController.maximumZoomDistance = 1e21;
        cameraChangedHandler = () => {
            cameraController.minimumZoomDistance = viewer.trackedEntity ? 0 : 1.0e7;
        };
        viewer.scene.camera.changed.addEventListener(cameraChangedHandler);
    }
    else if (val === 2) {
        // --- 地固系 ---
        viewer.scene.mode = Cesium.SceneMode.SCENE3D;
    }
    else if (val === 3) {
        // --- Columbus View ---
        viewer.scene.mode = Cesium.SceneMode.COLUMBUS_VIEW;
    }
    else if (val === 4) {
        // --- 2D 模式 ---
        viewer.scene.mode = Cesium.SceneMode.SCENE2D;
    }
};
/**
 * @description 镜头高度
 */
Object.lensHeight = (val = 2) => {
    let cameraHeight;
    if (val === 1)
        cameraHeight = 20_000_000;
    else if (val === 2)
        cameraHeight = 40_000_000;
    else if (val === 3)
        cameraHeight = 80_000_000;
    else
        cameraHeight = val;
    viewer.camera.setView({
        destination: Cesium.Cartesian3.fromRadians(0, 0.1347041811142886, cameraHeight),
    });
};
/**
 * @description 影像图层效果
 */
Object.setImageryLayerEffect = (layerNum, options = {}) => {
    if (!viewer || !viewer.imageryLayers || viewer.imageryLayers.length === 0)
        return;
    const layer = viewer.imageryLayers.get(layerNum);
    layer.alpha = options.alpha;
    layer.brightness = options.brightness;
    layer.contrast = options.contrast;
    layer.gamma = options.gamma;
    layer.hue = options.hue;
    layer.dayAlpha = options.dayAlpha;
    layer.nightAlpha = options.nightAlpha;
    layer.saturation = options.saturation;
};
export default Object;
