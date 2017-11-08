/**
  * Copyright 2016, System Insights, Inc.
  *
  * Licensed under the Apache License, Version 2.0 (the "License");
  * you may not use this file except in compliance with the License.
  * You may obtain a copy of the License at
  *
  *    http://www.apache.org/licenses/LICENSE-2.0
  *
  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
  */

const R = require('ramda');

function multiValuedConversion (value, conv) {
  const valueArr = value.split(' ');
  const valArr = [];
  for (let i = 0; i < valueArr.length; i++) {
    if (valueArr[i] !== '') {
      valArr.push(valueArr[i]);
    }
  }

  return R.map(v => String((Number(v) + conv.mConversionOffset) * conv.mConversionFactor),
    valArr).join(' ');
}

function simpleFactor (units, obj) {
  switch (units) {
    case 'INCH':
      return 25.4;
    case 'FOOT':
      return 304.8;
    case 'CENTIMETER':
      return 10.0;
    case 'DECIMETER':
      return 100.0;
    case 'METER':
      return 1000.0;
    case 'FAHRENHEIT':
      obj.mConversionOffset = -32.0;
      return 5.0 / 9.0;
    case 'POUND':
      return 0.45359237;
    case 'GRAM':
      return 1 / 1000.0;
    case 'RADIAN':
      return 57.2957795;
    case 'MINUTE':
      return 60.0;
    case 'HOUR':
      return 3600.0;

    case 'SECOND':
    case 'MILLIMETER':
    case 'LITER':
    case 'DEGREE':
    case 'KILOGRAM':
    case 'NEWTON':
    case 'CELSIUS':
    case 'REVOLUTION':
    case 'STATUS':
    case 'PERCENT':
    case 'NEWTON_MILLIMETER':
    case 'HERTZ':
    case 'AMPERE':
    case 'COUNT':
    case 'JOULE':
    case 'PASCAL':
    case 'PH':
    case 'VOLT':
    case 'WATT':
    case 'OHM':
    case 'SOUND_LEVEL':
    case 'SIEMENS':
    case 'DECIBEL':

    default:
      // Already in correct units
      return 1.0
  }
}

function computeConversionFactors (nativeUnits, mUnits, mHasNativeScale) {
  let units = nativeUnits;
  let mConversionFactor = 1;
  let needConversion = true;
  let mThreeD = false;
  let mConversionOffset = 0.0;
  const obj = {
    mConversionFactor,
    needConversion,
    mConversionOffset,
    mThreeD
  };
  const threeD = units.search(/_3D/);
  const slashLoc = units.search('/');
  if (slashLoc === -1) {
    if (threeD !== -1) {
      units = units.substring(0, threeD);
      obj.mThreeD = true
    }
    mConversionFactor = simpleFactor(units, obj);
    if (mConversionFactor === 1.0) {
      if (mUnits === units) {
        needConversion = false
      } else if ((units.substring(0, 4) === 'KILO') && (units.substring(4) === mUnits)) {
        mConversionFactor = 1000.0
      } else {
        needConversion = false
      }
    }
  } else if (units === 'REVOLUTION/MINUTE') {
    mConversionFactor = 1.0;
    needConversion = false
  } else {
    const numerator = units.substring(0, slashLoc);
    const denominator = units.substring(slashLoc + 1);
    const carotLoc = denominator.search('^');

    if (numerator === 'REVOLUTION' && denominator === 'SECOND') {
      mConversionFactor = 60.0
    } else if (carotLoc === -1) {
      mConversionFactor = simpleFactor(numerator) / simpleFactor(denominator)
    } else {
      const unit = denominator.substring(0, carotLoc);
      const power = denominator.substring(carotLoc + 1);
      const div = Math.pow(simpleFactor(unit), Number(power));
      mConversionFactor = simpleFactor(numerator) / div
    }
  }
  if (mHasNativeScale) {
    const mNativeScale = mHasNativeScale;
    needConversion = true;
    mConversionFactor /= mNativeScale
  }
  obj.mConversionFactor = mConversionFactor;
  obj.needConversion = needConversion;
  obj.mHasFactor = true;
  return obj
}

function conversionRequired (dataItem) {
  const category = dataItem.$.category;
  const type = dataItem.$.type;
  const representation = dataItem.$.representation;
  const { ConversionFactor, ConversionOffset } = dataItem;
  let status = true;
  
  if (ConversionOffset && ConversionFactor) {
    return status
  }

  if (dataItem.$.nativeUnits === undefined) {
    status = false
  } else if (representation === 'TIME_SERIES' || category === 'CONDITION' || type === 'ALARM' || type === 'MESSAGE') {
    status = false
  }
  return status
}

