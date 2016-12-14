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
const dataItem1 ={ '$':
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
  const res1 = dataItemjs.conversionRequired(id1, dataItem1);
  expect(res1).to.eql(true);

  const res2 = dataItemjs.conversionRequired(id2, dataItem2);
  expect(res2).to.eql(false);
});

describe.only('convertValue()', () => {
  it('gives converted value for dataItems which needs conversion', () => {
    const value = '100';
    const res1 = dataItemjs.convertValue(value, dataItem1);
    console.log(res1);
  });
});
