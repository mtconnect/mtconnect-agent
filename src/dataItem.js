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

function simpleFactor(units, obj) {
  switch(units)
  {
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
      return 1.0;
  }
}


function computeConversionFactors(nativeUnits, mUnits, mHasNativeScale) {
  let units = nativeUnits;
  let mConversionFactor = 1;
  let needConversion = true;
  let mThread = false;
  let mConversionOffset = 0.0;
  const obj = {
    mConversionFactor,
    needConversion,
    mConversionOffset,
    mThread,
  }
  const threeD = units.search(/_3D/);
  const slashLoc = units.search('/');
  if (slashLoc === -1) {
    if (threeD !== -1) {
      units = units.substring(0, threeD);
      obj.mThread = true;
    }
    mConversionFactor = simpleFactor(units, obj)
    if (mConversionFactor === 1.0) {
      if (mUnits === units) {
        needConversion = false;
      } else if ((units.substring(0,4) === 'KILO') && (units.substring(4) === mUnits)) {
        mConversionFactor = 1000.0;
      } else  {
        needConversion = false;
      }
    }
  } else if (units === 'REVOLUTION/MINUTE') {
    mConversionFactor = 1.0;
    needConversion = false;
  } else {
      const numerator = units.substring(0, slashLoc);
      const denominator = units.substring(slashLoc + 1);
      const carotLoc = denominator.search('^');

      if (numerator === "REVOLUTION" && denominator === "SECOND") {
        mConversionFactor = 60.0;
      } else if (carotLoc === -1) {
        mConversionFactor = simpleFactor(numerator) / simpleFactor(denominator);
      } else {
        const unit = denominator.substring(0, carotLoc);
        const power = denominator.substring(carotLoc + 1);
        const div = Math.pow(simpleFactor(unit), Number(power));
        mConversionFactor = simpleFactor(numerator) / div;
      }
  }
 if (mHasNativeScale)
 {
   needConversion = true;
   mConversionFactor /= mNativeScale;
 }
 obj.mConversionFactor = mConversionFactor;
 obj.needConversion = needConversion;
 return obj;
}

function conversionRequired(id, dataItem) {
  const category = dataItem.$.category;
  const type = dataItem.$.type;
  const representation = dataItem.$.representation;
  let status = true;
  if (dataItem.$.nativeUnits === undefined) {
    status = false;
  } else if (representation === 'TIME_SERIES' || category === 'CONDITION' || type === 'ALARM'|| type === 'MESSAGE') {
    status = false;
  }
  return status;
}


// value will be a string
function convertValue(value, dataItem) {
  let mValue;
  const nativeUnits = dataItem.$.nativeUnits;
  const mUnits = dataItem.$.units;
  const mHasNativeScale = dataItem.$.nativeScale;
  const conv = computeConversionFactors(nativeUnits, mUnits, mHasNativeScale);
  if (conv.needConversion === false) {
    mValue = value;
    return mValue;
  } else if (conv.mHasFactor) {
    if (conv.mThreeD) {
      // do something
    } else {
      // return some string
      mValue = (Number(value) + conv.mConversionOffset) * conv.mConversionFactor;
      return String(mValue);
    }
  }
}

module.exports = {
  conversionRequired,
  convertValue,
};
