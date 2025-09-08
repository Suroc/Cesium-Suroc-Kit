/*
 * @Author: Suroc
 * @Date: 2025-01-11 11:12:56
 * @LastEditTime: 2025-08-14 15:14:00
 * @Description: 
 */
const Object = {}


/**
 * @description 添加Token
 * @param {token} AccessToken
 */
Object.initAccessToken = (token) => {
  Cesium.Ion.defaultAccessToken = token
}

/**
 * @description 添加Token
 * @param {options} options
 * @param {viewerId} options.viewerId  // 容器ID
 * @param {config} options.config  // 容器ID  
 */
Object.initViewer = (options) => {
  let viewer = new Cesium.Viewer(options.viewerId, options.config ? options.config : {
    //自动播放
    shouldAnimate: true,
    //放大镜图标，查找位置工具，查找到之后会将镜头对准找到的地址，默认使用bing地图
    geocoder: false,
    //房子图标，视角返回初始位置
    homeButton: false,
    //经纬网图标，选择视角的模式，有三种：3D，2D，哥伦布视图（2.5D)
    sceneModePicker: false,
    //问号图标，导航帮助按钮，显示默认的地图控制帮助
    navigationHelpButton: false,
    //动画器件，显示当前时间，允许跳转特定时间
    animation: true,
    //时间轴
    timeline: true,
    //全屏图标，全屏按钮
    fullscreenButton: false,
    //默认点击
    selectionIndicator: false,
    infoBox: false,
    useBrowserRecommendedResolution: false,
    //离线地图
    baseLayerPicker: false
  })
  return viewer
}

/**
 * @description 开启地形深度检测
 * @param {flag} 开启true/关闭false
 */
Object.depthTest = (flag = false) => {
  viewer.scene.globe.depthTestAgainstTerrain = flag
}
/**
 * @description 是否开启晨昏线
 * @param {flag} 开启true/关闭false
 */
Object.shadowChange = (flag = false) => {
  viewer.scene.globe.enableLighting = flag
}
/**
 * @description Clock 暂停/播放
 * @param {flag}  速度
 */
Object.setShouldAnimate = (flag = false) => {
  viewer.clockViewModel.shouldAnimate = flag
}
/**
 * @description Clock 时间
 * @param {starTime}  time
 * @param {endTime}  time
 */
Object.setClockTime = (starTime, endTime) => {
  var clockStart = starTime ? starTime : Cesium.JulianDate.now()
  var clockStop = endTime ? endTime : Cesium.JulianDate.addHours(clockStart, 24 * 7, new Cesium.JulianDate())
  viewer.clock.startTime = clockStart
  viewer.clock.stopTime = clockStop
  viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP
  viewer.clock.currentTime = clockStart
}
/**
 * @description Clock  速度
 * @param {val}  速度
 */
Object.setMultiplier = (val = 1) => {
  val ? viewer.clock.multiplier = val : viewer.clock.multiplier = 1
}
/**
 * @description 初始化相机
 * @param {scene} 相机
 * @param {time}  时间
 */
Object.initCamera = (scene, time) => {
  if (scene.mode !== Cesium.SceneMode.SCENE3D) {
    return
  }
  let icrfToFixed = Cesium.Transforms.computeIcrfToFixedMatrix(time)
  if (Cesium.defined(icrfToFixed)) {
    let { camera } = scene
    let offset = Cesium.Cartesian3.clone(camera.position)
    let transform = Cesium.Matrix4.fromRotationTranslation(icrfToFixed)
    camera.lookAtTransform(transform, offset)
  }
}
/**
 * @description 2D/3D切换视角
 * @param {val}    参数
 * @param {camera} 相机
 */
Object.sceneChange = (val, camera) => {
  let cameraController = viewer.scene.screenSpaceCameraController
  if (val == 1) {
    const postUpdateHandler = (scene, time) => {
      // 添加跟踪状态检查
      if (viewer.trackedEntity || scene.mode !== Cesium.SceneMode.SCENE3D) {
        return;
      }

      let icrfToFixed = Cesium.Transforms.computeIcrfToFixedMatrix(time);
      if (Cesium.defined(icrfToFixed)) {
        let { camera } = scene;
        let offset = Cesium.Cartesian3.clone(camera.position);
        let transform = Cesium.Matrix4.fromRotationTranslation(icrfToFixed);
        camera.lookAtTransform(transform, offset);
      }
    };

    // 保存事件引用便于移除
    viewer.scene.postUpdate.addEventListener(postUpdateHandler);

    // 添加跟踪状态变化监听
    viewer.scene.camera.changed.addEventListener(() => {
      if (viewer.trackedEntity) {
        viewer.scene.postUpdate.removeEventListener(postUpdateHandler);
        cameraController.minimumZoomDistance = 0;
      } else {
        viewer.scene.postUpdate.addEventListener(postUpdateHandler);
        cameraController.minimumZoomDistance = 1000 * 10000; // 最小滚动视场（以米为单位）
      }
    });
    viewer.clock.multiplier = 1;
    viewer.clock.shouldAnimate = true;
    viewer.clockViewModel.shouldAnimate = true;
  } else if (val == 2) {
    viewer.scene.mode = Cesium.SceneMode.SCENE2D
    viewer.scene.mode = Cesium.SceneMode.SCENE3D
    viewer.scene.postUpdate.removeEventListener(Object.initCamera)
    cameraController.minimumZoomDistance = 10
    cameraController.maximumZoomDistance = 1e21
    if (newCreatunion) newCreatunion.useFixedFrame = false
  } else if (val == 3) {
    viewer.scene.mode = Cesium.SceneMode.COLUMBUS_VIEW
    viewer.scene.postUpdate.removeEventListener(Object.initCamera)
  } else if (val == 4) {
    viewer.scene.mode = Cesium.SceneMode.SCENE2D
    viewer.scene.postUpdate.removeEventListener(Object.initCamera)
  }
}
/**
 * @description 镜头高度
 * @param {val}   高度
 */
Object.lensHeight = (val = 2) => {
  let cameraHeight
  if (val === 1) {
    cameraHeight = 20000000
  } else if (val === 2) {
    cameraHeight = 40000000
  } else if (val === 3) {
    cameraHeight = 80000000
  } else {
    cameraHeight = val
  }
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromRadians(0, 0.1347041811142886, cameraHeight)
  })
}

export default Object