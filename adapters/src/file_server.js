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

const Koa = require('koa');
const router = require('koa-router')();

const description = require('./description');
const renderXml = require('./render');
const app = new Koa();


router.get('/probe', function* () {
    this.type = 'application/xml';
    this.body = renderXml(config.get('app:deviceFile'));
});

router.get('/', function* () {
    this.type = 'application/xml';
    this.body = description();
});

app.use(router.routes());

module.exports = app;
