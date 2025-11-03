interface InitViewerOptions {
    viewerId: string;
    config?: any;
}
declare const Object: {
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
        alpha?: number;
        brightness?: number;
        contrast?: number;
        gamma?: number;
        hue?: number;
        dayAlpha?: number;
        nightAlpha?: number;
        saturation?: number;
    }) => void;
};
export default Object;