// value will be a string
function convertValue (value, dataItem) {
  let mValue = '';
  // let factor = 1
  const { ConversionFactor, ConversionOffset } = dataItem;
  if(ConversionOffset && ConversionFactor){
    mValue = (Number(value) + Number(ConversionOffset)) * Number(ConversionFactor);
    return String(mValue)
  }
  
  const nativeUnits = dataItem.$.nativeUnits;
  const mUnits = dataItem.$.units;
  const mHasNativeScale = dataItem.$.nativeScale;
  const conv = computeConversionFactors(nativeUnits, mUnits, mHasNativeScale);

  if (conv.needConversion === false) {
    mValue = value;
    return mValue
  } else if (conv.mHasFactor) {
    if (conv.mThreeD) {
      mValue = multiValuedConversion(value, conv);
      return mValue
    } else {
      mValue = (Number(value) + conv.mConversionOffset) * conv.mConversionFactor;
      return String(mValue)
    }
  }
}

function convertTimeSeriesValue (value, dataItem) {
  let mValue = '';
  const { ConversionFactor, ConversionOffset } = dataItem;
  
  if(ConversionOffset, ConversionFactor){
    let arr = value.split(' ');
    arr = R.filter(item => item !== '', arr);
    R.map((item) => {
      value = (Number(item) + Number(ConversionOffset)) * Number(ConversionFactor);
      mValue = mValue + `${value}` + ' '
    }, arr);
    mValue = mValue.slice(0, mValue.length - 1); // rermoving last space
    return String(mValue)
  }
  
  const nativeUnits = dataItem.$.nativeUnits;
  const mUnits = dataItem.$.units;
  const mHasNativeScale = dataItem.$.nativeScale;
  const conv = computeConversionFactors(nativeUnits, mUnits, mHasNativeScale);
  if (conv.needConversion === false) {
    mValue = value;
    return value
  } else if (conv.mHasFactor) {
    mValue = multiValuedConversion(value, conv);
    return mValue
  }
}

function getComponentName(dataItem){
  const { path } = dataItem;
  const components = path.split('//');
  const length = components.length;
  let component = components[length-2];

  if(R.contains('[', component)){
    component = component.split('[')[0]
  }
  
  return component
}

/** findDataItem() looks for dataItem in device schema
  * 
  * @param {array} DataItems
  * @param {string} id
  * 
  * returns dataItem or undefined
  */ 


function findDataItemThruDataItems(DataItems, id){
  const len = DataItems.length;
  let dataItem;
  let i = 0;

  while(!dataItem && i < len){
    const { DataItem } = DataItems[i];
    const length = DataItem.length;
    let j = 0;

    while(!dataItem && j < length){
      if(DataItem[j].$.id === id){
        dataItem = DataItem[j]
      }

      if(DataItem[j].$.name && DataItem[j].$.name === id){
        dataItem = DataItem[j]
      }
      
      j++
    }
    
    i++
  }
  return dataItem
}

/** findDataItemThruComponents() goes thru components 
  * and if component has dataItems calls findDataItem()
  * 
  * @param {array} Components
  * @param {string} id
  *
  * returns dataItem or undefined
  */

function findDataItemThruComponents(Components, id){
  const len = Components.length;
  let dataItem;
  let i = 0;
  
  while(!dataItem && i < len){
    const keys = R.keys(Components[i]);
    const len = keys.length;
    let j = 0;
    
    while(!dataItem && j < len){
      const component = Components[i][keys[j]];
      const len = component.length;
      let k = 0;
      
      while(!dataItem && k < len){

        if(component[k].DataItems){
          dataItem = findDataItemThruDataItems(component[k].DataItems, id)
        }

        if(component[k].Components){
           dataItem = findDataItemThruComponents(component[k].Components, id)
        }
        
        k++
      }
      
      j++
    }
    
    i++
  }
  return dataItem
}

/** findDataItem() finds dataItem by id in device schema
  * 
  * @param {object} device - latest device schema
  * @param {string} id
  * 
  * returns dataItem or undefined
  */
function findDataItem (device, id){
  const { DataItems, Components } = device;
  let dataItem;

  if(DataItems && !dataItem){
    dataItem = findDataItemThruDataItems(DataItems, id)
  }

  if(Components && !dataItem){
    dataItem = findDataItemThruComponents(Components, id)
  }
          
  return dataItem
}

/** addConstrainedValue() adds property Constraints to dataItem
  * 
  * @param {object} dataItem
  * @param {string} value
  *
  * returns nothing
  */

function addConstrainedValue(dataItem, value){
  dataItem.Constraints = [];
  const Value = [];
  Value.push(value);
  dataItem.Constraints.push({ Value })
}

function getFilterType(dataItem){
  const { Constraints } = dataItem;
  return Constraints[0].Filter[0].$.type
}

function getFilterValue(Constraints){
  
  const filter = Constraints[0].Filter[0];
  if(filter){
    if(typeof(filter) === 'object'){
      return filter._
    }

    return filter
  }

  return undefined
}

function filterValue(filterValue, value, prevValue){
  filterValue = Number(filterValue);
  value = Number(value);
  prevValue = Number(prevValue);
  
  if(!isNaN(prevValue)){
    if(value > (prevValue - filterValue) && value < (prevValue + filterValue)){
      return String(prevValue)
    }
  }

  return String(value)
}


module.exports = {
  conversionRequired,
  convertValue,
  convertTimeSeriesValue,
  getComponentName,
  addConstrainedValue,
  findDataItem,
  getFilterType,
  filterValue,
  getFilterValue
};
