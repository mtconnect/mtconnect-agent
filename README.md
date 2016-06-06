README
======

An implementation of the MTConnect Agent using Node.js.

INSTALL
-------

Install Node v4.4.3 or latest using NVM. A reference documentation is available at:

https://www.digitalocean.com/community/tutorials/how-to-install-node-js-on-an-ubuntu-14-04-server

Install required modules from the top-level directory using:

    $ npm install

You can then start the server using:

    $ npm start

Simulator
---------

To run the adapter (simulator), use the following command:

    $ npm run simulator

The adapter will start sending UPnP NOTIFY messages in the network. A
Wireshark capture is shown below:

![](./doc/images/adapter-notify.png)

You can start the agent as shown below:

    $ npm run agent

The agent will send UPnP M-SEARCH messages in the network. A sample
packet capture is given below:

![](./doc/images/agent-m-search.png)

The adapter will listen to M-SEARCH broadcasts, and if the Search
Target (ST) matches its description, it will respond with a ""HTTP 1.1
OK" message as illustrated below:

![](./doc/images/adapter-http-ok.png)

The agent will then connect to this adapter and will receive simulated
machine data. The following picture shows the agent receiving a
"EXECUTION ACTIVE" SHDR data.

![](./doc/images/adapter-sends-machine-data.png)

Tests
-----

The unit and functional tests can be invoked using Mocha. An example
invocation is shown below:

    $ ./node_modules/mocha/bin/mocha test/adapterTest.js
    WARN: env.VI_VERSION not set unknown
    {"name":"svc-agent","loglevel":"warn","hostname":"foo","pid":26761,"level":30,"msg":"Starting machine TCP server on port 8081","time":"2016-06-06T08:59:33.222Z","v":0}
    {"name":"svc-agent","loglevel":"warn","hostname":"foo","pid":26761,"level":30,"msg":"Starting HTTP web server on port 8080","time":"2016-06-06T08:59:33.227Z","v":0}

      machineDataGenerator
        ✓ should return simulated values

      fileServer
        /public
          ✓ should return 200

      2 passing (32ms)

ESLint
------

The Airbnb JavaScript style guide is used as a reference. The eslint
linting tool can be run on the source code for validation. For
example:

    $ ./node_modules/eslint/bin/eslint.js src/adapter.js
    $

User Acceptance Testing (Standards)
-----------------------------------

You can generate the required integration/acceptance tests using the following command:

    $ ./node_modules/litpro/litpro.js doc/standard/upnp.md
    UNCHANGED ./build/upnp.js
    DONE: ./build

The above step will generate the required JavaScript files required to
run the tests. The actual invocation of the tests is illustrated
below:

    $ ./node_modules/mocha/bin/mocha build/upnp.js
    192.168.1.4
    WARN: env.VI_VERSION not set unknown
    {"name":"svc-agent","loglevel":"warn","hostname":"foo","pid":24639,"level":30,"msg":"Starting machine TCP server on port 8081","time":"2016-06-06T08:31:18.309Z","v":0}
    {"name":"svc-agent","loglevel":"warn","hostname":"foo","pid":24639,"level":30,"msg":"Starting HTTP web server on port 8080","time":"2016-06-06T08:31:18.313Z","v":0}

      machineDataGenerator
        ✓ should return simulated values

      1 passing (7ms)

The standard document in Markdown format can be generated using the
provided generate-standard.js utility as shown below:

    $ cd tools
    $ node generate-standard.js

The generated Markdown file is available in the build/ folder.
