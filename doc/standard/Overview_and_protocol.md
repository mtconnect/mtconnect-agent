
# Request Structure

[request.js](#Overview "save:")

## Overview

		_"How the Request Structure should be?""

## How the Request Structure should be?

An MTConnect® request SHOULD NOT include any body in the HTTP
request. If the Agent receives any additional data, the Agent
MAY ignore it. There will be no cookies or additional
information considered; the only information the Agent MUST
consider is the URI in the HTTP GET (Type a URI into the
browser’s address bar, hit return, and a GET is sent to the
server. In fact, with MTConnect® one can do just that. To
test the Agent, one can type the Agent’s URI into the browser’s address
bar and view the results.)

		const expect = require('expect.js');
		const supertest = require('supertest');
		const http = require('http');

		describe('Agent on receiving http request', () => {
			it('with body, body should be ignored', () => {

			});
			it('without body, send the request', () => {
			  const options = {
					hostname: 'localhost',
					port: 8080,
					path: '/sampledevice.xml',
				};
				http.get(options, (res) => {
			    console.log(`Got response: ${res.statusCode}`);
					return expect(res.statusCode).to.eql('200 OK');
				});
			});
		});

## Process Workflow
