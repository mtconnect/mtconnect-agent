/*
 * Copyright Copyright 2017, VIMANA, Inc.
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 */

const config = require('./config');
const Dom = require('xmldom').DOMParser;
const fs = require('fs');

module.exports = (file) => {
  const xml = fs.readFileSync(file, 'utf8');
  const doc = new Dom().parseFromString(xml, 'application/xml');
  
  const desc = doc.getElementsByTagName('Description')[0];
  const data = desc.getElementsByTagName('Data');
  if (data.length > 0) {
    data[0].setAttribute('href', `shdr://${config.get('app:address')}:${config.get('app:machinePort')}`);
  } else {
    const ele = doc.createElement('Data');
    ele.setAttribute('href', `shdr://${config.get('app:address')}:${config.get('app:machinePort')}`);
    desc.appendChild(ele);
  }
	
  return doc.toString();
};
