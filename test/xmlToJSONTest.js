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
const fs = require('fs');

// Imports - Internal

const xmlToJSON = require('../src/xmlToJSON');
const expectedJSON = require('./support/sampleJSONOutput');

// constants

const xml1 = fs.readFileSync('./test/support/Devices2di.xml', 'utf8');


// test - xmlToJSON()

describe('xmlToJSON()', () => {
  it('converts XML to JSON', () => {
    const check1 = xmlToJSON.xmlToJSON(xml1);
    expect(check1).to.eql(expectedJSON);
  });
});


// let assetValueXML = '<CuttingTool serialNumber="ABC" toolId="10" assetId="ABC">'+
// '<Description></Description><CuttingToolLifeCycle><ToolLife countDirection="UP" limit="0" type="MINUTES">160</ToolLife>'+
// '<Location type="POT">10</Location><Measurements><FunctionalLength code="LF" minimum="0" nominal="3.7963">3.7963</FunctionalLength>'+
// '<CuttingDiameterMax code="DC" minimum="0" nominal="0">0</CuttingDiameterMax></Measurements></CuttingToolLifeCycle></CuttingTool>';
// describe.only('xmlToJSON()', () => {
//   it('converts XML to JSON', () => {
//     const check1 = xmlToJSON.xmlToJSON(assetValueXML);
//     console.log(require('util').inspect(check1, { depth: null }));
//     // expect(check1).to.eql(expectedJSON);
//   });
// });

// let assetResponse = fs.readFileSync('E:/asset_res_E233_E262.xml');
// describe.only('xmlToJSON()', () => {
//   it('converts XML to JSON', () => {
//     const check1 = xmlToJSON.xmlToJSON(assetResponse);
//     fs.writeFileSync('E:/asset_res_E233_E262.json', JSON.stringify(check1));
//   });
// });
