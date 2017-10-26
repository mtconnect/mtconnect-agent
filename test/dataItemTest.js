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

// Imports - External

const expect = require('expect.js');
const sinon = require('sinon');

// Import - Internal
const dataItemjs = require('../src/dataItem');
const id1 = 'x2';
const dataItem1 = { '$':
 { category: 'SAMPLE',
   id: 'x2',
   name: 'Xact',
   nativeUnits: 'MILLIMETER',
   subType: 'ACTUAL',
   type: 'POSITION',
   units: 'MILLIMETER' },
   path: '//Devices//Device[@name="VMC-3Axis"]//Axes//Linear//DataItem[@type="POSITION" and @subType="ACTUAL"]' };
   const id2 = 'p2'
   const dataItem2 = { '$':
    { category: 'EVENT',
      id: 'p2',
      name: 'power',
      type: 'POWER_STATE' },
      path: '//Devices//Device[@name="VMC-3Axis"]//Systems//Electric//DataItem[@type="POWER_STATE"]' };

describe('conversionRequired()', () => {
  it('checks and tells whether conversion is required for the dataItem', () => {
    const res1 = dataItemjs.conversionRequired(dataItem1);
    expect(res1).to.eql(true);

    const res2 = dataItemjs.conversionRequired(dataItem2);
    expect(res2).to.eql(false);
  });
});

describe('convertValue()', () => {
  describe('gives converted value for dataItems which needs conversion', () => {
    it('conversion factor = 1 and needConversion is false ', () => {
      const value = '100';
      const res1 = dataItemjs.convertValue(value, dataItem1);
    });

    it('with nativeScale ', () => {
      const dataItem2 = { '$':
       { category: 'SAMPLE',
         id: 'x2',
         name: 'Xact',
         nativeUnits: 'MILLIMETER',
         nativeScale: '10',
         subType: 'ACTUAL',
         type: 'POSITION',
         units: 'MILLIMETER' },
         path: '' };

       const value = '13';
       const res1 = dataItemjs.convertValue(value, dataItem2);
       expect(res1).to.eql(1.3)

    });

    it('dataItem with nativeUnit beginning with KILO', () => {
      const dataItem2 = { '$':
       { category: 'SAMPLE',
         id: 'p',
         name: 'position',
         nativeUnits: 'KILOAMPERE',
         subType: 'ACTUAL',
         type: 'POSITION',
         units: 'AMPERE' },
         path: '' };
       const value = '0.13';
       const res1 = dataItemjs.convertValue(value, dataItem2);
       expect(res1).to.eql('130');
    });

    it('dataItem with nativeUnits ending with 3D', () => {
      const dataItem2 = { '$':
       { category: 'SAMPLE',
         id: 'p',
         name: 'position',
         nativeUnits: 'INCH_3D',
         subType: 'ACTUAL',
         type: 'POSITION',
         units: 'MILLIMETER_3D' },
         path: '' };
       const value1 = '1 2 3';

       const res1 = dataItemjs.convertValue(value1, dataItem2);
       expect(res1).to.eql('25.4 50.8 76.19999999999999');

       const value2 = '1  2  3';
       const res2 = dataItemjs.convertValue(value2, dataItem2);
       expect(res2).to.eql('25.4 50.8 76.19999999999999');

       const dataItem3 = { '$':
        { category: 'SAMPLE',
          id: 'p',
          name: 'position',
          nativeUnits: 'RADIAN_3D',
          subType: 'ACTUAL',
          type: 'POSITION',
          units: 'DEGREE_3D' },
          path: '' };
        const res3 = dataItemjs.convertValue(value1, dataItem3);
        expect(res3).to.eql('57.2957795 114.591559 171.8873385');
    });
  });
});

describe('convertTimeSeriesValue', () => {
  it('converts TIME_SERIES value if required', () => {
    const dataItem1 = {'$':
                        { category: 'SAMPLE',
                          id: 'p',
                          name: 'position',
                          nativeUnits: 'MILLIMETER',
                          subType: 'ACTUAL',
                          type: 'POSITION',
                          nativeScale: '10',
                          units: 'MILLIMETER',
                          representation: 'TIME_SERIES',
                          sampleRate: '42000', },
                          path: '' };
      const value = '1 2 4 5'
      const res3 = dataItemjs.convertTimeSeriesValue(value, dataItem1);
      console.log(res3)
      expect(res3).to.eql('0.1 0.2 0.4 0.5');
    });
});
