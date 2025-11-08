/*
 * @Author: Suroc
 * @Date: 2025-01-11 11:12:56
 * @LastEditTime: 2025-08-21 10:00:00
 * @Description: Cesium 基础设置类
 */

// 声明Cesium类型
declare const Cesium: any;

interface InitViewerOptions {
  viewerId: string;
  config?: any; // 使用any类型替代Cesium.Viewer.ConstructorOptions
}

const Object: {
  initAccessToken: (token: string) => void;
  initViewer: (options: InitViewerOptions) => Cesium.Viewer;
  depthTest: (viewer: any, flag?: boolean) => void;
  shadowChange: (viewer: any, flag?: boolean) => void;
  setShouldAnimate: (viewer: any, flag?: boolean) => void;
  setClockTime: (viewer: any, starTime?: Cesium.JulianDate, endTime?: Cesium.JulianDate) => void;
  setMultiplier: (viewer: any, val?: number) => void;
  sceneChange: (viewer: any, val: number, morph?: number) => void;
  lensHeight: (viewer: any, val?: number) => void;
  setImageryLayerEffect: (viewer: any, layerNum: number, options: {
    alpha?: number,
    brightness?: number,
    contrast?: number,
    gamma?: number,
    hue?: number,
    dayAlpha?: number,
    nightAlpha?: number,
    saturation?: number,
  }) => void;
} = {} as any;
// 移除全局处理器变量，现在每个viewer有独立的处理器

/**
 * @description 添加Token
 */
Object.initAccessToken = (token: string) => {
  Cesium.Ion.defaultAccessToken = token;
};

/**
 * @description 初始化 Viewer
 */
Object.initViewer = (options: InitViewerOptions): Cesium.Viewer => {
  let viewer = new Cesium.Viewer(
    options.viewerId,
    options.config ?? {
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
    }
  );
  return viewer;
};

/**
 * @description 开启地形深度检测
 */
Object.depthTest = (viewer: any, flag: boolean = false) => {
  if (!viewer || !viewer.scene || !viewer.scene.globe) return;
  viewer.scene.globe.depthTestAgainstTerrain = flag;
};

/**
 * @description 是否开启晨昏线
 */
Object.shadowChange = (viewer: any, flag: boolean = false) => {
  if (!viewer || !viewer.scene || !viewer.scene.globe) return;
  viewer.scene.globe.enableLighting = flag;
};

/**
 * @description Clock 暂停/播放
 */
Object.setShouldAnimate = (viewer: any, flag: boolean = false) => {
  if (!viewer) throw new Error('Viewer instance must be provided');
  viewer.clockViewModel.shouldAnimate = flag;
};

/**
 * @description Clock 时间
 */
