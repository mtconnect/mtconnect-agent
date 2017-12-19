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

const mockery = require('mockery');
const expect = require('unexpected').clone();

describe('configuration', () => {
    let config;

    before(() => {
        mockery.enable({
            warnOnReplace: false,
            warnOnUnregistered: false,
            useCleanCache: true,
        });

        const nconf = require('nconf');
        nconf.remove('default');
        nconf.remove('test');
        nconf.remove('simulator1');
        nconf.remove('adapter_default');

        process.env.node_env = 'test';
        config = require('../src/configuration');
    });

    after(() => mockery.disable());


    describe('configuration', () => {
        it('should have configured to match the simulator1 configuration', () => {
            expect(config.get('app:name'), 'to equal', 'mtconnect-agent');
            expect(config.get('app:output:http:agentPort'), 'to equal', 5000);
            expect(config.get('app:agent:bufferSize'), 'to equal', 131072);
            expect(config.get('app:agent:assetBufferSize'), 'to equal', 1024);
            expect(config.get('app:input:shdr:legacyTimeout'), 'to equal', 60000);
        });

        it('should give logging configuration', () => {
            const logging = config.get('logging');
            expect(logging, 'to equal', {
                name: 'mtconnect-agent',
                version: '1.4',
                logLevel: 'debug',
                logDir: './log'
            });
        });
    });
});
