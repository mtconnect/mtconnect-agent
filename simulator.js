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

const ip = require('ip');

// Imports - Internal

const adapter = require('./src/adapter');
const config = require('./src/config/config');

// Constants

const SERVE_FILE_PORT = config.app.simulator.filePort;
const MACHINE_PORT = config.app.simulator.machinePort;

// The main() function

adapter.startFileServer(SERVE_FILE_PORT);

adapter.startSimulator(MACHINE_PORT, ip.address());