Object.setClockTime = (viewer: any, starTime?: Cesium.JulianDate, endTime?: Cesium.JulianDate) => {
  if (!viewer) throw new Error('Viewer instance must be provided');
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
Object.setMultiplier = (viewer: any, val: number = 1) => {
  if (!viewer) throw new Error('Viewer instance must be provided');
  viewer.clock.multiplier = val;
};

/**
 * @description 2D/3D切换视角 
 * @param viewer Cesium viewer实例
 * @param val 1: 惯性系 2: 地固系 3: Columbus View 4: 2D 模式
 * @param morph 插值系数，默认 1.0
 */
Object.sceneChange = (viewer: any, val: number, morph: number = 1.0) => {
  if (!viewer) throw new Error('Viewer instance must be provided');

  // 为每个viewer创建独立的处理器存储
  const viewerHandlers = new Map();
  if (!viewerHandlers.has(viewer)) {
    viewerHandlers.set(viewer, {
      postUpdateHandler: null,
      cameraChangedHandler: null,
      isPostUpdateAdded: false
    });
  }
  const handlers = viewerHandlers.get(viewer);

  const cameraController = viewer.scene.screenSpaceCameraController;

  // --- 统一清理 ---
  if (handlers.postUpdateHandler && handlers.isPostUpdateAdded) {
    viewer.scene.postUpdate.removeEventListener(handlers.postUpdateHandler);
    handlers.isPostUpdateAdded = false;
  }
  if (handlers.cameraChangedHandler) {
    viewer.scene.camera.changed.removeEventListener(handlers.cameraChangedHandler);
    handlers.cameraChangedHandler = null;
  }

  // 默认非惯性系设置
  cameraController.minimumZoomDistance = 1.0;
  cameraController.maximumZoomDistance = Number.POSITIVE_INFINITY;

  if (val === 1) {
    // --- 惯性系 ---
    viewer.scene.morphTo3D(morph);

    handlers.postUpdateHandler = (scene: Cesium.Scene, time: Cesium.JulianDate) => {
      if (viewer.trackedEntity || scene.mode !== Cesium.SceneMode.SCENE3D) return;
      const icrfToFixed = Cesium.Transforms.computeIcrfToFixedMatrix(time);
      if (Cesium.defined(icrfToFixed)) {
        const { camera } = scene;
        const offset = Cesium.Cartesian3.clone(camera.position);
        const transform = Cesium.Matrix4.fromRotationTranslation(icrfToFixed);
        camera.lookAtTransform(transform, offset);
      }
    };
    viewer.scene.postUpdate.addEventListener(handlers.postUpdateHandler);
    handlers.isPostUpdateAdded = true;

    cameraController.minimumZoomDistance = 10;
    cameraController.maximumZoomDistance = 1e21;

    handlers.cameraChangedHandler = () => {
      cameraController.minimumZoomDistance = viewer.trackedEntity ? 0 : 1.0e7;
    };
    viewer.scene.camera.changed.addEventListener(handlers.cameraChangedHandler);

  } else if (val === 2) {
    // --- 地固系 ---
    viewer.scene.morphTo3D(morph);
  } else if (val === 3) {
    // --- Columbus View ---
    viewer.scene.morphToColumbusView(morph);
  } else if (val === 4) {
    // --- 2D 模式 ---
    viewer.scene.morphTo2D(morph);
  }
}

/**
 * @description 镜头高度
 */
Object.lensHeight = (viewer: any, val: number = 2) => {
  if (!viewer) throw new Error('Viewer instance must be provided');
  let cameraHeight: number;
  if (val === 1) cameraHeight = 20_000_000;
  else if (val === 2) cameraHeight = 40_000_000;
  else if (val === 3) cameraHeight = 80_000_000;
  else cameraHeight = val;

  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromRadians(0, 0.1347041811142886, cameraHeight),
  });
};

/**
 * @description 影像图层效果
 */
Object.setImageryLayerEffect = (viewer: any, layerNum: number, options: {
  alpha?: number,
  brightness?: number,
  contrast?: number,
  gamma?: number,
  hue?: number,
  dayAlpha?: number,
  nightAlpha?: number,
  saturation?: number,
} = {}) => {
  if (!viewer || !viewer.imageryLayers || viewer.imageryLayers.length === 0) {
    throw new Error('Viewer instance must be provided and have imagery layers');
  }
  const layer: any = viewer.imageryLayers.get(layerNum);
  if (!layer) return;

  if (options.alpha !== undefined) layer.alpha = options.alpha;
  if (options.brightness !== undefined) layer.brightness = options.brightness;
  if (options.contrast !== undefined) layer.contrast = options.contrast;
  if (options.gamma !== undefined) layer.gamma = options.gamma;
  if (options.hue !== undefined) layer.hue = options.hue;
  if (options.dayAlpha !== undefined) layer.dayAlpha = options.dayAlpha;
  if (options.nightAlpha !== undefined) layer.nightAlpha = options.nightAlpha;
  if (options.saturation !== undefined) layer.saturation = options.saturation;
}

export default Object;

