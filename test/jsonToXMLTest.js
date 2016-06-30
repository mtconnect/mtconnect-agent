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
// const fs = require('fs');
// Imports - Internal

const jsonToXML = require('../src/jsonToXML');
const ioentries = require('./support/ioentries');

// constants

const dataitemvar = [{ $:
     { type: 'AVAILABILITY',
       category: 'EVENT',
       id: 'dtop_2',
       name: 'avail' },
    _: 'AVAILABLE' }];

// updateJSON
describe('updateJSON()', () => {
  describe('creates a JSON with', () => {
    it('latest schema and dataitem values', () => {
      const resultJSON = jsonToXML.updateJSON(ioentries.schema, dataitemvar);
      return expect(resultJSON).to.eql(ioentries.objJSON);
    });
  });
});

// TODO: change the test, check how to getrid of standalone in converted xml
// // find a way to read the data without \r
// describe('convert the JSON to XML', () => {
//   describe('jsonToXML()', () => {
//     jsonToXML.jsonToXML(JSON.stringify(inputJSON),
//     './test/support/output.xml');
//     it('the XML should match', () => {
//       const xml1 = fs.readFileSync('./test/support/Devices2di.xml', 'utf8');
//       const result1 = fs.readFileSync('./test/support/output.xml', 'utf8');
//       console.log(require('util').inspect(xml1, { depth: null }));
//       console.log("\n ************************************************************** \n")
//       console.log(require('util').inspect(result1, { depth: null }));
//       //return expect(xml1).to.eql(result1);
//     });
//   });
// });
