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
const log = config.logger;

const net = require('net');
const LineByLine = require('line-by-line');

function device(file) {
    let stopReading = false;

    return net.createServer((socket) => {
        socket.setNoDelay(true);
        socket.name = `${socket.remoteaddress}:${socket.remotePort}`;

        // Create a line reader.
        const reader = new LineByLine(file);
        reader.on('error', err => {
            log.error(err);
        });

        // TODO: Should restart reader at the beginning.
        reader.on('end', () => {
            socket.destroy();
            log.info('End of file');
        });

        // Send each line with the current timestamp.
        // TODO: need to honor timestamps delta to simulate real interval.
        reader.on('line', line => {
            reader.pause();

            if (!stopReading) {
                const fields = line.split('|');
                const ts = fields.shift();
                fields.unshift((new Date()).toISOString());

                socket.write(`${fields.join('|')}\n`);
                setTimeout(() => {
                    reader.resume();
                }, 1000);
            }
        });

        // Implement Ping/Pong protocol for heartbeats.
        socket.on('data', data => {
            log.info(`Received: '${data}'`);
            console.log(`------- Received: '${data}'`);
            if (data.toString().match(/^\* PING/)) {
                socket.write('* PONG 10000\n');
            }
        });

        // if the socket closes or errors, stop the reader.
        socket.on('end', () => {
            log.info('Socket closed');
            reader.close();
        });

        socket.on('error', (err, ctx) => {
            log.warn(`Socket error: ${err}`);
            reader.close();
            stopReading = true;
        });
    });
}

module.exports = device;
