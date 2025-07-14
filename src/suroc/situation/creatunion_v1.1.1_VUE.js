export default class Creatunion {
  'use strict'
  constructor(option) {
    this.viewer = option.viewer
    this.unauthorized = false
    this.Entitys = []
    this.keplers = option.keplers
    this.cols = option.cols
    this.staticApi = option.staticApi
    this.models = option.models
    this.pixelSize = option.pixelSize
    this.outlineWidth = option.outlineWidth
    this.token = option.token
    this.isFirstPerson = false
    this.isOrbit = true
    this.objectData = {}
    this.orbitEntity = []
    this.EGM96_mu = 3.986004415e14
    this.twoPi = 2 * Math.PI
    this.settings = option.settings
    this.useFixedFrame = option.useFixedFrame ? option.useFixedFrame : true; // 新增坐标系切换参数
    this.callback = option.callback || this.callback

    // this.worker = new Worker();
    this.init()
  }
  init() {
    var self = this
    Cesium.Transforms.preloadIcrfFixed(
      new Cesium.TimeInterval({
        start: new Cesium.JulianDate(2415020.0),
        stop: new Cesium.JulianDate(2488070.0)
      })
    ).then(function () {
      self._initPoint()
    })
    self.viewer.selectedEntityChanged.addEventListener(function () {
      if (Cesium.defined(self.viewer.selectedEntity) && self.isOrbit) {
        self._displayOrbit(self.viewer.selectedEntity)
      }
    })
  }
  _initPoint(callback) {
    var aseKey = '^http://www.creatunion.comaseem&'
    var self = this
    var message = self.token
    var decrypt = self._decryptByDESModeEBC(message, aseKey)
    var decryptList = decrypt.split('_')
    var domain = window.location.host
    if (domain == decryptList[0]) {
      var myDate = new Date()
      var endDate = new Date(decryptList[1])
      this.unauthorized = true
      if (decryptList[2] == 'permanent' || myDate.getTime() <= endDate.getTime()) {
        if (this.keplers.length > 0) {
          var i = 0
          self.keplers.forEach((k) => {
            var obj = {}
            obj.SMA = k.a
            obj.Epoch = k.time
            obj.Inc = k.i
            obj.RAAN = k.o
            obj.Ecc = k.e
            obj.ArgP = k.w
            obj.MeanAnom = k.m
            obj.id = k.norad_cat_id
            obj.objectName = k.objectName
            obj.objectType = k.objectType
            obj.icon = k.icon
            self.objectData[i] = obj
            i++
          })
          self._displayObjects()
          if (callback) callback() // 调用回调函数
        }
      } else {
        alert('授权过期')
        this.unauthorized = false
      }
    } else {
      alert('没有授权')
      this.unauthorized = false
    }
  }
  reloadPoint(points, callback) {
    var self = this
    var i = 0
    self._deleteOrbit()
    self.objectData = []
    self.viewer.entities.removeAll()
    points.forEach((k) => {
      var obj = {}
      obj.SMA = k.a
      obj.Epoch = k.time
      obj.Inc = k.i
      obj.RAAN = k.o
      obj.Ecc = k.e
      obj.ArgP = k.w
      obj.MeanAnom = k.m
      obj.id = k.norad_cat_id
      obj.objectName = k.objectName
      obj.objectType = k.objectType
      obj.icon = k.icon
      self.objectData[i] = obj
      i++
    })
    self._displayObjects()
    if (callback) callback() // 调用回调函数
  }
  decryptedData(data) {
    var Key = CryptoJS.enc.Utf8.parse('^http://www.creatunion.comaseem&')
    let decryptedData = CryptoJS.AES.decrypt(data, Key, {
      iv: Key,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    })
    let decryp = JSON.parse(decryptedData.toString(CryptoJS.enc.Utf8))
    return decryp
  }
  _decryptByDESModeEBC(ciphertext, key) {
    var keyHex = CryptoJS.enc.Utf8.parse(key)
    var decrypted = CryptoJS.DES.decrypt(
      {
        ciphertext: CryptoJS.enc.Hex.parse(ciphertext)
      },
      keyHex,
      {
        mode: CryptoJS.mode.ECB,
        padding: CryptoJS.pad.Pkcs7
      }
    )
    var result_value = decrypted.toString(CryptoJS.enc.Utf8)
    return result_value
  }
  _displayObjects() {
    var aseKey = '^http://www.creatunion.comaseem&'
    var self = this
    var message = self.token

    var decrypt = self._decryptByDESModeEBC(message, aseKey)
    var decryptList = decrypt.split('_')

    var domain = window.location.host
    if (domain == decryptList[0]) {
      var myDate = new Date()
      var endDate = new Date(decryptList[1])
      this.unauthorized = true
      if (decryptList[2] == 'permanent' || myDate.getTime() <= endDate.getTime()) {
        var epjd = new Cesium.JulianDate()
        var CRFtoTRF = Cesium.Transforms.computeIcrfToFixedMatrix(self.viewer.clock.startTime)
        if (!CRFtoTRF) return
        var trk, t, col, i, s
        col = Cesium.Color.DEEPPINK
        self.viewer.entities.suspendEvents()
        self._deleteOrbit()
        for (s in self.objectData) {
          trk = self.objectData[s]

          col = this._setObjectColor(trk)

          Cesium.JulianDate.fromIso8601(trk['Epoch'], epjd)
          t = Cesium.JulianDate.daysDifference(self.viewer.clock.startTime, epjd)
          trk['mmo'] = Math.sqrt(self.EGM96_mu / (trk['SMA'] * trk['SMA'] * trk['SMA']))
          trk['MeanAnom'] = (trk['MeanAnom'] + trk['mmo'] * t * 86400) % self.twoPi
          var star = {
            id: trk['id'] ? trk['id'] : s,
            index: s,
            type: 'Star',
            name: trk['objectName'],
            availability: new Cesium.TimeIntervalCollection([
              new Cesium.TimeInterval({
                start: self.viewer.clock.startTime,
                stop: self.viewer.clock.stopTime
              })
            ]),
            point: {
              show: this.settings.point,
              pixelSize: self.pixelSize,
              color: col,
              outlineColor: Cesium.Color.fromAlpha(col, 0.3),
              outlineWidth: self.outlineWidth,
              scaleByDistance: new Cesium.NearFarScalar(1e7, 3, 6e7, 0.7)
            },
            position: new Cesium.CallbackProperty(
              self._updatePosition(CRFtoTRF, s, trk['objectName']),
              false
            ),
          }
          this._setIconAndModel(star, trk)
          self.viewer.entities.add(star)
          if (this.settings.orbit) {
            var ent = self.viewer.entities.getById(trk['id'] ? trk['id'] : s)
            if (!ent) return
            this._displayOrbit(ent)
          }
        }
        self.Entitys = self.viewer.entities._entities._array
        self.viewer.entities.resumeEvents()
      } else {
        alert('授权过期')
        this.unauthorized = false
      }
    } else {
      alert('没有授权')
      this.unauthorized = false
    }
  }
  _setObjectColor(trk) {
    let col = Cesium.Color.DEEPPINK
    if (trk['objectType'] == 'PAYLOAD') {
      col = this.cols.PAYLOAD
    } else if (trk['objectType'] == 'ROCKET BODY') {
      col = this.cols.ROCKETBODY
    } else if (trk['objectType'] == 'DEBRIS') {
      col = this.cols.DEBRIS
    } else if (trk['objectType'] == 'TBA') {
      col = this.cols.TBA
    } else if (trk['objectType'] == 'UNKNOWN') {
      col = this.cols.UNKNOWN
    } else if (trk['objectType'] == 'Creatunion') {
      col = this.cols.Creatunion
    } else if (trk['objectType'] == 'Track') {
      col = this.cols.Track
    }
    return col
  }
  _setIconAndModel(star, trk) {
    if (this.settings.icon) {
      star.billboard = {
        show: this.settings.icon,
        image: this.settings.defaultIcon ? this.settings.defaultIcon : [trk['icon']] ? [trk['icon']] : this.staticApi ? `${this.staticApi}${[trk['icon']]}` : '',
        width: 32,
        height: 32,
        scale: 1.0,
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER
      }
    }
    if (this.settings.model) {
      star.model = {
        show: true,
        uri: `${this.staticApi}${this.models[trk['objectType']]}`, // 模型文件的路径
        scale: 100, // 模型的缩放比例
        minimumPixelSize: 60, // 模型在远处的最小像素大小
        maximumScale: 1500, // 模型的最大缩放比例
      }
    }
  }
  _updatePosition(CRFtoTRF, trkid, trkname) {
    var self = this
    return function UpdateHelper() {
      var ele = self.objectData[trkid]
      var t = Cesium.JulianDate.secondsDifference(
        self.viewer.clock.currentTime,
        self.viewer.clock.startTime
      )
      var u = jQuery.extend({}, ele)
      u.MeanAnom = (u.MeanAnom + u.mmo * t) % self.twoPi
      var eff = new Cesium.Cartesian3()
      var eci = self._stateVector(u, true, 1e-3)
      Cesium.Matrix3.multiplyByVector(CRFtoTRF, eci, eff)
      var targetEntity = self.Entitys[trkid]
      if (eff && self.isFirstPerson) {
        let cameraOccluder = new Cesium.EllipsoidalOccluder(
          Cesium.Ellipsoid.WGS84,
          viewer.camera.position
        )
        let viewerVisible = cameraOccluder.isPointVisible(eff)
        if (targetEntity && viewerVisible) {
          if (self.staticApi && !targetEntity.label) {
            Promise.resolve().then(() => {
              targetEntity.label = {
                text: trkname,
                font: '8pt monospace',
                fillColor: Cesium.Color.YELLOW,
                backgroundColor: Cesium.Color.TRANSPARENT,
                showBackground: true,
                verticalOrigin: Cesium.VerticalOrigin.TOP
              }
            })
          }
        } else {
          if (targetEntity && targetEntity.label) {
            if (!self.orbitEntity.includes(self.Entitys[trkid].id)) {
              Promise.resolve().then(() => {
                targetEntity.label = undefined
              })
            }
          }
        }
      } else {
        if (targetEntity && targetEntity.label) {
          if (!self.orbitEntity.includes(self.Entitys[trkid].id)) {
            Promise.resolve().then(() => {
              targetEntity.label = undefined
            })
          }
        }
      }
      return eff
    }
  }
  _stateVector(ele, posonly = false, tol = 1e-6, maxIter = 20) {
    var self = this
    var ecan = self._eccentricAnomaly(ele.MeanAnom, ele.Ecc, tol, maxIter)
    var tran =
      2 *
      Math.atan2(Math.sqrt((1 + ele.Ecc) / (1 - ele.Ecc)) * Math.sin(ecan / 2), Math.cos(ecan / 2))
    var p = ele.SMA * (1 - ele.Ecc * ele.Ecc)
    var r = p / (1 + ele.Ecc * Math.cos(tran))
    var h = Math.sqrt(self.EGM96_mu * p),
      ci = Math.cos(ele.Inc),
      si = Math.sin(ele.Inc),
      cr = Math.cos(ele.RAAN),
      sr = Math.sin(ele.RAAN),
      cw = Math.cos(ele.ArgP + tran),
      sw = Math.sin(ele.ArgP + tran)

    var pos = new Cesium.Cartesian3(cr * cw - sr * sw * ci, sr * cw + cr * sw * ci, si * sw),
      pos2 = new Cesium.Cartesian3()
    Cesium.Cartesian3.multiplyByScalar(pos, r, pos2)
    if (posonly) return pos2

    var vel = new Cesium.Cartesian3(),
      vel1 = new Cesium.Cartesian3(),
      vel2 = new Cesium.Cartesian3()
    Cesium.Cartesian3.subtract(
      Cesium.Cartesian3.multiplyByScalar(pos2, (h * ele.Ecc * Math.sin(tran)) / (r * p), vel1),
      Cesium.Cartesian3.multiplyByScalar(
        new Cesium.Cartesian3(cr * sw + sr * cw * ci, sr * sw - cr * cw * ci, -si * cw),
        h / r,
        vel2
      ),
      vel
    )
    return { pos: pos2, vel: vel }
  }
  _eccentricAnomaly(mean, ecc, tol, maxIter) {
    var self = this
    var i,
      curr,
      prev = mean
    for (i = 1; i <= maxIter; i++) {
      curr = prev - (prev - ecc * Math.sin(prev) - mean) / (1 - ecc * Math.cos(prev))
      if (Math.abs(curr - prev) <= tol) return curr % self.twoPi
      prev = curr
    }
    return NaN
  }
  _onTrackClick() {
    if (Cesium.defined(obj.viewer.selectedEntity)) {
      obj._displayOrbit(obj.viewer.selectedEntity)
    }
  }
  _displayOrbit(obj) {
    var self = this
    // var ent = self.viewer.entities.getById(obj.id)
    if (!obj) return
    var car = new Cesium.Cartographic(),
      Y = new Cesium.Cartesian3()
    var CRFtoTRF = Cesium.Transforms.computeIcrfToFixedMatrix(self.viewer.clock.startTime)
    var same = self.objectData[obj.index]
    var sta,
      arr = []
    var u = jQuery.extend({}, same)
    for (u.MeanAnom = 0; u.MeanAnom <= 6.29; u.MeanAnom += 0.01) {
      if (u.MeanAnom == 0) {
        sta = self._stateVector(u, false, 1e-6, 100)
        Cesium.Matrix3.multiplyByVector(CRFtoTRF, sta.pos, Y)
      } else {
        sta = self._stateVector(u, true, 1e-6, 100)
        Cesium.Matrix3.multiplyByVector(CRFtoTRF, sta, Y)
      }

      self.viewer.scene.mapProjection.ellipsoid.cartesianToCartographic(Y, car)
      if (Number.isNaN(car.longitude) || Number.isNaN(car.latitude) || Number.isNaN(car.height))
        continue
      arr.push(car.longitude, car.latitude, car.height)
    }
    obj.polyline = {
      positions: Cesium.Cartesian3.fromRadiansArrayHeights(arr),
      width: 1,
      material: this.settings.orbitMaterial || obj.point.color.getValue() ? obj.point.color.getValue() : Cesium.Color.LIMEGREEN
    }
    if (this.settings.label) {
      obj.label = {
        text: `${same.objectName}`,
        font: '12pt monospace',
        fillColor: Cesium.Color.YELLOW,
        backgroundColor: Cesium.Color.TRANSPARENT,
        showBackground: true,
        verticalOrigin: Cesium.VerticalOrigin.TOP,
        position: obj.position
      }
    }
    self.orbitEntity.push(obj.id)
  }
  _deleteOrbit(val) {
    if (this.orbitEntity && this.orbitEntity.length) {
      if (val) {
        for (let i = 0; i < this.orbitEntity.length; i++) {
          if (val == this.orbitEntity[i]) {
            let Entity = this.viewer.entities.getById(this.orbitEntity[i])
            if (Entity && Entity.polyline) Entity.polyline = undefined
            if (Entity && Entity.label) Entity.label = undefined
            this.orbitEntity.splice(i, 1)
            break
          }
        }
      } else {
        for (let i = 0; i < this.orbitEntity.length; i++) {
          let Entity = this.viewer.entities.getById(this.orbitEntity[i])
          if (Entity && Entity.polyline) Entity.polyline = undefined
          if (Entity && Entity.label) Entity.label = undefined
        }
        this.orbitEntity = []
      }
    }
  }
  _deepClone(obj) {
    var _obj = JSON.stringify(obj),
      objClone = JSON.parse(_obj)
    return objClone
  }
}
