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

// externals
const fs = require('fs');
const R = require('ramda');

// constants
const files = fs.readdirSync('./schema');
const schemas = R.filter(item => item !== '.git' && item !== 'readme.md', files);
const readme = R.filter(item => item === 'readme.md', files)[0];

function *getSchema () {
  const { id } = this.params;
  const contains = R.contains(id, schemas);
  let content;
	
  if (contains) {
    content = fs.readFileSync(`./schema/${id}`);
    this.set('Content-Type', 'text/xml');
  } else {
    content = 'Not found';
  }
  
  this.body = String(content);
}

function *showSchemas () {
  let content;
	
  if (readme) {
    content = fs.readFileSync(`./schema/${readme}`);
  } else {
    content = 'Not found';
  }
	
  this.body = String(content);
}

module.exports = (router) => {
  router
	.get('/schema/:id', getSchema)
	.get('/schema', showSchemas);
};
