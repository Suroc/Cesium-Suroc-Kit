/*
 * @Author: Suroc
 * @Date: 2025-01-11 11:12:56
 * @LastEditTime: 2025-08-21 10:00:00
 * @Description: Cesium 基础设置类
 */

// 声明Cesium类型
declare const Cesium: any;
declare const window: any;
declare const viewer: any;

interface InitViewerOptions {
  viewerId: string;
  config?: any; // 使用any类型替代Cesium.Viewer.ConstructorOptions
}

const Object: {
  initAccessToken: (token: string) => void;
  initViewer: (options: InitViewerOptions) => Cesium.Viewer;
  depthTest: (flag?: boolean) => void;
  shadowChange: (flag?: boolean) => void;
  setShouldAnimate: (flag?: boolean) => void;
  setClockTime: (starTime?: Cesium.JulianDate, endTime?: Cesium.JulianDate) => void;
  setMultiplier: (val?: number) => void;
  sceneChange: (val: number, camera?: Cesium.Camera) => void;
  lensHeight: (val?: number) => void;
  setImageryLayerEffect: (layerNum: number, options: {
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
// 全局保存 handler 引用
let postUpdateHandler: ((scene: Cesium.Scene, time: Cesium.JulianDate) => void) | null = null;
let cameraChangedHandler: (() => void) | null = null;
let isPostUpdateAdded = false;

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
  window.viewer = new Cesium.Viewer(
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
  return window.viewer;
};

/**
 * @description 开启地形深度检测
 */
Object.depthTest = (flag: boolean = false) => {
  viewer.scene.globe.depthTestAgainstTerrain = flag;
};

/**
 * @description 是否开启晨昏线
 */
Object.shadowChange = (flag: boolean = false) => {
  viewer.scene.globe.enableLighting = flag;
};

/**
 * @description Clock 暂停/播放
 */
Object.setShouldAnimate = (flag: boolean = false) => {
  viewer.clockViewModel.shouldAnimate = flag;
};

/**
 * @description Clock 时间
 */
Object.setClockTime = (starTime?: Cesium.JulianDate, endTime?: Cesium.JulianDate) => {
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
Object.setMultiplier = (val: number = 1) => {
  viewer.clock.multiplier = val;
};

/**
 * @description 2D/3D切换视角
 */
Object.sceneChange = (val: number) => {
  const cameraController = viewer.scene.screenSpaceCameraController;

  // 切换前清理
  if (postUpdateHandler && isPostUpdateAdded) {
    viewer.scene.postUpdate.removeEventListener(postUpdateHandler);
    isPostUpdateAdded = false;
  }
  if (cameraChangedHandler) {
    viewer.scene.camera.changed.removeEventListener(cameraChangedHandler);
    cameraChangedHandler = null;
  }

  if (val === 1) {
    // 惯性系
    viewer.scene.mode = Cesium.SceneMode.SCENE3D;

    postUpdateHandler = (scene: Cesium.Scene, time: Cesium.JulianDate) => {
      if (viewer.trackedEntity || scene.mode !== Cesium.SceneMode.SCENE3D) return;
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

    cameraChangedHandler = () => {
      if (viewer.trackedEntity) {
        if (postUpdateHandler && isPostUpdateAdded) {
          viewer.scene.postUpdate.removeEventListener(postUpdateHandler);
          isPostUpdateAdded = false;
        }
        cameraController.minimumZoomDistance = 0;
      } else {
        if (postUpdateHandler && !isPostUpdateAdded) {
          viewer.scene.postUpdate.addEventListener(postUpdateHandler);
          isPostUpdateAdded = true;
        }
        cameraController.minimumZoomDistance = 1.0e7;
      }
    };
    viewer.scene.camera.changed.addEventListener(cameraChangedHandler);

  } else if (val === 2) {
    // 地固系
    viewer.scene.mode = Cesium.SceneMode.SCENE3D;
    cameraController.minimumZoomDistance = 10;
    cameraController.maximumZoomDistance = 1e21;

  } else if (val === 3) {
    // Columbus View
    viewer.scene.mode = Cesium.SceneMode.COLUMBUS_VIEW;

  } else if (val === 4) {
    // 2D 模式
    viewer.scene.mode = Cesium.SceneMode.SCENE2D;
  }
};

/**
 * @description 镜头高度
 */
Object.lensHeight = (val: number = 2) => {
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
Object.setImageryLayerEffect = (layerNum: number, options: {
  alpha?: number,
  brightness?: number,
  contrast?: number,
  gamma?: number,
  hue?: number,
  dayAlpha?: number,
  nightAlpha?: number,
  saturation?: number,
} = {}) => {
  if (!viewer || !viewer.imageryLayers || viewer.imageryLayers.length === 0)
    return;
  const layer: any = viewer.imageryLayers.get(layerNum);
  layer.alpha = options.alpha;
  layer.brightness = options.brightness;
  layer.contrast = options.contrast;
  layer.gamma = options.gamma;
  layer.hue = options.hue;
  layer.dayAlpha = options.dayAlpha;
  layer.nightAlpha = options.nightAlpha;
  layer.saturation = options.saturation;
}

export default Object;
