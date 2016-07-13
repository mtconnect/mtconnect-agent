
# Request Structure

[request.js](#Protocol "save:")

## Protocol

		_"3.1 Request Structure"

## 3.1 Request Structure

An MTConnect® request SHOULD NOT include any body in the HTTP
request. If the Agent receives any additional data, the Agent
MAY ignore it. There will be no cookies or additional
information considered; the only information the Agent MUST
consider is the URI in the HTTP GET (Type a URI into the
browser’s address bar, hit return, and a GET is sent to the
server. In fact, with MTConnect® one can do just that. To
test the Agent, one can type the Agent’s URI into the browser’s address
bar and view the results.)


	/*	describe('Agent on receiving http request', () => {


			it('with body, body should be ignored, send the response', () => {

			});
			it('without body, send the response', () => {

			});
		}); */


 		_"3.3 MTConnect Agent Data Storage"

## 3.3 MTConnect Agent Data Storage

The MTConnect Agent stores a fixed amount of data. This makes the process
remain at a fixed maximum size since it is only required to store a finite
number of events, samples and conditions. The data storage for MTConnect
can be thought of as a tube where data is pushed in one end. When the tube
fills up, the oldest piece of data falls out the other end. The capacity, or
bufferSize, of the MTConnect Agent in this example is 8.  As each piece of
data is inserted into the tube it is assigned a sequentially increasing number.

As a client requests data from the MTConnect Agent it can specify the sequence number from which it will start returning data and the number of items to inspect. For example, the request starts at 15 (from) and requests three items (count). This will set the next sequence number
(nextSequence) to 18 and the last sequence number will always be the last number in the tube. In this example it (lastSequence) is 19.

If the request goes off the end of the tube, the next sequence is set to the lastSequence + 1.
As long as no more data is added to the Agent and the request exceeds the length of the data
available, the nextSequence will remain the same, in this case 20.


		const lokijs = require('../src/lokijs');
		const dataStorage = require('../src/dataStorage');

		const cbPtr = dataStorage.circularBuffer;
		const shdr = lokijs.getRawDataDB();

		const idVal = 'dtop_2';
		const uuidVal = '000';

		describe('MTConnect Agent Data Storage', () => {
		  describe('stores the data into a fixed size circular buffer', () => {
				describe('Inserting a data', () => {
				  it('when the buffer is empty', () => {
						shdr.insert({ sequenceId: 0, id: idVal, uuid: uuidVal, time: '2',
													dataItemName: 'estop', value: 'TRIGGERED' });
						console.log(cbPtr.toArray());
					});
					it('when the buffer is non empty and not full', () => {
						shdr.insert({ sequenceId: 0, id: idVal, uuid: uuidVal, time: '2',
													dataItemName: 'avail', value: 'AVAILABLE' });
						shdr.insert({ sequenceId: 0, id: idVal, uuid: uuidVal, time: '2',
													dataItemName: 'avail', value: 'AVAILABLE' });
					});
					it('when the buffer is full', () => {

					});
				});
			});
		});


The current request MUST provide the last value for each data item even if it is no longer in
the buffer. Even if the event, sample, or condition has been removed from the buffer, the Agent
MUST retain a copy associated with the last value for any subsequent current request.

Therefore if the item 11 above was the last value for the X Position, the current will still
provide the value of 11 when requested.

		describe('/current request', () => {
			describe('gives the recent dataItem values for each dataItem', () => {
				describe('Requesting /current when the buffer ', () => {
					it('is empty', () => {

					});
					it('has atleast one entry for each dataItem', () => {

					});
					it('has no entry for some dataItem', () => {

					});
				});
			});
		});

		_"4 Reply XML Document Structure"

## 4 Reply XML Document Structure

At the top level of all MTConnect® XML Documents there MUST be one of the following XML
elements: MTConnectDevices, MTConnectStreams, or MTConnectError. This element will be the root
for all MTConnect® responses and contains all sub-elements for the protocol.

All MTConnect® XML Documents are broken down into two parts. The first XML element is the
Header that provides protocol related information like next sequence number and creation date
and the second section provides the content for Devices, Streams, or Errors.

The top level XML elements MUST contain references to the XML schema URN and the schema
location. These are the standard XML schema attributes: 509
	1. <MTConnectStreams xmlns:m="urn:mtconnect.com:MTConnectStreams:1.1"
	2. xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
	3. xmlns="urn:mtconnect.com:MTConnectStreams:1.1"
	4. xsi:schemaLocation="urn:mtconnect.com:MTConnectStreams:1.1
	 		http://www.mtconnect.org/schemas/MTConnectStreams.xsd">

MTConnectDevices provides the descriptive information about each device served by this Agent
and specifies the data items that are available. In an MTConnectDevices XML Document, there
MUST be a Header and it MUST be followed by Devices section. An MTConnectDevices XML Document
MUST have the following structure (the details have been eliminated for illustrative purposes):
	5. <MTConnectDevices xmlns:m="urn:mtconnect.com:MTConnectDevices:1.1"
	6. xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
	7. xmlns="urn:mtconnect.com:MTConnectDevices:1.1"
	8. xsi:schemaLocation="urn:mtconnect.com:MTConnectDevices:1.1 		 
					http://www.mtconnect.org/schemas/MTConnectDevices_1.1.xsd">
	9. <Header …/>
	10. <Devices> … </Devices> 529
	11. </MTConnectDevices>
