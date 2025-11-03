interface TLEData {
    name?: string;
    noradId?: string | number;
    line1: string;
    line2: string;
    type?: string;
    model?: string;
}
declare const Object: {
    SurocSGP4: typeof SurocSGP4;
    Slab: typeof Slab;
    Sgp4: typeof Sgp4;
    Elements: typeof Elements;
    ResonanceState: typeof ResonanceState;
    Constants: typeof Constants;
    Bindings: typeof Bindings;
    clamp_guest: (val: number, min: number, max: number) => number;
    data_view: (mem: any, ...args: any[]) => any;
    to_string: (val: any) => string;
    utf8_encode: (s: string, realloc: Function, memory: {
        buffer: ArrayBuffer;
    }) => number;
    utf8_encoded_len: () => number;
};
declare class SurocSGP4 {
    private token;
    private wasmurl;
    private viewer;
    private bindings;
    private sgp4Module;
    private pointsCollection;
    private pointsCollectionPrimitives;
    private pointsCollectionPrimitivesLen;
    private matchingIndexMetadata;
    private timeLimit;
    private animatePoints;
    private pixelSize;
    private outlineWidth;
    private _Color;
    private _Model;
    private ModelSize;
    private ModelScale;
    private MoveEntity;
    private stepSeconds;
    private _movePolyline;
    private _polylineMap;
    private referenceFrame;
    private Elements;
    private Constants;
    private unauthorized?;
    constructor(options: {
        token?: string;
        wasmurl: string;
        viewer?: any;
        pixelSize?: number;
        outlineWidth?: number;
        color?: any;
        model?: boolean;
        ModelSize?: number;
        ModelScale?: number;
        stepSeconds?: number;
        referenceFrame?: string;
    });
    /**
     * @description 初始化
     * @param {TLEData[]} TLEs 卫星轨道数据
     */
    init(TLEs: TLEData[]): Promise<void>;
    /**
     * @description 解密数据
     * @param {string} data 加密数据
     * @returns {any} 解密后的数据
     */
    decryptedData(data: string): any;
    /**
     * @description 解密数据
     * @param {string} ciphertext 加密数据
     * @param {string} key 密钥
     * @returns {string} 解密后的字符串
     */
    _decryptByDESModeEBC(ciphertext: string, key: string): string;
    /**
     * @description 通用函数：将 TEME 坐标转换为 J2000 (ICRF) 坐标
     * @param {any} temePosition TEME 坐标（单位：米）
     * @param {any} jd 当前时间（JulianDate）
     * @returns {any|null} 返回转换后的 J2000 坐标，转换失败返回 null
     */
    _temeToJ2000Cached(temePosition: any, jd: any): any | null;
    /**
     * @description 显示或高亮目标轨道（不卡顿版）
     * @param {string|number|{id: string|number}} val 卫星目标ID
     * @param {any} activeColor 激活颜色
     * @param {string} type MOVE / CLICK
     * @param {boolean} flag 是否强制删除（点击同一目标时关闭）
     * @returns {any|null}
     */
    _targetOrbit(val: string | number | {
        id: string | number;
    }, activeColor: any, type?: string, flag?: boolean): any | null;
    /**
     * @description 创建高精度 PositionProperty（支持 INERTIAL/FIXED，Hermite 插值）
     * @param {any} sgp4Constants SGP4 常量对象
     * @param {number} TLEEpochTs TLE epoch 毫秒时间戳
     * @param {number} totalSeconds 总采样时长（秒）
     * @returns {{positionProperty: any, velocityProperty: any}}
     */
    _getPositionProperty(sgp4Constants: any, TLEEpochTs: number, totalSeconds: number): {
        positionProperty: any;
        velocityProperty: any;
    };
    /**
     * @description 移除目标轨道
     * @param {string|number|Array<string|number>} ids 卫星目标ID（DELETE时必填）
     * @param {string} type CLICK/MOVE
     */
    _deleteOrbit(ids?: string | number | Array<string | number>, type?: string): void;
    /**
     * @description 持续渲染
     */
    _animatePoints(): void;
    /**
     * @description 销毁
     */
    destroy(): void;
}
declare class Slab {
    private list;
    private head;
    constructor();
    insert(val: any): number;
    get(idx: number): any;
    remove(idx: number): any;
}
declare class Sgp4 {
    private instance?;
    private _resource0_slab;
    private _resource1_slab;
    private _resource2_slab;
    private _registry0?;
    private _registry1?;
    private _registry2?;
    private _exports?;
    constructor();
    addToImports(imports: Record<string, any>): void;
    instantiate(module: WebAssembly.Module | WebAssembly.Instance | ArrayBuffer | Uint8Array, imports?: Record<string, any>): Promise<void>;
    orbitFromKozaiElements(arg0: any, arg1: any, arg2: any, arg3: any, arg4: any, arg5: any, arg6: any): {
        tag: string;
        val: {
            inclination: any;
            rightAscension: any;
            eccentricity: any;
            argumentOfPerigee: any;
            meanAnomaly: any;
            meanMotion: any;
            tag?: undefined;
            val?: undefined;
        };
    } | {
        tag: string;
        val: {
            tag: string;
            val: {
                eccentricity: any;
                t?: undefined;
                what?: undefined;
                line?: undefined;
                start?: undefined;
                end?: undefined;
            };
            inclination?: undefined;
            rightAscension?: undefined;
            eccentricity?: undefined;
            argumentOfPerigee?: undefined;
            meanAnomaly?: undefined;
            meanMotion?: undefined;
        } | {
            tag: string;
            val: {
                eccentricity: any;
                t: any;
                what?: undefined;
                line?: undefined;
                start?: undefined;
                end?: undefined;
            };
            inclination?: undefined;
            rightAscension?: undefined;
            eccentricity?: undefined;
            argumentOfPerigee?: undefined;
            meanAnomaly?: undefined;
            meanMotion?: undefined;
        } | {
            tag: string;
            inclination?: undefined;
            rightAscension?: undefined;
            eccentricity?: undefined;
            argumentOfPerigee?: undefined;
            meanAnomaly?: undefined;
            meanMotion?: undefined;
            val?: undefined;
        } | {
            tag: string;
            val: {
                t: any;
                eccentricity?: undefined;
                what?: undefined;
                line?: undefined;
                start?: undefined;
                end?: undefined;
            };
            inclination?: undefined;
            rightAscension?: undefined;
            eccentricity?: undefined;
            argumentOfPerigee?: undefined;
            meanAnomaly?: undefined;
            meanMotion?: undefined;
        } | {
            tag: string;
            val: {
                what: {
                    tag: string;
                };
                line: {
                    tag: string;
                };
                start: number;
                end: number;
                eccentricity?: undefined;
                t?: undefined;
            };
            inclination?: undefined;
            rightAscension?: undefined;
            eccentricity?: undefined;
            argumentOfPerigee?: undefined;
            meanAnomaly?: undefined;
            meanMotion?: undefined;
        } | {
            tag: string;
            val: string;
            inclination?: undefined;
            rightAscension?: undefined;
            eccentricity?: undefined;
            argumentOfPerigee?: undefined;
            meanAnomaly?: undefined;
            meanMotion?: undefined;
        };
    };
    wgs72(): {
        ae: any;
        ke: any;
        j2: any;
        j3: any;
        j4: any;
    };
    wgs84(): {
        ae: any;
        ke: any;
        j2: any;
        j3: any;
        j4: any;
    };
    afspcEpochToSiderealTime(arg0: any): any;
    iauEpochToSiderealTime(arg0: any): any;
    parse2les(arg0: any): {
        tag: string;
        val: any[];
    } | {
        tag: string;
        val: {
            tag: string;
            val: {
                eccentricity: any;
                t?: undefined;
                what?: undefined;
                line?: undefined;
                start?: undefined;
                end?: undefined;
            };
        } | {
            tag: string;
            val: {
                eccentricity: any;
                t: any;
                what?: undefined;
                line?: undefined;
                start?: undefined;
                end?: undefined;
            };
        } | {
            tag: string;
            val?: undefined;
        } | {
            tag: string;
            val: {
                t: any;
                eccentricity?: undefined;
                what?: undefined;
                line?: undefined;
                start?: undefined;
                end?: undefined;
            };
        } | {
            tag: string;
            val: {
                what: {
                    tag: string;
                };
                line: {
                    tag: string;
                };
                start: number;
                end: number;
                eccentricity?: undefined;
                t?: undefined;
            };
        } | {
            tag: string;
            val: string;
        };
    };
    parse3les(arg0: any): {
        tag: string;
        val: any[];
    } | {
        tag: string;
        val: {
            tag: string;
            val: {
                eccentricity: any;
                t?: undefined;
                what?: undefined;
                line?: undefined;
                start?: undefined;
                end?: undefined;
            };
        } | {
            tag: string;
            val: {
                eccentricity: any;
                t: any;
                what?: undefined;
                line?: undefined;
                start?: undefined;
                end?: undefined;
            };
        } | {
            tag: string;
            val?: undefined;
        } | {
            tag: string;
            val: {
                t: any;
                eccentricity?: undefined;
                what?: undefined;
                line?: undefined;
                start?: undefined;
                end?: undefined;
            };
        } | {
            tag: string;
            val: {
                what: {
                    tag: string;
                };
                line: {
                    tag: string;
                };
                start: number;
                end: number;
                eccentricity?: undefined;
                t?: undefined;
            };
        } | {
            tag: string;
            val: string;
        };
    };
}
declare class Elements {
    private _wasm_val;
    private _obj;
    private _refcnt?;
    constructor(wasm_val: any, obj: any);
    clone(): this;
    drop(): void;
    static fromTle(sgp4: any, arg0: any, arg1: any, arg2: any): {
        tag: string;
        val: any;
    };
    static fromJson(sgp4: any, arg0: any): {
        tag: string;
        val: any;
    };
    epoch(): any;
    epochAfspcCompatibilityMode(): any;
    getObjectName(): string | null;
    getInternationalDesignator(): string | null;
    getNoradId(): bigint;
    getClassification(): string;
    getDatetime(): {
        secs: any;
        nsecs: number;
    };
    getMeanMotionDot(): any;
    getMeanMotionDdot(): any;
    getDragTerm(): any;
    getElementSetNumber(): bigint;
    getInclination(): any;
    getRightAscension(): any;
    getEccentricity(): any;
    getArgumentOfPerigee(): any;
    getMeanAnomaly(): any;
    getMeanMotion(): any;
    getRevolutionNumber(): bigint;
    getEphemerisType(): number;
}
declare class ResonanceState {
    private _wasm_val;
    private _obj;
    private _refcnt?;
    constructor(wasm_val: any, obj: any);
    clone(): this;
    drop(): void;
    t(): any;
}
declare class Constants {
    private _wasm_val;
    private _obj;
    private _refcnt?;
    constructor(wasm_val: any, obj: any);
    clone(): this;
    drop(): void;
    static new(sgp4: any, arg0: any, arg1: any, arg2: any, arg3: any, arg4: any): {
        tag: string;
        val: any;
    };
    static fromElements(sgp4: any, arg0: any): {
        tag: string;
        val: any;
    } | undefined;
    static fromElementsAfspcCompatibilityMode(sgp4: any, arg0: any): {
        tag: string;
        val: any;
    };
    initialState(): any;
    propagateFromState(arg1: any, arg2: any, arg3: any): {
        tag: string;
        val: {
            position: any[];
            velocity: any[];
            tag?: undefined;
            val?: undefined;
        };
    } | {
        tag: string;
        val: {
            tag: string;
            val: {
                eccentricity: any;
                t?: undefined;
                what?: undefined;
                line?: undefined;
                start?: undefined;
                end?: undefined;
            };
            position?: undefined;
            velocity?: undefined;
        } | {
            tag: string;
            val: {
                eccentricity: any;
                t: any;
                what?: undefined;
                line?: undefined;
                start?: undefined;
                end?: undefined;
            };
            position?: undefined;
            velocity?: undefined;
        } | {
            tag: string;
            position?: undefined;
            velocity?: undefined;
            val?: undefined;
        } | {
            tag: string;
            val: {
                t: any;
                eccentricity?: undefined;
                what?: undefined;
                line?: undefined;
                start?: undefined;
                end?: undefined;
            };
            position?: undefined;
            velocity?: undefined;
        } | {
            tag: string;
            val: {
                what: {
                    tag: string;
                };
                line: {
                    tag: string;
                };
                start: number;
                end: number;
                eccentricity?: undefined;
                t?: undefined;
            };
            position?: undefined;
            velocity?: undefined;
        } | {
            tag: string;
            val: string;
            position?: undefined;
            velocity?: undefined;
        };
    };
    propagate(arg1: any): {
        tag: string;
        val: {
            position: any[];
            velocity: any[];
            tag?: undefined;
            val?: undefined;
        };
    } | {
        tag: string;
        val: {
            tag: string;
            val: {
                eccentricity: any;
                t?: undefined;
                what?: undefined;
                line?: undefined;
                start?: undefined;
                end?: undefined;
            };
            position?: undefined;
            velocity?: undefined;
        } | {
            tag: string;
            val: {
                eccentricity: any;
                t: any;
                what?: undefined;
                line?: undefined;
                start?: undefined;
                end?: undefined;
            };
            position?: undefined;
            velocity?: undefined;
        } | {
            tag: string;
            position?: undefined;
            velocity?: undefined;
            val?: undefined;
        } | {
            tag: string;
            val: {
                t: any;
                eccentricity?: undefined;
                what?: undefined;
                line?: undefined;
                start?: undefined;
                end?: undefined;
            };
            position?: undefined;
            velocity?: undefined;
        } | {
            tag: string;
            val: {
                what: {
                    tag: string;
                };
                line: {
                    tag: string;
                };
                start: number;
                end: number;
                eccentricity?: undefined;
                t?: undefined;
            };
            position?: undefined;
            velocity?: undefined;
        } | {
            tag: string;
            val: string;
            position?: undefined;
            velocity?: undefined;
        };
    };
    propagateAfspcCompatibilityMode(arg1: any): {
        tag: string;
        val: {
            position: any[];
            velocity: any[];
            tag?: undefined;
            val?: undefined;
        };
    } | {
        tag: string;
        val: {
            tag: string;
            val: {
                eccentricity: any;
                t?: undefined;
                what?: undefined;
                line?: undefined;
                start?: undefined;
                end?: undefined;
            };
            position?: undefined;
            velocity?: undefined;
        } | {
            tag: string;
            val: {
                eccentricity: any;
                t: any;
                what?: undefined;
                line?: undefined;
                start?: undefined;
                end?: undefined;
            };
            position?: undefined;
            velocity?: undefined;
        } | {
            tag: string;
            position?: undefined;
            velocity?: undefined;
            val?: undefined;
        } | {
            tag: string;
            val: {
                t: any;
                eccentricity?: undefined;
                what?: undefined;
                line?: undefined;
                start?: undefined;
                end?: undefined;
            };
            position?: undefined;
            velocity?: undefined;
        } | {
            tag: string;
            val: {
                what: {
                    tag: string;
                };
                line: {
                    tag: string;
                };
                start: number;
                end: number;
                eccentricity?: undefined;
                t?: undefined;
            };
            position?: undefined;
            velocity?: undefined;
        } | {
            tag: string;
            val: string;
            position?: undefined;
            velocity?: undefined;
        };
    };
}
declare class Bindings {
    private _cache;
    private wasmurl;
    constructor(options: {
        wasmurl: string;
    });
    /** 缓慢地获取并编译WebAssembly模块 */
    _getModule(filename: string): Promise<WebAssembly.Module>;
    sgp4(options?: {
        imports?: Record<string, any>;
    }): Promise<Sgp4>;
}
export { SurocSGP4, Slab, Sgp4, Elements, ResonanceState, Constants, Bindings };
export default Object;
