/*
 * @Author: Suroc
 * @Date: 2025-01-03 13:59:23
 * @LastEditTime: 2025-09-23 17:09:20
 * @Description: SGP4Entity Class Version
 */
const Object = {};
let DATA_VIEW = new DataView(new ArrayBuffer(0));
const UTF8_DECODER = new TextDecoder('utf-8');
const UTF8_ENCODER = new TextEncoder();
let UTF8_ENCODED_LEN = 0;
class SurocSGP4 {
    token;
    wasmurl;
    viewer;
    bindings;
    sgp4Module;
    pointsCollection;
    pointsCollectionPrimitives;
    pointsCollectionPrimitivesLen;
    matchingIndexMetadata;
    timeLimit;
    animatePoints;
    pixelSize;
    outlineWidth;
    _Color;
    _Model;
    ModelSize;
    ModelScale;
    MoveEntity;
    stepSeconds;
    _movePolyline;
    _polylineMap;
    referenceFrame;
    Elements;
    Constants;
    unauthorized;
    constructor(options) {
        this.token = options.token || "";
        this.wasmurl = options.wasmurl;
        this.viewer = options.viewer || window['viewer'] || null;
        this.bindings = new Bindings(options);
        this.sgp4Module = null;
        this.pointsCollection = null;
        this.pointsCollectionPrimitives = [];
        this.pointsCollectionPrimitivesLen = 0;
        this.matchingIndexMetadata = [];
        this.timeLimit = 0;
        this.animatePoints = this._animatePoints.bind(this);
        this.pixelSize = options.pixelSize || 2;
        this.outlineWidth = options.outlineWidth || 1.5;
        this._Color = options.color || Cesium.Color.WHITE;
        this._Model = options.model || false;
        this.ModelSize = options.ModelSize || 32;
        this.ModelScale = options.ModelScale || 5000;
        this.MoveEntity = null;
        this.stepSeconds = options.stepSeconds || 60;
        this._movePolyline = null;
        this._polylineMap = new Map();
        this.referenceFrame = options.referenceFrame === 'FIXED'
            ? Cesium.ReferenceFrame.FIXED
            : Cesium.ReferenceFrame.INERTIAL;
        this.Elements = Elements;
        this.Constants = Constants;
    }
    /**
     * @description 初始化
     * @param {TLEData[]} TLEs 卫星轨道数据
     */
    async init(TLEs) {
        if (!this.viewer || !TLEs.length)
            return;
        if (!this.sgp4Module) {
            this.sgp4Module = await this.bindings.sgp4();
        }
        this.destroy();
        this.pointsCollection = this.viewer.scene.primitives.add(new Cesium.PointPrimitiveCollection());
        // 在 TLEs.map() 前提取一遍颜色表避免重复访问
        const colorMap = this._Color;
        const promises = TLEs.map(async (TLE) => {
            const satName = TLE.name || 'Unknown Name';
            TLE.type = TLE.type ? TLE.type.replace(/\s+/g, '') : 'PAYLOAD';
            const noradId = TLE.noradId?.toString().trim();
            if (!noradId || !/^\d+$/.test(noradId))
                return;
            const sgp4Elements = Elements.fromTle(this.sgp4Module, satName, TLE.line1, TLE.line2);
            if (sgp4Elements.tag !== 'ok')
                return;
            const TLEEpoch = sgp4Elements.val.getDatetime();
            const TLEEpochTs = Number(TLEEpoch.secs) * 1000 + TLEEpoch.nsecs / 1e6;
            const sgp4Constants = Constants.fromElements(this.sgp4Module, sgp4Elements.val);
            if (!sgp4Constants || sgp4Constants.tag !== 'ok')
                return;
            const color = colorMap[TLE.type] || Cesium.Color.WHITE;
            this.pointsCollection.add({
                id: noradId,
                pixelSize: this.pixelSize,
                color,
                position: new Cesium.Cartesian3(),
                outlineWidth: this.outlineWidth,
                outlineColor: color.withAlpha(0.3),
            });
            this.matchingIndexMetadata.push({
                TLE,
                sgp4Constants: sgp4Constants.val,
                sgp4Elements: sgp4Elements.val,
                TLEEpochTs,
            });
        });
        await Promise.all(promises);
        this.pointsCollectionPrimitives = this.pointsCollection._pointPrimitives;
        this.pointsCollectionPrimitivesLen = this.pointsCollectionPrimitives.length;
        this.timeLimit = Cesium.JulianDate.compare(this.viewer.clock.stopTime, this.viewer.clock.startTime);
        this.viewer.scene.preRender.addEventListener(this.animatePoints);
    }
    /**
     * @description 解密数据
     * @param {string} data 加密数据
     * @returns {any} 解密后的数据
     */
    decryptedData(data) {
        var Key = CryptoJS.enc.Utf8.parse('^http://www.creatunion.comaseem&');
        let decryptedData = CryptoJS.AES.decrypt(data, Key, {
            iv: Key,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
        });
        let decryp = JSON.parse(decryptedData.toString(CryptoJS.enc.Utf8));
        return decryp;
    }
    /**
     * @description 解密数据
     * @param {string} ciphertext 加密数据
     * @param {string} key 密钥
     * @returns {string} 解密后的字符串
     */
    _decryptByDESModeEBC(ciphertext, key) {
        var keyHex = CryptoJS.enc.Utf8.parse(key);
        var decrypted = CryptoJS.DES.decrypt({
            ciphertext: CryptoJS.enc.Hex.parse(ciphertext)
        }, keyHex, {
            mode: CryptoJS.mode.ECB,
            padding: CryptoJS.pad.Pkcs7
        });
        var result_value = decrypted.toString(CryptoJS.enc.Utf8);
        return result_value;
    }
    /**
     * @description 通用函数：将 TEME 坐标转换为 J2000 (ICRF) 坐标
     * @param {any} temePosition TEME 坐标（单位：米）
     * @param {any} jd 当前时间（JulianDate）
     * @returns {any|null} 返回转换后的 J2000 坐标，转换失败返回 null
     */
    _temeToJ2000Cached(temePosition, jd) {
        const temeToFixed = Cesium.Transforms.computeTemeToPseudoFixedMatrix(jd);
        const fixedToIcrf = Cesium.Transforms.computeFixedToIcrfMatrix(jd, this.viewer.scene);
        if (!temeToFixed || !fixedToIcrf)
            return null;
        const fixedMat = Cesium.Matrix3.multiply(fixedToIcrf, temeToFixed, new Cesium.Matrix3());
        return Cesium.Matrix3.multiplyByVector(fixedMat, temePosition, new Cesium.Cartesian3());
    }
    /**
     * @description 显示或高亮目标轨道（不卡顿版）
     * @param {string|number|{id: string|number}} val 卫星目标ID
     * @param {any} activeColor 激活颜色
     * @param {string} type MOVE / CLICK
     * @param {boolean} flag 是否强制删除（点击同一目标时关闭）
     * @returns {any|null}
     */
    _targetOrbit(val, activeColor, type = 'CLICK', flag = false) {
        if (!this.viewer || !this.matchingIndexMetadata.length)
            return null;
        const ids = [];
        if (typeof val === 'string') {
            ids.push(...val.split(',').map(id => id.trim()));
        }
        else if (typeof val === 'number') {
            ids.push(val.toString());
        }
        else if (typeof val === 'object') {
            ids.push(val.id);
        }
        if (!ids.length)
            return null;
        let orbitEntity = null;
        ids.forEach(noradId => {
            const metadata = this.matchingIndexMetadata.find(meta => meta.TLE.noradId == noradId);
            if (!metadata)
                return;
            const { TLE, sgp4Constants, TLEEpochTs } = metadata;
            const colorNormal = activeColor ? activeColor : (TLE.type ? this._Color[TLE.type] : undefined) || Cesium.Color.AQUA.withAlpha(0.6);
            const leadTime = parseInt(String(24 * 3600 / parseFloat(TLE.line2.slice(52, 64))));
            const trailTime = 0;
            const start = this.viewer.clock.startTime;
            const stop = this.viewer.clock.stopTime;
            const totalSeconds = Cesium.JulianDate.secondsDifference(stop, start);
            const { positionProperty, velocityProperty } = this._getPositionProperty(sgp4Constants, TLEEpochTs, totalSeconds);
            // 轨道唯一 key
            const entityKey = `Orbit_${noradId}`;
            let entity = this._polylineMap.get(entityKey);
            // 已存在 → 切换显示或隐藏
            if (entity) {
                if (flag) {
                    entity.show = !entity.show;
                    const pointPrimitive = this.pointsCollection._pointPrimitives.find((p) => p.id == noradId);
                    if (pointPrimitive)
                        pointPrimitive.show = !entity.show;
                }
                orbitEntity = entity;
                return;
            }
            // 不存在 → 创建（只一次）
            const entityOptions = {
                id: entityKey,
                noradId,
                availability: new Cesium.TimeIntervalCollection([
                    new Cesium.TimeInterval({ start, stop }),
                ]),
                position: positionProperty,
                orientation: new Cesium.VelocityOrientationProperty(positionProperty),
                velocity: velocityProperty,
                path: new Cesium.PathGraphics({
                    width: 1,
                    leadTime,
                    trailTime,
                    material: new Cesium.ColorMaterialProperty(colorNormal),
                    resolution: 120,
                }),
                label: {
                    text: `${TLE.name}`,
                    font: "10pt monospace",
                    fillColor: Cesium.Color.YELLOW,
                    showBackground: false,
                    verticalOrigin: Cesium.VerticalOrigin.TOP,
                },
            };
            if (this._Model) {
                entityOptions.model = {
                    uri: TLE.model,
                    scale: 1,
                    minimumPixelSize: this.ModelSize,
                    maximumScale: this.ModelScale,
                };
            }
            else {
                entityOptions.point = {
                    pixelSize: (this.pixelSize || 5) * 1.1,
                    color: colorNormal,
                    outlineColor: Cesium.Color.fromAlpha(colorNormal, 0.3),
                    outlineWidth: (this.outlineWidth || 1) * 1.1,
                    scaleByDistance: new Cesium.NearFarScalar(1e7, 3, 6e7, 0.7),
                };
            }
            entity = this.viewer.entities.add(entityOptions);
            this._polylineMap.set(entityKey, entity);
            // 隐藏点
            const pointPrimitive = this.pointsCollection._pointPrimitives.find((p) => p.id == noradId);
            if (pointPrimitive)
                pointPrimitive.show = false;
            orbitEntity = entity;
        });
        return orbitEntity;
    }
    /**
     * @description 创建高精度 PositionProperty（支持 INERTIAL/FIXED，Hermite 插值）
     * @param {any} sgp4Constants SGP4 常量对象
     * @param {number} TLEEpochTs TLE epoch 毫秒时间戳
     * @param {number} totalSeconds 总采样时长（秒）
     * @returns {{positionProperty: any, velocityProperty: any}}
     */
    _getPositionProperty(sgp4Constants, TLEEpochTs, totalSeconds) {
        const positionProperty = new Cesium.SampledPositionProperty(this.referenceFrame);
        const velocityProperty = new Cesium.SampledProperty(Cesium.Cartesian3);
        positionProperty.setInterpolationOptions({
            interpolationDegree: 2,
            interpolationAlgorithm: Cesium.HermitePolynomialApproximation,
        });
        velocityProperty.setInterpolationOptions({
            interpolationDegree: 1,
            interpolationAlgorithm: Cesium.LinearApproximation,
        });
        const steps = Math.max(2, Math.ceil(totalSeconds / this.stepSeconds));
        const baseJulian = Cesium.JulianDate.clone(this.viewer.clock.currentTime);
        for (let i = 0; i < steps; i++) {
            const sampleJulian = Cesium.JulianDate.addSeconds(baseJulian, i * this.stepSeconds, new Cesium.JulianDate());
            const unixMillis = Cesium.JulianDate.toDate(sampleJulian).getTime();
            const minsFromEpoch = (unixMillis - TLEEpochTs) / 60000;
            const result = sgp4Constants.propagate(minsFromEpoch);
            if (result.tag !== 'ok')
                continue;
            const [px, py, pz] = result.val.position;
            const [vx, vy, vz] = result.val.velocity;
            const position = Cesium.Cartesian3.fromElements(px * 1000, py * 1000, pz * 1000);
            const velocity = Cesium.Cartesian3.fromElements(vx * 1000, vy * 1000, vz * 1000);
            const finalPosition = this.referenceFrame === Cesium.ReferenceFrame.INERTIAL
                ? this._temeToJ2000Cached(position, sampleJulian)
                : position;
            if (finalPosition) {
                positionProperty.addSample(sampleJulian, finalPosition, velocity);
                velocityProperty.addSample(sampleJulian, velocity);
            }
        }
        return { positionProperty, velocityProperty };
    }
    /**
     * @description 移除目标轨道
     * @param {string|number|Array<string|number>} ids 卫星目标ID（DELETE时必填）
     * @param {string} type CLICK/MOVE
     */
    _deleteOrbit(ids, type = "CLICK") {
        const deleteById = (id) => {
            const entity = this.viewer.entities.getById(String(`Orbit_${id}`));
            if (entity) {
                this.viewer.entities.remove(entity);
                this._polylineMap.delete(entity.id);
            }
        };
        const deleteAll = () => {
            this._polylineMap.forEach(entity => {
                this.viewer.entities.remove(entity);
            });
            this._polylineMap.clear();
        };
        if (type == "CLICK") {
            if (ids && (typeof ids === 'string' || typeof ids === 'number')) {
                // 如果是字符串，并且是逗号分隔的多个ID
                if (typeof ids === 'string' && ids.includes(',')) {
                    ids = ids.split(',').map(s => s.trim()).filter(Boolean);
                    ids.forEach(id => deleteById(id));
                }
                else {
                    deleteById(ids);
                }
            }
            else if (Array.isArray(ids)) {
                if (ids.length === 0) {
                    deleteAll();
                }
                else {
                    ids.forEach(id => deleteById(id));
                }
            }
            else {
                deleteAll();
            }
        }
        else {
            const entity = this.viewer.entities.getById(String(ids));
            if (entity) {
                this.viewer.entities.remove(entity);
                this._polylineMap.delete(entity.id);
                this.MoveEntity = null;
            }
        }
    }
    /**
     * @description 持续渲染
     */
    _animatePoints() {
        if (!this.viewer || !this.pointsCollection || !this.pointsCollectionPrimitivesLen)
            return;
        const currentJDate = this.viewer.clock.currentTime;
        if (Math.abs(Cesium.JulianDate.compare(currentJDate, this.viewer.clock.stopTime)) > this.timeLimit) {
            this.viewer.clock.currentTime = Cesium.JulianDate.clone(this.viewer.clock.startTime);
            return;
        }
        let matrix = Cesium.Matrix4.IDENTITY;
        if (this.referenceFrame === Cesium.ReferenceFrame.INERTIAL) {
            const rotation = Cesium.Transforms.computeIcrfToFixedMatrix(currentJDate);
            if (!rotation)
                return;
            matrix = Cesium.Matrix4.fromRotationTranslation(rotation);
        }
        this.pointsCollection.modelMatrix = matrix;
        const currentUnixTs = Cesium.JulianDate.toDate(currentJDate).getTime();
        for (let i = 0; i < this.pointsCollectionPrimitivesLen; i++) {
            const point = this.pointsCollectionPrimitives[i];
            const meta = this.matchingIndexMetadata[i];
            const minsFromEpoch = (currentUnixTs - meta.TLEEpochTs) / 60000;
            const result = meta.sgp4Constants.propagate(minsFromEpoch);
            if (result.tag !== 'ok')
                continue;
            const pos = Cesium.Cartesian3.fromElements(...result.val.position.map((v) => v * 1000));
            const finalPos = this.referenceFrame === Cesium.ReferenceFrame.INERTIAL
                ? this._temeToJ2000Cached(pos, currentJDate)
                : pos;
            if (finalPos)
                point.position = finalPos;
        }
    }
    /**
     * @description 销毁
     */
    destroy() {
        // 移除 preRender
        if (this.viewer && this.animatePoints) {
            this.viewer.scene.preRender.removeEventListener(this.animatePoints);
        }
        // 移除点位
        if (this.pointsCollection) {
            this.viewer.scene.primitives.remove(this.pointsCollection);
            this.pointsCollection = null;
        }
        // 移除所有 CLICK 轨道
        if (this._polylineMap && this._polylineMap.size > 0) {
            this._polylineMap.forEach(entity => {
                this.viewer.entities.remove(entity);
            });
            this._polylineMap.clear();
        }
        // 移除 MOVE 轨道
        if (this.MoveEntity) {
            this.viewer.entities.remove(this.MoveEntity);
            this.MoveEntity = null;
        }
        // 清空所有缓存数据
        this.pointsCollectionPrimitives = [];
        this.pointsCollectionPrimitivesLen = 0;
        this.matchingIndexMetadata = [];
        this.timeLimit = 0;
    }
}
Object.clamp_guest = (i, min, max) => {
    if (i < min || i > max)
        throw new RangeError(`must be between ${min} and ${max}`);
    return i;
};
Object.data_view = (mem, ...args) => {
    // 忽略额外的参数，只使用mem参数的buffer
    if (mem && mem.buffer && DATA_VIEW.buffer !== mem.buffer) {
        DATA_VIEW = new DataView(mem.buffer);
    }
    return DATA_VIEW;
};
Object.to_string = (val) => {
    if (typeof val === 'symbol') {
        throw new TypeError('symbols cannot be converted to strings');
    }
    else {
        return String(val);
    }
};
Object.utf8_encode = (s, realloc, memory) => {
    if (typeof s !== 'string')
        throw new TypeError('expected a string');
    if (s.length === 0) {
        UTF8_ENCODED_LEN = 0;
        return 1;
    }
    let alloc_len = 0;
    let ptr = 0;
    let writtenTotal = 0;
    while (s.length > 0) {
        ptr = realloc(ptr, alloc_len, 1, alloc_len + s.length);
        alloc_len += s.length;
        const { read, written } = UTF8_ENCODER.encodeInto(s, new Uint8Array(memory.buffer, ptr + writtenTotal, alloc_len - writtenTotal));
        writtenTotal += written;
        s = s.slice(read);
    }
    if (alloc_len > writtenTotal)
        ptr = realloc(ptr, alloc_len, 1, writtenTotal);
    UTF8_ENCODED_LEN = writtenTotal;
    return ptr;
};
Object.utf8_encoded_len = () => {
    return UTF8_ENCODED_LEN;
};
class Slab {
    list;
    head;
    constructor() {
        this.list = [];
        this.head = 0;
    }
    insert(val) {
        if (this.head >= this.list.length) {
            this.list.push({
                next: this.list.length + 1,
                val: undefined,
            });
        }
        const ret = this.head;
        const slot = this.list[ret];
        this.head = slot.next;
        slot.next = -1;
        slot.val = val;
        return ret;
    }
    get(idx) {
        if (idx >= this.list.length)
            throw new RangeError('handle index not valid');
        const slot = this.list[idx];
        if (slot.next === -1)
            return slot.val;
        throw new RangeError('handle index not valid');
    }
    remove(idx) {
        const ret = this.get(idx); // validate the slot
        const slot = this.list[idx];
        slot.val = undefined;
        slot.next = this.head;
        this.head = idx;
        return ret;
    }
}
class Sgp4 {
    instance;
    _resource0_slab;
    _resource1_slab;
    _resource2_slab;
    _registry0;
    _registry1;
    _registry2;
    _exports;
    constructor() {
        this._resource0_slab = new Slab();
        this._resource1_slab = new Slab();
        this._resource2_slab = new Slab();
    }
    addToImports(imports) {
        if (!("canonical_abi" in imports))
            imports["canonical_abi"] = {};
        imports.canonical_abi['resource_drop_elements'] = (i) => {
            this._resource0_slab.remove(i).drop();
        };
        imports.canonical_abi['resource_clone_elements'] = (i) => {
            const obj = this._resource0_slab.get(i);
            return this._resource0_slab.insert(obj.clone());
        };
        imports.canonical_abi['resource_get_elements'] = (i) => {
            return this._resource0_slab.get(i)._wasm_val;
        };
        imports.canonical_abi['resource_new_elements'] = (i) => {
            const registry = this._registry0;
            return this._resource0_slab.insert(new Elements(i, this));
        };
        imports.canonical_abi['resource_drop_resonance-state'] = (i) => {
            this._resource1_slab.remove(i).drop();
        };
        imports.canonical_abi['resource_clone_resonance-state'] = (i) => {
            const obj = this._resource1_slab.get(i);
            return this._resource1_slab.insert(obj.clone());
        };
        imports.canonical_abi['resource_get_resonance-state'] = (i) => {
            return this._resource1_slab.get(i)._wasm_val;
        };
        imports.canonical_abi['resource_new_resonance-state'] = (i) => {
            const registry = this._registry1;
            return this._resource1_slab.insert(new ResonanceState(i, this));
        };
        imports.canonical_abi['resource_drop_constants'] = (i) => {
            this._resource2_slab.remove(i).drop();
        };
        imports.canonical_abi['resource_clone_constants'] = (i) => {
            const obj = this._resource2_slab.get(i);
            return this._resource2_slab.insert(obj.clone());
        };
        imports.canonical_abi['resource_get_constants'] = (i) => {
            return this._resource2_slab.get(i)._wasm_val;
        };
        imports.canonical_abi['resource_new_constants'] = (i) => {
            const registry = this._registry2;
            return this._resource2_slab.insert(new Constants(i, this));
        };
    }
    async instantiate(module, imports) {
        imports = imports || {};
        this.addToImports(imports);
        if (module instanceof WebAssembly.Instance) {
            this.instance = module;
        }
        else if (module instanceof WebAssembly.Module) {
            this.instance = await WebAssembly.instantiate(module, imports);
        }
        else if (module instanceof ArrayBuffer || module instanceof Uint8Array) {
            // 修复类型转换错误：先转换为unknown，再转换为正确类型
            const result = await WebAssembly.instantiate(module, imports);
            const instance = result;
            this.instance = instance;
        }
        else {
            // 修复类型转换错误：先转换为unknown，再转换为正确类型
            const result = await WebAssembly.instantiateStreaming(module, imports);
            const instance = result;
            this.instance = instance;
        }
        this._exports = this.instance.exports;
        this._registry0 = new FinalizationRegistry(this._exports['canonical_abi_drop_elements']);
        this._registry1 = new FinalizationRegistry(this._exports['canonical_abi_drop_resonance-state']);
        this._registry2 = new FinalizationRegistry(this._exports['canonical_abi_drop_constants']);
    }
    orbitFromKozaiElements(arg0, arg1, arg2, arg3, arg4, arg5, arg6) {
        const memory = this._exports.memory;
        const free = this._exports["canonical_abi_free"];
        const { ae: v0_0, ke: v0_1, j2: v0_2, j3: v0_3, j4: v0_4 } = arg0;
        const ret = this._exports['orbit-from-kozai-elements'](+v0_0, +v0_1, +v0_2, +v0_3, +v0_4, +arg1, +arg2, +arg3, +arg4, +arg5, +arg6);
        let variant5;
        switch (Object.data_view(memory).getUint8(ret + 0, true)) {
            case 0: {
                variant5 = {
                    tag: "ok", val: {
                        inclination: Object.data_view(memory).getFloat64(ret + 8, true),
                        rightAscension: Object.data_view(memory).getFloat64(ret + 16, true),
                        eccentricity: Object.data_view(memory).getFloat64(ret + 24, true),
                        argumentOfPerigee: Object.data_view(memory).getFloat64(ret + 32, true),
                        meanAnomaly: Object.data_view(memory).getFloat64(ret + 40, true),
                        meanMotion: Object.data_view(memory).getFloat64(ret + 48, true),
                    }
                };
                break;
            }
            case 1: {
                let variant4;
                switch (Object.data_view(memory).getUint8(ret + 8, true)) {
                    case 0: {
                        variant4 = {
                            tag: "out-of-range-epoch-eccentricity",
                            val: {
                                eccentricity: Object.data_view(memory).getFloat64(ret + 16, true),
                            },
                        };
                        break;
                    }
                    case 1: {
                        variant4 = {
                            tag: "out-of-range-eccentricity",
                            val: {
                                eccentricity: Object.data_view(memory).getFloat64(ret + 16, true),
                                t: Object.data_view(memory).getFloat64(ret + 24, true),
                            },
                        };
                        break;
                    }
                    case 2: {
                        variant4 = {
                            tag: "out-of-range-perturbed-eccentricity",
                            val: {
                                eccentricity: Object.data_view(memory).getFloat64(ret + 16, true),
                                t: Object.data_view(memory).getFloat64(ret + 24, true),
                            },
                        };
                        break;
                    }
                    case 3: {
                        variant4 = {
                            tag: "negative-brouwer-mean-motion",
                        };
                        break;
                    }
                    case 4: {
                        variant4 = {
                            tag: "negative-kozai-mean-motion",
                        };
                        break;
                    }
                    case 5: {
                        variant4 = {
                            tag: "negative-semi-latus-rectum",
                            val: {
                                t: Object.data_view(memory).getFloat64(ret + 16, true),
                            },
                        };
                        break;
                    }
                    case 6: {
                        let variant1;
                        switch (Object.data_view(memory).getUint8(ret + 16, true)) {
                            case 0: {
                                variant1 = {
                                    tag: "bad-checksum",
                                };
                                break;
                            }
                            case 1: {
                                variant1 = {
                                    tag: "bad-length",
                                };
                                break;
                            }
                            case 2: {
                                variant1 = {
                                    tag: "bad-first-character",
                                };
                                break;
                            }
                            case 3: {
                                variant1 = {
                                    tag: "expected-float",
                                };
                                break;
                            }
                            case 4: {
                                variant1 = {
                                    tag: "expected-float-with-assumed-decimal-point",
                                };
                                break;
                            }
                            case 5: {
                                variant1 = {
                                    tag: "expected-integer",
                                };
                                break;
                            }
                            case 6: {
                                variant1 = {
                                    tag: "expected-space",
                                };
                                break;
                            }
                            case 7: {
                                variant1 = {
                                    tag: "expected-string",
                                };
                                break;
                            }
                            case 8: {
                                variant1 = {
                                    tag: "float-with-assumed-decimal-point-too-long",
                                };
                                break;
                            }
                            case 9: {
                                variant1 = {
                                    tag: "norad-id-mismatch",
                                };
                                break;
                            }
                            case 10: {
                                variant1 = {
                                    tag: "unknown-classification",
                                };
                                break;
                            }
                            case 11: {
                                variant1 = {
                                    tag: "from-yo-opt-failed",
                                };
                                break;
                            }
                            case 12: {
                                variant1 = {
                                    tag: "from-num-seconds-from-midnight-failed",
                                };
                                break;
                            }
                            default:
                                throw new RangeError("invalid variant discriminant for ErrorTleWhat");
                        }
                        let variant2;
                        switch (Object.data_view(memory).getUint8(ret + 17, true)) {
                            case 0: {
                                variant2 = {
                                    tag: "line1",
                                };
                                break;
                            }
                            case 1: {
                                variant2 = {
                                    tag: "line2",
                                };
                                break;
                            }
                            case 2: {
                                variant2 = {
                                    tag: "both",
                                };
                                break;
                            }
                            default:
                                throw new RangeError("invalid variant discriminant for ErrorTleLine");
                        }
                        variant4 = {
                            tag: "tle",
                            val: {
                                what: variant1,
                                line: variant2,
                                start: Object.data_view(memory).getInt32(ret + 20, true) >>> 0,
                                end: Object.data_view(memory).getInt32(ret + 24, true) >>> 0,
                            },
                        };
                        break;
                    }
                    case 7: {
                        const ptr3 = Object.data_view(memory).getInt32(ret + 16, true);
                        const len3 = Object.data_view(memory).getInt32(ret + 20, true);
                        const list3 = UTF8_DECODER.decode(new Uint8Array(memory.buffer, ptr3, len3));
                        free(ptr3, len3, 1);
                        variant4 = {
                            tag: "json-parse",
                            val: list3,
                        };
                        break;
                    }
                    default:
                        throw new RangeError("invalid variant discriminant for Error");
                }
                variant5 = { tag: "err", val: variant4 };
                break;
            }
            default: {
                throw new RangeError("invalid variant discriminant for expected");
            }
        }
        return variant5;
    }
    wgs72() {
        const memory = this._exports.memory;
        const ret = this._exports['wgs72']();
        return {
            ae: Object.data_view(memory).getFloat64(ret + 0, true),
            ke: Object.data_view(memory).getFloat64(ret + 8, true),
            j2: Object.data_view(memory).getFloat64(ret + 16, true),
            j3: Object.data_view(memory).getFloat64(ret + 24, true),
            j4: Object.data_view(memory).getFloat64(ret + 32, true),
        };
    }
    wgs84() {
        const memory = this._exports.memory;
        const ret = this._exports['wgs84']();
        return {
            ae: Object.data_view(memory).getFloat64(ret + 0, true),
            ke: Object.data_view(memory).getFloat64(ret + 8, true),
            j2: Object.data_view(memory).getFloat64(ret + 16, true),
            j3: Object.data_view(memory).getFloat64(ret + 24, true),
            j4: Object.data_view(memory).getFloat64(ret + 32, true),
        };
    }
    afspcEpochToSiderealTime(arg0) {
        const ret = this._exports['afspc-epoch-to-sidereal-time'](+arg0);
        return ret;
    }
    iauEpochToSiderealTime(arg0) {
        const ret = this._exports['iau-epoch-to-sidereal-time'](+arg0);
        return ret;
    }
    parse2les(arg0) {
        const memory = this._exports.memory;
        const realloc = this._exports["canonical_abi_realloc"];
        const free = this._exports["canonical_abi_free"];
        const ptr0 = Object.utf8_encode(arg0, realloc, memory);
        const len0 = Object.utf8_encoded_len();
        const ret = this._exports['parse2les'](ptr0, len0);
        let variant6;
        switch (Object.data_view(memory).getUint8(ret + 0, true)) {
            case 0: {
                const len1 = Object.data_view(memory).getInt32(ret + 12, true);
                const base1 = Object.data_view(memory).getInt32(ret + 8, true);
                const result1 = [];
                for (let i = 0; i < len1; i++) {
                    const base = base1 + i * 4;
                    result1.push(this._resource0_slab.remove(Object.data_view(memory).getInt32(base + 0, true)));
                }
                free(base1, len1 * 4, 4);
                variant6 = { tag: "ok", val: result1 };
                break;
            }
            case 1: {
                let variant5;
                switch (Object.data_view(memory).getUint8(ret + 8, true)) {
                    case 0: {
                        variant5 = {
                            tag: "out-of-range-epoch-eccentricity",
                            val: {
                                eccentricity: Object.data_view(memory).getFloat64(ret + 16, true),
                            },
                        };
                        break;
                    }
                    case 1: {
                        variant5 = {
                            tag: "out-of-range-eccentricity",
                            val: {
                                eccentricity: Object.data_view(memory).getFloat64(ret + 16, true),
                                t: Object.data_view(memory).getFloat64(ret + 24, true),
                            },
                        };
                        break;
                    }
                    case 2: {
                        variant5 = {
                            tag: "out-of-range-perturbed-eccentricity",
                            val: {
                                eccentricity: Object.data_view(memory).getFloat64(ret + 16, true),
                                t: Object.data_view(memory).getFloat64(ret + 24, true),
                            },
                        };
                        break;
                    }
                    case 3: {
                        variant5 = {
                            tag: "negative-brouwer-mean-motion",
                        };
                        break;
                    }
                    case 4: {
                        variant5 = {
                            tag: "negative-kozai-mean-motion",
                        };
                        break;
                    }
                    case 5: {
                        variant5 = {
                            tag: "negative-semi-latus-rectum",
                            val: {
                                t: Object.data_view(memory).getFloat64(ret + 16, true),
                            },
                        };
                        break;
                    }
                    case 6: {
                        let variant2;
                        switch (Object.data_view(memory).getUint8(ret + 16, true)) {
                            case 0: {
                                variant2 = {
                                    tag: "bad-checksum",
                                };
                                break;
                            }
                            case 1: {
                                variant2 = {
                                    tag: "bad-length",
                                };
                                break;
                            }
                            case 2: {
                                variant2 = {
                                    tag: "bad-first-character",
                                };
                                break;
                            }
                            case 3: {
                                variant2 = {
                                    tag: "expected-float",
                                };
                                break;
                            }
                            case 4: {
                                variant2 = {
                                    tag: "expected-float-with-assumed-decimal-point",
                                };
                                break;
                            }
                            case 5: {
                                variant2 = {
                                    tag: "expected-integer",
                                };
                                break;
                            }
                            case 6: {
                                variant2 = {
                                    tag: "expected-space",
                                };
                                break;
                            }
                            case 7: {
                                variant2 = {
                                    tag: "expected-string",
                                };
                                break;
                            }
                            case 8: {
                                variant2 = {
                                    tag: "float-with-assumed-decimal-point-too-long",
                                };
                                break;
                            }
                            case 9: {
                                variant2 = {
                                    tag: "norad-id-mismatch",
                                };
                                break;
                            }
                            case 10: {
                                variant2 = {
                                    tag: "unknown-classification",
                                };
                                break;
                            }
                            case 11: {
                                variant2 = {
                                    tag: "from-yo-opt-failed",
                                };
                                break;
                            }
                            case 12: {
                                variant2 = {
                                    tag: "from-num-seconds-from-midnight-failed",
                                };
                                break;
                            }
                            default:
                                throw new RangeError("invalid variant discriminant for ErrorTleWhat");
                        }
                        let variant3;
                        switch (Object.data_view(memory).getUint8(ret + 17, true)) {
                            case 0: {
                                variant3 = {
                                    tag: "line1",
                                };
                                break;
                            }
                            case 1: {
                                variant3 = {
                                    tag: "line2",
                                };
                                break;
                            }
                            case 2: {
                                variant3 = {
                                    tag: "both",
                                };
                                break;
                            }
                            default:
                                throw new RangeError("invalid variant discriminant for ErrorTleLine");
                        }
                        variant5 = {
                            tag: "tle",
                            val: {
                                what: variant2,
                                line: variant3,
                                start: Object.data_view(memory).getInt32(ret + 20, true) >>> 0,
                                end: Object.data_view(memory).getInt32(ret + 24, true) >>> 0,
                            },
                        };
                        break;
                    }
                    case 7: {
                        const ptr4 = Object.data_view(memory).getInt32(ret + 16, true);
                        const len4 = Object.data_view(memory).getInt32(ret + 20, true);
                        const list4 = UTF8_DECODER.decode(new Uint8Array(memory.buffer, ptr4, len4));
                        free(ptr4, len4, 1);
                        variant5 = {
                            tag: "json-parse",
                            val: list4,
                        };
                        break;
                    }
                    default:
                        throw new RangeError("invalid variant discriminant for Error");
                }
                variant6 = { tag: "err", val: variant5 };
                break;
            }
            default: {
                throw new RangeError("invalid variant discriminant for expected");
            }
        }
        return variant6;
    }
    parse3les(arg0) {
        const memory = this._exports.memory;
        const realloc = this._exports["canonical_abi_realloc"];
        const free = this._exports["canonical_abi_free"];
        const ptr0 = Object.utf8_encode(arg0, realloc, memory);
        const len0 = Object.utf8_encoded_len();
        const ret = this._exports['parse3les'](ptr0, len0);
        let variant6;
        switch (Object.data_view(memory).getUint8(ret + 0, true)) {
            case 0: {
                const len1 = Object.data_view(memory).getInt32(ret + 12, true);
                const base1 = Object.data_view(memory).getInt32(ret + 8, true);
                const result1 = [];
                for (let i = 0; i < len1; i++) {
                    const base = base1 + i * 4;
                    result1.push(this._resource0_slab.remove(Object.data_view(memory).getInt32(base + 0, true)));
                }
                free(base1, len1 * 4, 4);
                variant6 = { tag: "ok", val: result1 };
                break;
            }
            case 1: {
                let variant5;
                switch (Object.data_view(memory).getUint8(ret + 8, true)) {
                    case 0: {
                        variant5 = {
                            tag: "out-of-range-epoch-eccentricity",
                            val: {
                                eccentricity: Object.data_view(memory).getFloat64(ret + 16, true),
                            },
                        };
                        break;
                    }
                    case 1: {
                        variant5 = {
                            tag: "out-of-range-eccentricity",
                            val: {
                                eccentricity: Object.data_view(memory).getFloat64(ret + 16, true),
                                t: Object.data_view(memory).getFloat64(ret + 24, true),
                            },
                        };
                        break;
                    }
                    case 2: {
                        variant5 = {
                            tag: "out-of-range-perturbed-eccentricity",
                            val: {
                                eccentricity: Object.data_view(memory).getFloat64(ret + 16, true),
                                t: Object.data_view(memory).getFloat64(ret + 24, true),
                            },
                        };
                        break;
                    }
                    case 3: {
                        variant5 = {
                            tag: "negative-brouwer-mean-motion",
                        };
                        break;
                    }
                    case 4: {
                        variant5 = {
                            tag: "negative-kozai-mean-motion",
                        };
                        break;
                    }
                    case 5: {
                        variant5 = {
                            tag: "negative-semi-latus-rectum",
                            val: {
                                t: Object.data_view(memory).getFloat64(ret + 16, true),
                            },
                        };
                        break;
                    }
                    case 6: {
                        let variant2;
                        switch (Object.data_view(memory).getUint8(ret + 16, true)) {
                            case 0: {
                                variant2 = {
                                    tag: "bad-checksum",
                                };
                                break;
                            }
                            case 1: {
                                variant2 = {
                                    tag: "bad-length",
                                };
                                break;
                            }
                            case 2: {
                                variant2 = {
                                    tag: "bad-first-character",
                                };
                                break;
                            }
                            case 3: {
                                variant2 = {
                                    tag: "expected-float",
                                };
                                break;
                            }
                            case 4: {
                                variant2 = {
                                    tag: "expected-float-with-assumed-decimal-point",
                                };
                                break;
                            }
                            case 5: {
                                variant2 = {
                                    tag: "expected-integer",
                                };
                                break;
                            }
                            case 6: {
                                variant2 = {
                                    tag: "expected-space",
                                };
                                break;
                            }
                            case 7: {
                                variant2 = {
                                    tag: "expected-string",
                                };
                                break;
                            }
                            case 8: {
                                variant2 = {
                                    tag: "float-with-assumed-decimal-point-too-long",
                                };
                                break;
                            }
                            case 9: {
                                variant2 = {
                                    tag: "norad-id-mismatch",
                                };
                                break;
                            }
                            case 10: {
                                variant2 = {
                                    tag: "unknown-classification",
                                };
                                break;
                            }
                            case 11: {
                                variant2 = {
                                    tag: "from-yo-opt-failed",
                                };
                                break;
                            }
                            case 12: {
                                variant2 = {
                                    tag: "from-num-seconds-from-midnight-failed",
                                };
                                break;
                            }
                            default:
                                throw new RangeError("invalid variant discriminant for ErrorTleWhat");
                        }
                        let variant3;
                        switch (Object.data_view(memory).getUint8(ret + 17, true)) {
                            case 0: {
                                variant3 = {
                                    tag: "line1",
                                };
                                break;
                            }
                            case 1: {
                                variant3 = {
                                    tag: "line2",
                                };
                                break;
                            }
                            case 2: {
                                variant3 = {
                                    tag: "both",
                                };
                                break;
                            }
                            default:
                                throw new RangeError("invalid variant discriminant for ErrorTleLine");
                        }
                        variant5 = {
                            tag: "tle",
                            val: {
                                what: variant2,
                                line: variant3,
                                start: Object.data_view(memory).getInt32(ret + 20, true) >>> 0,
                                end: Object.data_view(memory).getInt32(ret + 24, true) >>> 0,
                            },
                        };
                        break;
                    }
                    case 7: {
                        const ptr4 = Object.data_view(memory).getInt32(ret + 16, true);
                        const len4 = Object.data_view(memory).getInt32(ret + 20, true);
                        const list4 = UTF8_DECODER.decode(new Uint8Array(memory.buffer, ptr4, len4));
                        free(ptr4, len4, 1);
                        variant5 = {
                            tag: "json-parse",
                            val: list4,
                        };
                        break;
                    }
                    default:
                        throw new RangeError("invalid variant discriminant for Error");
                }
                variant6 = { tag: "err", val: variant5 };
                break;
            }
            default: {
                throw new RangeError("invalid variant discriminant for expected");
            }
        }
        return variant6;
    }
}
class Elements {
    _wasm_val;
    _obj;
    _refcnt;
    constructor(wasm_val, obj) {
        this._wasm_val = wasm_val;
        this._obj = obj;
        this._refcnt = 1;
        obj._registry0.register(this, wasm_val, this);
    }
    clone() {
        this._refcnt += 1;
        return this;
    }
    drop() {
        this._refcnt -= 1;
        if (this._refcnt !== 0)
            return;
        this._obj._registry0.unregister(this);
        const dtor = this._obj._exports['canonical_abi_drop_elements'];
        const wasm_val = this._wasm_val;
        delete this._obj;
        delete this._refcnt;
        delete this._wasm_val;
        dtor(wasm_val);
    }
    static fromTle(sgp4, arg0, arg1, arg2) {
        const memory = sgp4._exports.memory;
        const realloc = sgp4._exports["canonical_abi_realloc"];
        const free = sgp4._exports["canonical_abi_free"];
        const variant1 = arg0;
        let variant1_0;
        let variant1_1;
        let variant1_2;
        switch (variant1) {
            case null: {
                variant1_0 = 0;
                variant1_1 = 0;
                variant1_2 = 0;
                break;
            }
            default: {
                const e = variant1;
                const ptr0 = Object.utf8_encode(e, realloc, memory);
                const len0 = Object.utf8_encoded_len();
                variant1_0 = 1;
                variant1_1 = ptr0;
                variant1_2 = len0;
                break;
            }
        }
        const ptr2 = Object.utf8_encode(arg1, realloc, memory);
        const len2 = Object.utf8_encoded_len();
        const ptr3 = Object.utf8_encode(arg2, realloc, memory);
        const len3 = Object.utf8_encoded_len();
        const ret = sgp4._exports['elements::from-tle'](variant1_0, variant1_1, variant1_2, ptr2, len2, ptr3, len3);
        let variant8;
        switch (Object.data_view(memory).getUint8(ret + 0, true)) {
            case 0: {
                variant8 = { tag: "ok", val: sgp4._resource0_slab.remove(Object.data_view(memory).getInt32(ret + 8, true)) };
                break;
            }
            case 1: {
                let variant7;
                switch (Object.data_view(memory).getUint8(ret + 8, true)) {
                    case 0: {
                        variant7 = {
                            tag: "out-of-range-epoch-eccentricity",
                            val: {
                                eccentricity: Object.data_view(memory).getFloat64(ret + 16, true),
                            },
                        };
                        break;
                    }
                    case 1: {
                        variant7 = {
                            tag: "out-of-range-eccentricity",
                            val: {
                                eccentricity: Object.data_view(memory).getFloat64(ret + 16, true),
                                t: Object.data_view(memory).getFloat64(ret + 24, true),
                            },
                        };
                        break;
                    }
                    case 2: {
                        variant7 = {
                            tag: "out-of-range-perturbed-eccentricity",
                            val: {
                                eccentricity: Object.data_view(memory).getFloat64(ret + 16, true),
                                t: Object.data_view(memory).getFloat64(ret + 24, true),
                            },
                        };
                        break;
                    }
                    case 3: {
                        variant7 = {
                            tag: "negative-brouwer-mean-motion",
                        };
                        break;
                    }
                    case 4: {
                        variant7 = {
                            tag: "negative-kozai-mean-motion",
                        };
                        break;
                    }
                    case 5: {
                        variant7 = {
                            tag: "negative-semi-latus-rectum",
                            val: {
                                t: Object.data_view(memory).getFloat64(ret + 16, true),
                            },
                        };
                        break;
                    }
                    case 6: {
                        let variant4;
                        switch (Object.data_view(memory).getUint8(ret + 16, true)) {
                            case 0: {
                                variant4 = {
                                    tag: "bad-checksum",
                                };
                                break;
                            }
                            case 1: {
                                variant4 = {
                                    tag: "bad-length",
                                };
                                break;
                            }
                            case 2: {
                                variant4 = {
                                    tag: "bad-first-character",
                                };
                                break;
                            }
                            case 3: {
                                variant4 = {
                                    tag: "expected-float",
                                };
                                break;
                            }
                            case 4: {
                                variant4 = {
                                    tag: "expected-float-with-assumed-decimal-point",
                                };
                                break;
                            }
                            case 5: {
                                variant4 = {
                                    tag: "expected-integer",
                                };
                                break;
                            }
                            case 6: {
                                variant4 = {
                                    tag: "expected-space",
                                };
                                break;
                            }
                            case 7: {
                                variant4 = {
                                    tag: "expected-string",
                                };
                                break;
                            }
                            case 8: {
                                variant4 = {
                                    tag: "float-with-assumed-decimal-point-too-long",
                                };
                                break;
                            }
                            case 9: {
                                variant4 = {
                                    tag: "norad-id-mismatch",
                                };
                                break;
                            }
                            case 10: {
                                variant4 = {
                                    tag: "unknown-classification",
                                };
                                break;
                            }
                            case 11: {
                                variant4 = {
                                    tag: "from-yo-opt-failed",
                                };
                                break;
                            }
                            case 12: {
                                variant4 = {
                                    tag: "from-num-seconds-from-midnight-failed",
                                };
                                break;
                            }
                            default:
                                throw new RangeError("invalid variant discriminant for ErrorTleWhat");
                        }
                        let variant5;
                        switch (Object.data_view(memory).getUint8(ret + 17, true)) {
                            case 0: {
                                variant5 = {
                                    tag: "line1",
                                };
                                break;
                            }
                            case 1: {
                                variant5 = {
                                    tag: "line2",
                                };
                                break;
                            }
                            case 2: {
                                variant5 = {
                                    tag: "both",
                                };
                                break;
                            }
                            default:
                                throw new RangeError("invalid variant discriminant for ErrorTleLine");
                        }
                        variant7 = {
                            tag: "tle",
                            val: {
                                what: variant4,
                                line: variant5,
                                start: Object.data_view(memory).getInt32(ret + 20, true) >>> 0,
                                end: Object.data_view(memory).getInt32(ret + 24, true) >>> 0,
                            },
                        };
                        break;
                    }
                    case 7: {
                        const ptr6 = Object.data_view(memory).getInt32(ret + 16, true);
                        const len6 = Object.data_view(memory).getInt32(ret + 20, true);
                        const list6 = UTF8_DECODER.decode(new Uint8Array(memory.buffer, ptr6, len6));
                        free(ptr6, len6, 1);
                        variant7 = {
                            tag: "json-parse",
                            val: list6,
                        };
                        break;
                    }
                    default:
                        throw new RangeError("invalid variant discriminant for Error");
                }
                variant8 = { tag: "err", val: variant7 };
                break;
            }
            default: {
                throw new RangeError("invalid variant discriminant for expected");
            }
        }
        return variant8;
    }
    static fromJson(sgp4, arg0) {
        const memory = sgp4._exports.memory;
        const realloc = sgp4._exports["canonical_abi_realloc"];
        const free = sgp4._exports["canonical_abi_free"];
        const ptr0 = Object.utf8_encode(arg0, realloc, memory);
        const len0 = Object.utf8_encoded_len();
        const ret = sgp4._exports['elements::from-json'](ptr0, len0);
        let variant5;
        switch (Object.data_view(memory).getUint8(ret + 0, true)) {
            case 0: {
                variant5 = { tag: "ok", val: sgp4._resource0_slab.remove(Object.data_view(memory).getInt32(ret + 8, true)) };
                break;
            }
            case 1: {
                let variant4;
                switch (Object.data_view(memory).getUint8(ret + 8, true)) {
                    case 0: {
                        variant4 = {
                            tag: "out-of-range-epoch-eccentricity",
                            val: {
                                eccentricity: Object.data_view(memory).getFloat64(ret + 16, true),
                            },
                        };
                        break;
                    }
                    case 1: {
                        variant4 = {
                            tag: "out-of-range-eccentricity",
                            val: {
                                eccentricity: Object.data_view(memory).getFloat64(ret + 16, true),
                                t: Object.data_view(memory).getFloat64(ret + 24, true),
                            },
                        };
                        break;
                    }
                    case 2: {
                        variant4 = {
                            tag: "out-of-range-perturbed-eccentricity",
                            val: {
                                eccentricity: Object.data_view(memory).getFloat64(ret + 16, true),
                                t: Object.data_view(memory).getFloat64(ret + 24, true),
                            },
                        };
                        break;
                    }
                    case 3: {
                        variant4 = {
                            tag: "negative-brouwer-mean-motion",
                        };
                        break;
                    }
                    case 4: {
                        variant4 = {
                            tag: "negative-kozai-mean-motion",
                        };
                        break;
                    }
                    case 5: {
                        variant4 = {
                            tag: "negative-semi-latus-rectum",
                            val: {
                                t: Object.data_view(memory).getFloat64(ret + 16, true),
                            },
                        };
                        break;
                    }
                    case 6: {
                        let variant1;
                        switch (Object.data_view(memory).getUint8(ret + 16, true)) {
                            case 0: {
                                variant1 = {
                                    tag: "bad-checksum",
                                };
                                break;
                            }
                            case 1: {
                                variant1 = {
                                    tag: "bad-length",
                                };
                                break;
                            }
                            case 2: {
                                variant1 = {
                                    tag: "bad-first-character",
                                };
                                break;
                            }
                            case 3: {
                                variant1 = {
                                    tag: "expected-float",
                                };
                                break;
                            }
                            case 4: {
                                variant1 = {
                                    tag: "expected-float-with-assumed-decimal-point",
                                };
                                break;
                            }
                            case 5: {
                                variant1 = {
                                    tag: "expected-integer",
                                };
                                break;
                            }
                            case 6: {
                                variant1 = {
                                    tag: "expected-space",
                                };
                                break;
                            }
                            case 7: {
                                variant1 = {
                                    tag: "expected-string",
                                };
                                break;
                            }
                            case 8: {
                                variant1 = {
                                    tag: "float-with-assumed-decimal-point-too-long",
                                };
                                break;
                            }
                            case 9: {
                                variant1 = {
                                    tag: "norad-id-mismatch",
                                };
                                break;
                            }
                            case 10: {
                                variant1 = {
                                    tag: "unknown-classification",
                                };
                                break;
                            }
                            case 11: {
                                variant1 = {
                                    tag: "from-yo-opt-failed",
                                };
                                break;
                            }
                            case 12: {
                                variant1 = {
                                    tag: "from-num-seconds-from-midnight-failed",
                                };
                                break;
                            }
                            default:
                                throw new RangeError("invalid variant discriminant for ErrorTleWhat");
                        }
                        let variant2;
                        switch (Object.data_view(memory).getUint8(ret + 17, true)) {
                            case 0: {
                                variant2 = {
                                    tag: "line1",
                                };
                                break;
                            }
                            case 1: {
                                variant2 = {
                                    tag: "line2",
                                };
                                break;
                            }
                            case 2: {
                                variant2 = {
                                    tag: "both",
                                };
                                break;
                            }
                            default:
                                throw new RangeError("invalid variant discriminant for ErrorTleLine");
                        }
                        variant4 = {
                            tag: "tle",
                            val: {
                                what: variant1,
                                line: variant2,
                                start: Object.data_view(memory).getInt32(ret + 20, true) >>> 0,
                                end: Object.data_view(memory).getInt32(ret + 24, true) >>> 0,
                            },
                        };
                        break;
                    }
                    case 7: {
                        const ptr3 = Object.data_view(memory).getInt32(ret + 16, true);
                        const len3 = Object.data_view(memory).getInt32(ret + 20, true);
                        const list3 = UTF8_DECODER.decode(new Uint8Array(memory.buffer, ptr3, len3));
                        free(ptr3, len3, 1);
                        variant4 = {
                            tag: "json-parse",
                            val: list3,
                        };
                        break;
                    }
                    default:
                        throw new RangeError("invalid variant discriminant for Error");
                }
                variant5 = { tag: "err", val: variant4 };
                break;
            }
            default: {
                throw new RangeError("invalid variant discriminant for expected");
            }
        }
        return variant5;
    }
    epoch() {
        const obj0 = this;
        const ret = this._obj._exports['elements::epoch'](this._obj._resource0_slab.insert(obj0.clone()));
        return ret;
    }
    epochAfspcCompatibilityMode() {
        const obj0 = this;
        const ret = this._obj._exports['elements::epoch-afspc-compatibility-mode'](this._obj._resource0_slab.insert(obj0.clone()));
        return ret;
    }
    getObjectName() {
        const memory = this._obj._exports.memory;
        const free = this._obj._exports["canonical_abi_free"];
        const obj0 = this;
        const ret = this._obj._exports['elements::get-object-name'](this._obj._resource0_slab.insert(obj0.clone()));
        let variant2;
        switch (Object.data_view(memory).getUint8(ret + 0, true)) {
            case 0: {
                variant2 = null;
                break;
            }
            case 1: {
                const ptr1 = Object.data_view(memory).getInt32(ret + 4, true);
                const len1 = Object.data_view(memory).getInt32(ret + 8, true);
                const list1 = UTF8_DECODER.decode(new Uint8Array(memory.buffer, ptr1, len1));
                free(ptr1, len1, 1);
                variant2 = list1;
                break;
            }
            default:
                throw new RangeError("invalid variant discriminant for option");
        }
        return variant2;
    }
    getInternationalDesignator() {
        const memory = this._obj._exports.memory;
        const free = this._obj._exports["canonical_abi_free"];
        const obj0 = this;
        const ret = this._obj._exports['elements::get-international-designator'](this._obj._resource0_slab.insert(obj0.clone()));
        let variant2;
        switch (Object.data_view(memory).getUint8(ret + 0, true)) {
            case 0: {
                variant2 = null;
                break;
            }
            case 1: {
                const ptr1 = Object.data_view(memory).getInt32(ret + 4, true);
                const len1 = Object.data_view(memory).getInt32(ret + 8, true);
                const list1 = UTF8_DECODER.decode(new Uint8Array(memory.buffer, ptr1, len1));
                free(ptr1, len1, 1);
                variant2 = list1;
                break;
            }
            default:
                throw new RangeError("invalid variant discriminant for option");
        }
        return variant2;
    }
    getNoradId() {
        const obj0 = this;
        const ret = this._obj._exports['elements::get-norad-id'](this._obj._resource0_slab.insert(obj0.clone()));
        return BigInt.asUintN(64, ret);
    }
    getClassification() {
        const obj0 = this;
        const ret = this._obj._exports['elements::get-classification'](this._obj._resource0_slab.insert(obj0.clone()));
        let enum1;
        switch (ret) {
            case 0: {
                enum1 = "unclassified";
                break;
            }
            case 1: {
                enum1 = "classified";
                break;
            }
            case 2: {
                enum1 = "secret";
                break;
            }
            default: {
                throw new RangeError("invalid discriminant specified for Classification");
            }
        }
        return enum1;
    }
    getDatetime() {
        const memory = this._obj._exports.memory;
        const obj0 = this;
        const ret = this._obj._exports['elements::get-datetime'](this._obj._resource0_slab.insert(obj0.clone()));
        return {
            secs: Object.data_view(memory).getBigInt64(ret + 0, true),
            nsecs: Object.data_view(memory).getInt32(ret + 8, true) >>> 0,
        };
    }
    getMeanMotionDot() {
        const obj0 = this;
        const ret = this._obj._exports['elements::get-mean-motion-dot'](this._obj._resource0_slab.insert(obj0.clone()));
        return ret;
    }
    getMeanMotionDdot() {
        const obj0 = this;
        const ret = this._obj._exports['elements::get-mean-motion-ddot'](this._obj._resource0_slab.insert(obj0.clone()));
        return ret;
    }
    getDragTerm() {
        const obj0 = this;
        const ret = this._obj._exports['elements::get-drag-term'](this._obj._resource0_slab.insert(obj0.clone()));
        return ret;
    }
    getElementSetNumber() {
        const obj0 = this;
        const ret = this._obj._exports['elements::get-element-set-number'](this._obj._resource0_slab.insert(obj0.clone()));
        return BigInt.asUintN(64, ret);
    }
    getInclination() {
        const obj0 = this;
        const ret = this._obj._exports['elements::get-inclination'](this._obj._resource0_slab.insert(obj0.clone()));
        return ret;
    }
    getRightAscension() {
        const obj0 = this;
        const ret = this._obj._exports['elements::get-right-ascension'](this._obj._resource0_slab.insert(obj0.clone()));
        return ret;
    }
    getEccentricity() {
        const obj0 = this;
        const ret = this._obj._exports['elements::get-eccentricity'](this._obj._resource0_slab.insert(obj0.clone()));
        return ret;
    }
    getArgumentOfPerigee() {
        const obj0 = this;
        const ret = this._obj._exports['elements::get-argument-of-perigee'](this._obj._resource0_slab.insert(obj0.clone()));
        return ret;
    }
    getMeanAnomaly() {
        const obj0 = this;
        const ret = this._obj._exports['elements::get-mean-anomaly'](this._obj._resource0_slab.insert(obj0.clone()));
        return ret;
    }
    getMeanMotion() {
        const obj0 = this;
        const ret = this._obj._exports['elements::get-mean-motion'](this._obj._resource0_slab.insert(obj0.clone()));
        return ret;
    }
    getRevolutionNumber() {
        const obj0 = this;
        const ret = this._obj._exports['elements::get-revolution-number'](this._obj._resource0_slab.insert(obj0.clone()));
        return BigInt.asUintN(64, ret);
    }
    getEphemerisType() {
        const obj0 = this;
        const ret = this._obj._exports['elements::get-ephemeris-type'](this._obj._resource0_slab.insert(obj0.clone()));
        return Object.clamp_guest(ret, 0, 255);
    }
}
class ResonanceState {
    _wasm_val;
    _obj;
    _refcnt;
    constructor(wasm_val, obj) {
        this._wasm_val = wasm_val;
        this._obj = obj;
        this._refcnt = 1;
        obj._registry1.register(this, wasm_val, this);
    }
    clone() {
        this._refcnt += 1;
        return this;
    }
    drop() {
        this._refcnt -= 1;
        if (this._refcnt !== 0)
            return;
        this._obj._registry1.unregister(this);
        const dtor = this._obj._exports['canonical_abi_drop_resonance-state'];
        const wasm_val = this._wasm_val;
        delete this._obj;
        delete this._refcnt;
        delete this._wasm_val;
        dtor(wasm_val);
    }
    t() {
        const obj0 = this;
        const ret = this._obj._exports['resonance-state::t'](this._obj._resource1_slab.insert(obj0.clone()));
        return ret;
    }
}
class Constants {
    _wasm_val;
    _obj;
    _refcnt;
    constructor(wasm_val, obj) {
        this._wasm_val = wasm_val;
        this._obj = obj;
        this._refcnt = 1;
        obj._registry2.register(this, wasm_val, this);
    }
    clone() {
        this._refcnt += 1;
        return this;
    }
    drop() {
        this._refcnt -= 1;
        if (this._refcnt !== 0)
            return;
        this._obj._registry2.unregister(this);
        const dtor = this._obj._exports['canonical_abi_drop_constants'];
        const wasm_val = this._wasm_val;
        delete this._obj;
        delete this._refcnt;
        delete this._wasm_val;
        dtor(wasm_val);
    }
    static new(sgp4, arg0, arg1, arg2, arg3, arg4) {
        const memory = sgp4._exports.memory;
        const free = sgp4._exports["canonical_abi_free"];
        const { ae: v0_0, ke: v0_1, j2: v0_2, j3: v0_3, j4: v0_4 } = arg0;
        const val1 = Object.to_string(arg1);
        let enum1;
        switch (val1) {
            case "afspc": {
                enum1 = 0;
                break;
            }
            case "iau": {
                enum1 = 1;
                break;
            }
            default: {
                throw new TypeError(`"${val1}" is not one of the cases of epoch-to-sidereal-time-algorithm`);
            }
        }
        const { inclination: v2_0, rightAscension: v2_1, eccentricity: v2_2, argumentOfPerigee: v2_3, meanAnomaly: v2_4, meanMotion: v2_5 } = arg4;
        const ret = sgp4._exports['constants::new'](+v0_0, +v0_1, +v0_2, +v0_3, +v0_4, enum1, +arg2, +arg3, +v2_0, +v2_1, +v2_2, +v2_3, +v2_4, +v2_5);
        let variant7;
        switch (Object.data_view(memory).getUint8(ret + 0, true)) {
            case 0: {
                variant7 = { tag: "ok", val: sgp4._resource2_slab.remove(Object.data_view(memory).getInt32(ret + 8, true)) };
                break;
            }
            case 1: {
                let variant6;
                switch (Object.data_view(memory).getUint8(ret + 8, true)) {
                    case 0: {
                        variant6 = {
                            tag: "out-of-range-epoch-eccentricity",
                            val: {
                                eccentricity: Object.data_view(memory).getFloat64(ret + 16, true),
                            },
                        };
                        break;
                    }
                    case 1: {
                        variant6 = {
                            tag: "out-of-range-eccentricity",
                            val: {
                                eccentricity: Object.data_view(memory).getFloat64(ret + 16, true),
                                t: Object.data_view(memory).getFloat64(ret + 24, true),
                            },
                        };
                        break;
                    }
                    case 2: {
                        variant6 = {
                            tag: "out-of-range-perturbed-eccentricity",
                            val: {
                                eccentricity: Object.data_view(memory).getFloat64(ret + 16, true),
                                t: Object.data_view(memory).getFloat64(ret + 24, true),
                            },
                        };
                        break;
                    }
                    case 3: {
                        variant6 = {
                            tag: "negative-brouwer-mean-motion",
                        };
                        break;
                    }
                    case 4: {
                        variant6 = {
                            tag: "negative-kozai-mean-motion",
                        };
                        break;
                    }
                    case 5: {
                        variant6 = {
                            tag: "negative-semi-latus-rectum",
                            val: {
                                t: Object.data_view(memory).getFloat64(ret + 16, true),
                            },
                        };
                        break;
                    }
                    case 6: {
                        let variant3;
                        switch (Object.data_view(memory).getUint8(ret + 16, true)) {
                            case 0: {
                                variant3 = {
                                    tag: "bad-checksum",
                                };
                                break;
                            }
                            case 1: {
                                variant3 = {
                                    tag: "bad-length",
                                };
                                break;
                            }
                            case 2: {
                                variant3 = {
                                    tag: "bad-first-character",
                                };
                                break;
                            }
                            case 3: {
                                variant3 = {
                                    tag: "expected-float",
                                };
                                break;
                            }
                            case 4: {
                                variant3 = {
                                    tag: "expected-float-with-assumed-decimal-point",
                                };
                                break;
                            }
                            case 5: {
                                variant3 = {
                                    tag: "expected-integer",
                                };
                                break;
                            }
                            case 6: {
                                variant3 = {
                                    tag: "expected-space",
                                };
                                break;
                            }
                            case 7: {
                                variant3 = {
                                    tag: "expected-string",
                                };
                                break;
                            }
                            case 8: {
                                variant3 = {
                                    tag: "float-with-assumed-decimal-point-too-long",
                                };
                                break;
                            }
                            case 9: {
                                variant3 = {
                                    tag: "norad-id-mismatch",
                                };
                                break;
                            }
                            case 10: {
                                variant3 = {
                                    tag: "unknown-classification",
                                };
                                break;
                            }
                            case 11: {
                                variant3 = {
                                    tag: "from-yo-opt-failed",
                                };
                                break;
                            }
                            case 12: {
                                variant3 = {
                                    tag: "from-num-seconds-from-midnight-failed",
                                };
                                break;
                            }
                            default:
                                throw new RangeError("invalid variant discriminant for ErrorTleWhat");
                        }
                        let variant4;
                        switch (Object.data_view(memory).getUint8(ret + 17, true)) {
                            case 0: {
                                variant4 = {
                                    tag: "line1",
                                };
                                break;
                            }
                            case 1: {
                                variant4 = {
                                    tag: "line2",
                                };
                                break;
                            }
                            case 2: {
                                variant4 = {
                                    tag: "both",
                                };
                                break;
                            }
                            default:
                                throw new RangeError("invalid variant discriminant for ErrorTleLine");
                        }
                        variant6 = {
                            tag: "tle",
                            val: {
                                what: variant3,
                                line: variant4,
                                start: Object.data_view(memory).getInt32(ret + 20, true) >>> 0,
                                end: Object.data_view(memory).getInt32(ret + 24, true) >>> 0,
                            },
                        };
                        break;
                    }
                    case 7: {
                        const ptr5 = Object.data_view(memory).getInt32(ret + 16, true);
                        const len5 = Object.data_view(memory).getInt32(ret + 20, true);
                        const list5 = UTF8_DECODER.decode(new Uint8Array(memory.buffer, ptr5, len5));
                        free(ptr5, len5, 1);
                        variant6 = {
                            tag: "json-parse",
                            val: list5,
                        };
                        break;
                    }
                    default:
                        throw new RangeError("invalid variant discriminant for Error");
                }
                variant7 = { tag: "err", val: variant6 };
                break;
            }
            default: {
                throw new RangeError("invalid variant discriminant for expected");
            }
        }
        return variant7;
    }
    static fromElements(sgp4, arg0) {
        const memory = sgp4._exports.memory;
        const free = sgp4._exports["canonical_abi_free"];
        const obj0 = arg0;
        if (obj0 instanceof Elements) {
            const ret = sgp4._exports['constants::from-elements'](sgp4._resource0_slab.insert(obj0.clone()));
            let variant5;
            switch (Object.data_view(memory).getUint8(ret + 0, true)) {
                case 0: {
                    variant5 = { tag: "ok", val: sgp4._resource2_slab.remove(Object.data_view(memory).getInt32(ret + 8, true)) };
                    break;
                }
                case 1: {
                    let variant4;
                    switch (Object.data_view(memory).getUint8(ret + 8, true)) {
                        case 0: {
                            variant4 = {
                                tag: "out-of-range-epoch-eccentricity",
                                val: {
                                    eccentricity: Object.data_view(memory).getFloat64(ret + 16, true),
                                },
                            };
                            break;
                        }
                        case 1: {
                            variant4 = {
                                tag: "out-of-range-eccentricity",
                                val: {
                                    eccentricity: Object.data_view(memory).getFloat64(ret + 16, true),
                                    t: Object.data_view(memory).getFloat64(ret + 24, true),
                                },
                            };
                            break;
                        }
                        case 2: {
                            variant4 = {
                                tag: "out-of-range-perturbed-eccentricity",
                                val: {
                                    eccentricity: Object.data_view(memory).getFloat64(ret + 16, true),
                                    t: Object.data_view(memory).getFloat64(ret + 24, true),
                                },
                            };
                            break;
                        }
                        case 3: {
                            variant4 = {
                                tag: "negative-brouwer-mean-motion",
                            };
                            break;
                        }
                        case 4: {
                            variant4 = {
                                tag: "negative-kozai-mean-motion",
                            };
                            break;
                        }
                        case 5: {
                            variant4 = {
                                tag: "negative-semi-latus-rectum",
                                val: {
                                    t: Object.data_view(memory).getFloat64(ret + 16, true),
                                },
                            };
                            break;
                        }
                        case 6: {
                            let variant1;
                            switch (Object.data_view(memory).getUint8(ret + 16, true)) {
                                case 0: {
                                    variant1 = {
                                        tag: "bad-checksum",
                                    };
                                    break;
                                }
                                case 1: {
                                    variant1 = {
                                        tag: "bad-length",
                                    };
                                    break;
                                }
                                case 2: {
                                    variant1 = {
                                        tag: "bad-first-character",
                                    };
                                    break;
                                }
                                case 3: {
                                    variant1 = {
                                        tag: "expected-float",
                                    };
                                    break;
                                }
                                case 4: {
                                    variant1 = {
                                        tag: "expected-float-with-assumed-decimal-point",
                                    };
                                    break;
                                }
                                case 5: {
                                    variant1 = {
                                        tag: "expected-integer",
                                    };
                                    break;
                                }
                                case 6: {
                                    variant1 = {
                                        tag: "expected-space",
                                    };
                                    break;
                                }
                                case 7: {
                                    variant1 = {
                                        tag: "expected-string",
                                    };
                                    break;
                                }
                                case 8: {
                                    variant1 = {
                                        tag: "float-with-assumed-decimal-point-too-long",
                                    };
                                    break;
                                }
                                case 9: {
                                    variant1 = {
                                        tag: "norad-id-mismatch",
                                    };
                                    break;
                                }
                                case 10: {
                                    variant1 = {
                                        tag: "unknown-classification",
                                    };
                                    break;
                                }
                                case 11: {
                                    variant1 = {
                                        tag: "from-yo-opt-failed",
                                    };
                                    break;
                                }
                                case 12: {
                                    variant1 = {
                                        tag: "from-num-seconds-from-midnight-failed",
                                    };
                                    break;
                                }
                                default:
                                    throw new RangeError("invalid variant discriminant for ErrorTleWhat");
                            }
                            let variant2;
                            switch (Object.data_view(memory).getUint8(ret + 17, true)) {
                                case 0: {
                                    variant2 = {
                                        tag: "line1",
                                    };
                                    break;
                                }
                                case 1: {
                                    variant2 = {
                                        tag: "line2",
                                    };
                                    break;
                                }
                                case 2: {
                                    variant2 = {
                                        tag: "both",
                                    };
                                    break;
                                }
                                default:
                                    throw new RangeError("invalid variant discriminant for ErrorTleLine");
                            }
                            variant4 = {
                                tag: "tle",
                                val: {
                                    what: variant1,
                                    line: variant2,
                                    start: Object.data_view(memory).getInt32(ret + 20, true) >>> 0,
                                    end: Object.data_view(memory).getInt32(ret + 24, true) >>> 0,
                                },
                            };
                            break;
                        }
                        case 7: {
                            const ptr3 = Object.data_view(memory).getInt32(ret + 16, true);
                            const len3 = Object.data_view(memory).getInt32(ret + 20, true);
                            const list3 = UTF8_DECODER.decode(new Uint8Array(memory.buffer, ptr3, len3));
                            free(ptr3, len3, 1);
                            variant4 = {
                                tag: "json-parse",
                                val: list3,
                            };
                            break;
                        }
                        default:
                            throw new RangeError("invalid variant discriminant for Error");
                    }
                    variant5 = { tag: "err", val: variant4 };
                    break;
                }
                default: {
                    throw new RangeError("invalid variant discriminant for expected");
                }
            }
            return variant5;
        }
    }
    static fromElementsAfspcCompatibilityMode(sgp4, arg0) {
        const memory = sgp4._exports.memory;
        const free = sgp4._exports["canonical_abi_free"];
        const obj0 = arg0;
        if (!(obj0 instanceof Elements))
            throw new TypeError('expected instance of Elements');
        const ret = sgp4._exports['constants::from-elements-afspc-compatibility-mode'](sgp4._resource0_slab.insert(obj0.clone()));
        let variant5;
        switch (Object.data_view(memory).getUint8(ret + 0, true)) {
            case 0: {
                variant5 = { tag: "ok", val: sgp4._resource2_slab.remove(Object.data_view(memory).getInt32(ret + 8, true)) };
                break;
            }
            case 1: {
                let variant4;
                switch (Object.data_view(memory).getUint8(ret + 8, true)) {
                    case 0: {
                        variant4 = {
                            tag: "out-of-range-epoch-eccentricity",
                            val: {
                                eccentricity: Object.data_view(memory).getFloat64(ret + 16, true),
                            },
                        };
                        break;
                    }
                    case 1: {
                        variant4 = {
                            tag: "out-of-range-eccentricity",
                            val: {
                                eccentricity: Object.data_view(memory).getFloat64(ret + 16, true),
                                t: Object.data_view(memory).getFloat64(ret + 24, true),
                            },
                        };
                        break;
                    }
                    case 2: {
                        variant4 = {
                            tag: "out-of-range-perturbed-eccentricity",
                            val: {
                                eccentricity: Object.data_view(memory).getFloat64(ret + 16, true),
                                t: Object.data_view(memory).getFloat64(ret + 24, true),
                            },
                        };
                        break;
                    }
                    case 3: {
                        variant4 = {
                            tag: "negative-brouwer-mean-motion",
                        };
                        break;
                    }
                    case 4: {
                        variant4 = {
                            tag: "negative-kozai-mean-motion",
                        };
                        break;
                    }
                    case 5: {
                        variant4 = {
                            tag: "negative-semi-latus-rectum",
                            val: {
                                t: Object.data_view(memory).getFloat64(ret + 16, true),
                            },
                        };
                        break;
                    }
                    case 6: {
                        let variant1;
                        switch (Object.data_view(memory).getUint8(ret + 16, true)) {
                            case 0: {
                                variant1 = {
                                    tag: "bad-checksum",
                                };
                                break;
                            }
                            case 1: {
                                variant1 = {
                                    tag: "bad-length",
                                };
                                break;
                            }
                            case 2: {
                                variant1 = {
                                    tag: "bad-first-character",
                                };
                                break;
                            }
                            case 3: {
                                variant1 = {
                                    tag: "expected-float",
                                };
                                break;
                            }
                            case 4: {
                                variant1 = {
                                    tag: "expected-float-with-assumed-decimal-point",
                                };
                                break;
                            }
                            case 5: {
                                variant1 = {
                                    tag: "expected-integer",
                                };
                                break;
                            }
                            case 6: {
                                variant1 = {
                                    tag: "expected-space",
                                };
                                break;
                            }
                            case 7: {
                                variant1 = {
                                    tag: "expected-string",
                                };
                                break;
                            }
                            case 8: {
                                variant1 = {
                                    tag: "float-with-assumed-decimal-point-too-long",
                                };
                                break;
                            }
                            case 9: {
                                variant1 = {
                                    tag: "norad-id-mismatch",
                                };
                                break;
                            }
                            case 10: {
                                variant1 = {
                                    tag: "unknown-classification",
                                };
                                break;
                            }
                            case 11: {
                                variant1 = {
                                    tag: "from-yo-opt-failed",
                                };
                                break;
                            }
                            case 12: {
                                variant1 = {
                                    tag: "from-num-seconds-from-midnight-failed",
                                };
                                break;
                            }
                            default:
                                throw new RangeError("invalid variant discriminant for ErrorTleWhat");
                        }
                        let variant2;
                        switch (Object.data_view(memory).getUint8(ret + 17, true)) {
                            case 0: {
                                variant2 = {
                                    tag: "line1",
                                };
                                break;
                            }
                            case 1: {
                                variant2 = {
                                    tag: "line2",
                                };
                                break;
                            }
                            case 2: {
                                variant2 = {
                                    tag: "both",
                                };
                                break;
                            }
                            default:
                                throw new RangeError("invalid variant discriminant for ErrorTleLine");
                        }
                        variant4 = {
                            tag: "tle",
                            val: {
                                what: variant1,
                                line: variant2,
                                start: Object.data_view(memory).getInt32(ret + 20, true) >>> 0,
                                end: Object.data_view(memory).getInt32(ret + 24, true) >>> 0,
                            },
                        };
                        break;
                    }
                    case 7: {
                        const ptr3 = Object.data_view(memory).getInt32(ret + 16, true);
                        const len3 = Object.data_view(memory).getInt32(ret + 20, true);
                        const list3 = UTF8_DECODER.decode(new Uint8Array(memory.buffer, ptr3, len3));
                        free(ptr3, len3, 1);
                        variant4 = {
                            tag: "json-parse",
                            val: list3,
                        };
                        break;
                    }
                    default:
                        throw new RangeError("invalid variant discriminant for Error");
                }
                variant5 = { tag: "err", val: variant4 };
                break;
            }
            default: {
                throw new RangeError("invalid variant discriminant for expected");
            }
        }
        return variant5;
    }
    initialState() {
        const memory = this._obj._exports.memory;
        const obj0 = this;
        const ret = this._obj._exports['constants::initial-state'](this._obj._resource2_slab.insert(obj0.clone()));
        let variant1;
        switch (Object.data_view(memory).getUint8(ret + 0, true)) {
            case 0: {
                variant1 = null;
                break;
            }
            case 1: {
                variant1 = this._obj._resource1_slab.remove(Object.data_view(memory).getInt32(ret + 4, true));
                break;
            }
            default:
                throw new RangeError("invalid variant discriminant for option");
        }
        return variant1;
    }
    propagateFromState(arg1, arg2, arg3) {
        const memory = this._obj._exports.memory;
        const free = this._obj._exports["canonical_abi_free"];
        const obj0 = this;
        const variant2 = arg2;
        let variant2_0;
        let variant2_1;
        switch (variant2) {
            case null: {
                variant2_0 = 0;
                variant2_1 = 0;
                break;
            }
            default: {
                const e = variant2;
                const obj1 = e;
                if (!(obj1 instanceof ResonanceState))
                    throw new TypeError('expected instance of ResonanceState');
                variant2_0 = 1;
                variant2_1 = this._obj._resource1_slab.insert(obj1.clone());
                break;
            }
        }
        const ret = this._obj._exports['constants::propagate-from-state'](this._obj._resource2_slab.insert(obj0.clone()), +arg1, variant2_0, variant2_1, arg3 ? 1 : 0);
        let variant7;
        switch (Object.data_view(memory).getUint8(ret + 0, true)) {
            case 0: {
                variant7 = {
                    tag: "ok", val: {
                        position: [Object.data_view(memory).getFloat64(ret + 8, true), Object.data_view(memory).getFloat64(ret + 16, true), Object.data_view(memory).getFloat64(ret + 24, true)],
                        velocity: [Object.data_view(memory).getFloat64(ret + 32, true), Object.data_view(memory).getFloat64(ret + 40, true), Object.data_view(memory).getFloat64(ret + 48, true)],
                    }
                };
                break;
            }
            case 1: {
                let variant6;
                switch (Object.data_view(memory).getUint8(ret + 8, true)) {
                    case 0: {
                        variant6 = {
                            tag: "out-of-range-epoch-eccentricity",
                            val: {
                                eccentricity: Object.data_view(memory).getFloat64(ret + 16, true),
                            },
                        };
                        break;
                    }
                    case 1: {
                        variant6 = {
                            tag: "out-of-range-eccentricity",
                            val: {
                                eccentricity: Object.data_view(memory).getFloat64(ret + 16, true),
                                t: Object.data_view(memory).getFloat64(ret + 24, true),
                            },
                        };
                        break;
                    }
                    case 2: {
                        variant6 = {
                            tag: "out-of-range-perturbed-eccentricity",
                            val: {
                                eccentricity: Object.data_view(memory).getFloat64(ret + 16, true),
                                t: Object.data_view(memory).getFloat64(ret + 24, true),
                            },
                        };
                        break;
                    }
                    case 3: {
                        variant6 = {
                            tag: "negative-brouwer-mean-motion",
                        };
                        break;
                    }
                    case 4: {
                        variant6 = {
                            tag: "negative-kozai-mean-motion",
                        };
                        break;
                    }
                    case 5: {
                        variant6 = {
                            tag: "negative-semi-latus-rectum",
                            val: {
                                t: Object.data_view(memory).getFloat64(ret + 16, true),
                            },
                        };
                        break;
                    }
                    case 6: {
                        let variant3;
                        switch (Object.data_view(memory).getUint8(ret + 16, true)) {
                            case 0: {
                                variant3 = {
                                    tag: "bad-checksum",
                                };
                                break;
                            }
                            case 1: {
                                variant3 = {
                                    tag: "bad-length",
                                };
                                break;
                            }
                            case 2: {
                                variant3 = {
                                    tag: "bad-first-character",
                                };
                                break;
                            }
                            case 3: {
                                variant3 = {
                                    tag: "expected-float",
                                };
                                break;
                            }
                            case 4: {
                                variant3 = {
                                    tag: "expected-float-with-assumed-decimal-point",
                                };
                                break;
                            }
                            case 5: {
                                variant3 = {
                                    tag: "expected-integer",
                                };
                                break;
                            }
                            case 6: {
                                variant3 = {
                                    tag: "expected-space",
                                };
                                break;
                            }
                            case 7: {
                                variant3 = {
                                    tag: "expected-string",
                                };
                                break;
                            }
                            case 8: {
                                variant3 = {
                                    tag: "float-with-assumed-decimal-point-too-long",
                                };
                                break;
                            }
                            case 9: {
                                variant3 = {
                                    tag: "norad-id-mismatch",
                                };
                                break;
                            }
                            case 10: {
                                variant3 = {
                                    tag: "unknown-classification",
                                };
                                break;
                            }
                            case 11: {
                                variant3 = {
                                    tag: "from-yo-opt-failed",
                                };
                                break;
                            }
                            case 12: {
                                variant3 = {
                                    tag: "from-num-seconds-from-midnight-failed",
                                };
                                break;
                            }
                            default:
                                throw new RangeError("invalid variant discriminant for ErrorTleWhat");
                        }
                        let variant4;
                        switch (Object.data_view(memory).getUint8(ret + 17, true)) {
                            case 0: {
                                variant4 = {
                                    tag: "line1",
                                };
                                break;
                            }
                            case 1: {
                                variant4 = {
                                    tag: "line2",
                                };
                                break;
                            }
                            case 2: {
                                variant4 = {
                                    tag: "both",
                                };
                                break;
                            }
                            default:
                                throw new RangeError("invalid variant discriminant for ErrorTleLine");
                        }
                        variant6 = {
                            tag: "tle",
                            val: {
                                what: variant3,
                                line: variant4,
                                start: Object.data_view(memory).getInt32(ret + 20, true) >>> 0,
                                end: Object.data_view(memory).getInt32(ret + 24, true) >>> 0,
                            },
                        };
                        break;
                    }
                    case 7: {
                        const ptr5 = Object.data_view(memory).getInt32(ret + 16, true);
                        const len5 = Object.data_view(memory).getInt32(ret + 20, true);
                        const list5 = UTF8_DECODER.decode(new Uint8Array(memory.buffer, ptr5, len5));
                        free(ptr5, len5, 1);
                        variant6 = {
                            tag: "json-parse",
                            val: list5,
                        };
                        break;
                    }
                    default:
                        throw new RangeError("invalid variant discriminant for Error");
                }
                variant7 = { tag: "err", val: variant6 };
                break;
            }
            default: {
                throw new RangeError("invalid variant discriminant for expected");
            }
        }
        return variant7;
    }
    propagate(arg1) {
        const memory = this._obj._exports.memory;
        const free = this._obj._exports["canonical_abi_free"];
        const obj0 = this;
        const ret = this._obj._exports['constants::propagate'](this._obj._resource2_slab.insert(obj0.clone()), +arg1);
        let variant5;
        switch (Object.data_view(memory).getUint8(ret + 0, true)) {
            case 0: {
                variant5 = {
                    tag: "ok", val: {
                        position: [Object.data_view(memory).getFloat64(ret + 8, true), Object.data_view(memory).getFloat64(ret + 16, true), Object.data_view(memory).getFloat64(ret + 24, true)],
                        velocity: [Object.data_view(memory).getFloat64(ret + 32, true), Object.data_view(memory).getFloat64(ret + 40, true), Object.data_view(memory).getFloat64(ret + 48, true)],
                    }
                };
                break;
            }
            case 1: {
                let variant4;
                switch (Object.data_view(memory).getUint8(ret + 8, true)) {
                    case 0: {
                        variant4 = {
                            tag: "out-of-range-epoch-eccentricity",
                            val: {
                                eccentricity: Object.data_view(memory).getFloat64(ret + 16, true),
                            },
                        };
                        break;
                    }
                    case 1: {
                        variant4 = {
                            tag: "out-of-range-eccentricity",
                            val: {
                                eccentricity: Object.data_view(memory).getFloat64(ret + 16, true),
                                t: Object.data_view(memory).getFloat64(ret + 24, true),
                            },
                        };
                        break;
                    }
                    case 2: {
                        variant4 = {
                            tag: "out-of-range-perturbed-eccentricity",
                            val: {
                                eccentricity: Object.data_view(memory).getFloat64(ret + 16, true),
                                t: Object.data_view(memory).getFloat64(ret + 24, true),
                            },
                        };
                        break;
                    }
                    case 3: {
                        variant4 = {
                            tag: "negative-brouwer-mean-motion",
                        };
                        break;
                    }
                    case 4: {
                        variant4 = {
                            tag: "negative-kozai-mean-motion",
                        };
                        break;
                    }
                    case 5: {
                        variant4 = {
                            tag: "negative-semi-latus-rectum",
                            val: {
                                t: Object.data_view(memory).getFloat64(ret + 16, true),
                            },
                        };
                        break;
                    }
                    case 6: {
                        let variant1;
                        switch (Object.data_view(memory).getUint8(ret + 16, true)) {
                            case 0: {
                                variant1 = {
                                    tag: "bad-checksum",
                                };
                                break;
                            }
                            case 1: {
                                variant1 = {
                                    tag: "bad-length",
                                };
                                break;
                            }
                            case 2: {
                                variant1 = {
                                    tag: "bad-first-character",
                                };
                                break;
                            }
                            case 3: {
                                variant1 = {
                                    tag: "expected-float",
                                };
                                break;
                            }
                            case 4: {
                                variant1 = {
                                    tag: "expected-float-with-assumed-decimal-point",
                                };
                                break;
                            }
                            case 5: {
                                variant1 = {
                                    tag: "expected-integer",
                                };
                                break;
                            }
                            case 6: {
                                variant1 = {
                                    tag: "expected-space",
                                };
                                break;
                            }
                            case 7: {
                                variant1 = {
                                    tag: "expected-string",
                                };
                                break;
                            }
                            case 8: {
                                variant1 = {
                                    tag: "float-with-assumed-decimal-point-too-long",
                                };
                                break;
                            }
                            case 9: {
                                variant1 = {
                                    tag: "norad-id-mismatch",
                                };
                                break;
                            }
                            case 10: {
                                variant1 = {
                                    tag: "unknown-classification",
                                };
                                break;
                            }
                            case 11: {
                                variant1 = {
                                    tag: "from-yo-opt-failed",
                                };
                                break;
                            }
                            case 12: {
                                variant1 = {
                                    tag: "from-num-seconds-from-midnight-failed",
                                };
                                break;
                            }
                            default:
                                throw new RangeError("invalid variant discriminant for ErrorTleWhat");
                        }
                        let variant2;
                        switch (Object.data_view(memory).getUint8(ret + 17, true)) {
                            case 0: {
                                variant2 = {
                                    tag: "line1",
                                };
                                break;
                            }
                            case 1: {
                                variant2 = {
                                    tag: "line2",
                                };
                                break;
                            }
                            case 2: {
                                variant2 = {
                                    tag: "both",
                                };
                                break;
                            }
                            default:
                                throw new RangeError("invalid variant discriminant for ErrorTleLine");
                        }
                        variant4 = {
                            tag: "tle",
                            val: {
                                what: variant1,
                                line: variant2,
                                start: Object.data_view(memory).getInt32(ret + 20, true) >>> 0,
                                end: Object.data_view(memory).getInt32(ret + 24, true) >>> 0,
                            },
                        };
                        break;
                    }
                    case 7: {
                        const ptr3 = Object.data_view(memory).getInt32(ret + 16, true);
                        const len3 = Object.data_view(memory).getInt32(ret + 20, true);
                        const list3 = UTF8_DECODER.decode(new Uint8Array(memory.buffer, ptr3, len3));
                        free(ptr3, len3, 1);
                        variant4 = {
                            tag: "json-parse",
                            val: list3,
                        };
                        break;
                    }
                    default:
                        throw new RangeError("invalid variant discriminant for Error");
                }
                variant5 = { tag: "err", val: variant4 };
                break;
            }
            default: {
                throw new RangeError("invalid variant discriminant for expected");
            }
        }
        return variant5;
    }
    propagateAfspcCompatibilityMode(arg1) {
        const memory = this._obj._exports.memory;
        const free = this._obj._exports["canonical_abi_free"];
        const obj0 = this;
        const ret = this._obj._exports['constants::propagate-afspc-compatibility-mode'](this._obj._resource2_slab.insert(obj0.clone()), +arg1);
        let variant5;
        switch (Object.data_view(memory).getUint8(ret + 0, true)) {
            case 0: {
                variant5 = {
                    tag: "ok", val: {
                        position: [Object.data_view(memory).getFloat64(ret + 8, true), Object.data_view(memory).getFloat64(ret + 16, true), Object.data_view(memory).getFloat64(ret + 24, true)],
                        velocity: [Object.data_view(memory).getFloat64(ret + 32, true), Object.data_view(memory).getFloat64(ret + 40, true), Object.data_view(memory).getFloat64(ret + 48, true)],
                    }
                };
                break;
            }
            case 1: {
                let variant4;
                switch (Object.data_view(memory).getUint8(ret + 8, true)) {
                    case 0: {
                        variant4 = {
                            tag: "out-of-range-epoch-eccentricity",
                            val: {
                                eccentricity: Object.data_view(memory).getFloat64(ret + 16, true),
                            },
                        };
                        break;
                    }
                    case 1: {
                        variant4 = {
                            tag: "out-of-range-eccentricity",
                            val: {
                                eccentricity: Object.data_view(memory).getFloat64(ret + 16, true),
                                t: Object.data_view(memory).getFloat64(ret + 24, true),
                            },
                        };
                        break;
                    }
                    case 2: {
                        variant4 = {
                            tag: "out-of-range-perturbed-eccentricity",
                            val: {
                                eccentricity: Object.data_view(memory).getFloat64(ret + 16, true),
                                t: Object.data_view(memory).getFloat64(ret + 24, true),
                            },
                        };
                        break;
                    }
                    case 3: {
                        variant4 = {
                            tag: "negative-brouwer-mean-motion",
                        };
                        break;
                    }
                    case 4: {
                        variant4 = {
                            tag: "negative-kozai-mean-motion",
                        };
                        break;
                    }
                    case 5: {
                        variant4 = {
                            tag: "negative-semi-latus-rectum",
                            val: {
                                t: Object.data_view(memory).getFloat64(ret + 16, true),
                            },
                        };
                        break;
                    }
                    case 6: {
                        let variant1;
                        switch (Object.data_view(memory).getUint8(ret + 16, true)) {
                            case 0: {
                                variant1 = {
                                    tag: "bad-checksum",
                                };
                                break;
                            }
                            case 1: {
                                variant1 = {
                                    tag: "bad-length",
                                };
                                break;
                            }
                            case 2: {
                                variant1 = {
                                    tag: "bad-first-character",
                                };
                                break;
                            }
                            case 3: {
                                variant1 = {
                                    tag: "expected-float",
                                };
                                break;
                            }
                            case 4: {
                                variant1 = {
                                    tag: "expected-float-with-assumed-decimal-point",
                                };
                                break;
                            }
                            case 5: {
                                variant1 = {
                                    tag: "expected-integer",
                                };
                                break;
                            }
                            case 6: {
                                variant1 = {
                                    tag: "expected-space",
                                };
                                break;
                            }
                            case 7: {
                                variant1 = {
                                    tag: "expected-string",
                                };
                                break;
                            }
                            case 8: {
                                variant1 = {
                                    tag: "float-with-assumed-decimal-point-too-long",
                                };
                                break;
                            }
                            case 9: {
                                variant1 = {
                                    tag: "norad-id-mismatch",
                                };
                                break;
                            }
                            case 10: {
                                variant1 = {
                                    tag: "unknown-classification",
                                };
                                break;
                            }
                            case 11: {
                                variant1 = {
                                    tag: "from-yo-opt-failed",
                                };
                                break;
                            }
                            case 12: {
                                variant1 = {
                                    tag: "from-num-seconds-from-midnight-failed",
                                };
                                break;
                            }
                            default:
                                throw new RangeError("invalid variant discriminant for ErrorTleWhat");
                        }
                        let variant2;
                        switch (Object.data_view(memory).getUint8(ret + 17, true)) {
                            case 0: {
                                variant2 = {
                                    tag: "line1",
                                };
                                break;
                            }
                            case 1: {
                                variant2 = {
                                    tag: "line2",
                                };
                                break;
                            }
                            case 2: {
                                variant2 = {
                                    tag: "both",
                                };
                                break;
                            }
                            default:
                                throw new RangeError("invalid variant discriminant for ErrorTleLine");
                        }
                        variant4 = {
                            tag: "tle",
                            val: {
                                what: variant1,
                                line: variant2,
                                start: Object.data_view(memory).getInt32(ret + 20, true) >>> 0,
                                end: Object.data_view(memory).getInt32(ret + 24, true) >>> 0,
                            },
                        };
                        break;
                    }
                    case 7: {
                        const ptr3 = Object.data_view(memory).getInt32(ret + 16, true);
                        const len3 = Object.data_view(memory).getInt32(ret + 20, true);
                        const list3 = UTF8_DECODER.decode(new Uint8Array(memory.buffer, ptr3, len3));
                        free(ptr3, len3, 1);
                        variant4 = {
                            tag: "json-parse",
                            val: list3,
                        };
                        break;
                    }
                    default:
                        throw new RangeError("invalid variant discriminant for Error");
                }
                variant5 = { tag: "err", val: variant4 };
                break;
            }
            default: {
                throw new RangeError("invalid variant discriminant for expected");
            }
        }
        return variant5;
    }
}
class Bindings {
    _cache;
    wasmurl;
    constructor(options) {
        this._cache = {};
        this.wasmurl = options.wasmurl;
    }
    /** 缓慢地获取并编译WebAssembly模块 */
    async _getModule(filename) {
        if (filename in this._cache) {
            return this._cache[filename];
        }
        const wasm = await fetch(this.wasmurl);
        const wasmBuffer = await wasm.arrayBuffer();
        const wasmBufferBytes = new Uint8Array(wasmBuffer);
        this._cache[filename] = await WebAssembly.compile(wasmBufferBytes);
        return this._cache[filename];
    }
    async sgp4(options) {
        const wrapper = new Sgp4();
        const module = await this._getModule(this.wasmurl);
        const imports = options?.imports || {};
        await wrapper.instantiate(module, imports);
        return wrapper;
    }
}
// 确保所有类都被正确导出
export { SurocSGP4, Slab, Sgp4, Elements, ResonanceState, Constants, Bindings };
// 同时保持向后兼容，导出Object对象
export default Object;
