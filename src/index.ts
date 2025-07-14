/*
 * @Author: Suroc
 * @Date: 2025-01-11 11:12:56
 * @LastEditTime: 2025-07-14 16:24:46
 * @Description:  NPM包入口文件
 */
import graphic from './suroc/models/graphic';
import algorithm from './suroc/models/algorithm';
import setttings from './suroc/models/setttings';
import DrawTool from './suroc/models/drawTool';
import Creatunion from './suroc/situation/creatunion_v1.1.1_VUE';
import SurocSGP4 from './suroc/situation/SurocSGP4_v1.0.2';

const CesiumUtils = {
  ...graphic,
  ...algorithm,
  ...setttings,
  DrawTool,
  Creatunion,
  SurocSGP4,
};

export default CesiumUtils;
