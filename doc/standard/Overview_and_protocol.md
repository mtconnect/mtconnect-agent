
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

		const expect = require('expect.js');

		const lokijs = require('../src/lokijs');
		const dataStorage = require('../src/dataStorage');

		const cbPtr = dataStorage.circularBuffer;
		const rawData = lokijs.getRawDataDB();

		const idVal = 'dtop_2';
		const uuidVal = '000';

		describe('MTConnect Agent Data Storage', () => {
		  describe('stores the data into a fixed size circular buffer', () => {
				describe('Inserting a data', () => {
				  it('when the buffer is empty', () => {
						rawData.insert({ sequenceId: 0, id: idVal, uuid: uuidVal, time: '2',
													dataItemName: 'estop', value: 'TRIGGERED' });
						let cbArr = cbPtr.toArray();
					//	console.log(dataStorage.firstSequence);					
						return expect(cbArr.length).to.eql(1);
					});
					it('when the buffer is non empty and not full', () => {
						rawData.insert({ sequenceId: 0, id: idVal, uuid: uuidVal, time: '2',
													dataItemName: 'avail', value: 'AVAILABLE' });
						rawData.insert({ sequenceId: 0, id: idVal, uuid: uuidVal, time: '2',
													dataItemName: 'avail', value: 'AVAILABLE' });
						let cbArr = cbPtr.toArray();
					/*	expect(dataStorage.firstSequence).to.eql(0);
						expect(dataStorage.lastSequence).to.eql(2);		*/		
					//	console.log(dataStorage.lastSequence);					
						return expect(cbArr.length).to.eql(3);
					});
					it('when the buffer is full', () => {
						let data = { dataItemName: 'estop',
												 uuid: '000',
												 id: 'dtop_2',
												 value: 'TRIGGERED',
												 sequenceId: 0 } ;
						rawData.insert({ sequenceId: 0, id: idVal, uuid: uuidVal, time: '2',
													dataItemName: 'avail', value: 'AVAILABLE' });
						rawData.insert({ sequenceId: 0, id: idVal, uuid: uuidVal, time: '2',
													dataItemName: 'avail', value: 'AVAILABLE' });
						rawData.insert({ sequenceId: 0, id: idVal, uuid: uuidVal, time: '2',
													dataItemName: 'avail', value: 'AVAILABLE' });
						rawData.insert({ sequenceId: 0, id: idVal, uuid: uuidVal, time: '2',
													dataItemName: 'avail', value: 'AVAILABLE' });
						rawData.insert({ sequenceId: 0, id: idVal, uuid: uuidVal, time: '2',
													dataItemName: 'avail', value: 'AVAILABLE' });
						rawData.insert({ sequenceId: 0, id: idVal, uuid: uuidVal, time: '2',
													dataItemName: 'avail', value: 'AVAILABLE' });
						rawData.insert({ sequenceId: 0, id: idVal, uuid: uuidVal, time: '2',
													dataItemName: 'avail', value: 'AVAILABLE' });
						rawData.insert({ sequenceId: 0, id: idVal, uuid: uuidVal, time: '2',
													dataItemName: 'avail', value: 'AVAILABLE' });
					/*	expect(dataStorage.lastSequence).to.eql(dataStorage.bufferSize -1 ); */
					//	console.log(dataStorage.lastSequence);			
						return expect(dataStorage.backUp[0]).to.eql(data);
					});
				});
			});
		});


The current request MUST provide the last value for each data item even if it is no longer in
the buffer. Even if the event, sample, or condition has been removed from the buffer, the Agent
MUST retain a copy associated with the last value for any subsequent current request.

Therefore if the item 11 above was the last value for the X Position, the current will still
provide the value of 11 when requested.

		//TODO:  end to end test
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

4.1 MTConnectDevices

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

			describe('Reply XML Document Structure', () => {
				describe('should contain <Header …/>, MTConnectDevices,', () => {
					describe('<Devices> … </Devices>', () => {


					});
				});
			});

	4.1.1 MTConnectDevices Elements

	An MTConnectDevices element MUST include the Header for all documents and the  Devices element.

		______________________________________________________________________________
	 |Element 	|			Description 																		 | Occurence  |
	 |__________|______________________________________________________|____________|
	 | Header   | A simple header with next sequence and creation time |	   1   		|
	 | Devices  | The root of the descriptive data                     |		 1 			|
	 |__________|______________________________________________________|____________|


4.2 MTConnectStreams

MTConnectStreams contains a timeseries of Samples, Events, and Condition from devices and their components.
In an MTConnectStreams XML Document, there MUST be a Header and it MUST be followed by a Streams section.
An MTConnectStreams XML Document will have the following structure (the details have been eliminated for illustrative purposes):

	12. <MTConnectStreams xmlns:m="urn:mtconnect.com:MTConnectStreams:1.1" 13. xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
	14. xmlns="urn:mtconnect.com:MTConnectStreams:1.1"
	15. xsi:schemaLocation="urn:mtconnect.com:MTConnectStreams:1.1  
			http://www.mtconnect.org/schemas/MTConnectStreams.xsd">
	16. <Header … />
	17. <Streams> … </Streams>
	18. </MTConnectStreams>

		______________________________________________________________________________
	 |Element 	|			Description 																		 | Occurence  |
	 |__________|______________________________________________________|____________|
	 | Header   | A simple header with next sequence and creation time |	   1   		|
	 | Streams  | The root of the sample and event data                |		 1 			|
	 |__________|______________________________________________________|____________|

		 describe('Reply XML Document Structure', () => {
			 describe('should contain <Header …/>, MTConnectStreams,', () => {
				 describe('<Streams> … </Streams>', () => {


				 });
			 });
		 });


4.4 MTConnectError

An MTConnectError document contains information about an error that occurred in  processing the request. In an MTConnectError XML Document, there MUST be a Header  and it must be followed by an
Errors container that can contain a series of Error elements:

	1. <?xml version="1.0" encoding="UTF-8"?>
	2. <MTConnectError xmlns="urn:mtconnect.org:MTConnectError:1.1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:mtconnect.org:MTConnectError:1.1  
	   http://www.mtconnect.org/schemas/MTConnectError_1.1.xsd">
	3. <Header creationTime="2010-03-12T12:33:01" sender="localhost"  version="1.1" bufferSize="131072" instanceId="1268463594" />
	4. <Errors>
	5. <Error errorCode="OUT_OF_RANGE" >Argument was out of range</Error>
	6. <Error errorCode="INVALID_XPATH" >Bad path</Error>
	7. </Errors>
	8. </MTConnectError>

For purposes of backward compatibility, a single error can have a single Error element.
	1. <?xml version="1.0" encoding="UTF-8"?>
	2. <MTConnectError xmlns="urn:mtconnect.org:MTConnectError:1.1"
			xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
			xsi:schemaLocation="urn:mtconnect.org:MTConnectError:1.1  	
	    http://www.mtconnect.org/schemas/MTConnectError_1.1.xsd">
	3. <Header creationTime="2010-03-12T12:33:01" sender="localhost" version="1.1" bufferSize="131072" instanceId="1268463594" />
	4. <Error errorCode="OUT_OF_RANGE" >Argument was out of range</Error>
	5. </MTConnectError>


	4.4.1 MTConnectError Elements
	An MTConnect® document MUST include the Header for all documents and one Error element.
	______________________________________________________________________________
 |Element 	|			Description 																		 | Occurence  |
 |__________|______________________________________________________|____________|
 | Header   | A simple header with next sequence and creation time |	   1   		|
 | Errors   | A collection of Error elements.                      |		 1 			|
 |__________|______________________________________________________|____________|

		describe('Reply XML Document Structure', () => {
		 describe('should contain <Header …/>,  MTConnectError,', () => {
			 describe('<Error> … </Error>', () => {


			 });
		 });
		});

4.5 Header
Every MTConnect® response MUST contain a header as the first element below the root element
of any MTConnect® XML Document sent back to an application. The following information
MUST be provided in the header: creationTime, instanceId, sender, bufferSize,
and version. If the document is an MTConnectStreams document it MUST also contain
the nextSequence, firstSequence, and lastSequence attributes as well.


4.6 MTConnectDevices Header

4.6.1 Header attributes:
See below for full description of common attributes

4.6.2 Header Elements
________________________________________________________________________________________________________________________
|						 |																																												  |								|
|		Element	 |			Description																																				  |	Occurrence		|												
|____________|__________________________________________________________________________________________|_______________|
|						 |Contains the number of each asset type currently in the agent. This allows applications   |								|
| AssetCount |to determine the present of assets of a certain type. The CDATA of this MUST be an integer|								|
|						 |value representing the count. It MUST be less than or equal to the                        |  0..1					|
|						 |maximum number of assets (assetBufferSize).                                               |								|
|            |																																													|								|
|____________|__________________________________________________________________________________________|_______________|

 ______________________________________________________________________________
|Element   |			Description 																		| Occurence  |
|__________|______________________________________________________|____________|
|assetType |  The type of assets for the count.            				|	   1   	   |
|__________|______________________________________________________|____________|

4.7 MTConnectStreams Header

The second header is for MTConnectStreams where the protocol sequence information 650 MUST be provided:

<Header creationTime="2010-03-13T07:59:11+00:00" sender="localhost"
  instanceId="1268463594" bufferSize="131072" version="1.1"
  nextSequence="154" firstSequence="1" lastSequence="153" />


4.9 MTConnectError Header
The MTConnectError header is as follows

4.10 All Header Attributes
_____________________________________________________________________________________
| Attribute     | Description                                     			| Occurrence |
|_______________|_______________________________________________________|____________|
|creationTime   | The time the response was created.              			|     1      |
|_______________|_______________________________________________________|____________|
|nextSequence   | The sequence number to use for the next request. Used |						 |
|               | for sample and current requests. Not used in probe 		|  0..1      |
|							  | request. This value MUST have a maximum value of 			|            |
| 						  | 2^64-1 and MUST be stored in a signed 64 bit integer.	|            |
|_______________|_______________________________________________________|____________|
|instanceId     |A number indicating which invocation of the Agent.     |            |
|               |This is used to differentiate between separate         |   1        |
|							  |instances of the Agent. This value MUST have a maximum |            |
|							  |value of 2^64-1 and MUST be stored in a unsigned 64 bit|						 |
|               |integer.                                               |						 |
|_______________|_______________________________________________________|____________|
|testIndicator  |Optional flag that indicates the system is operating in|						 |
|               |test mode. This data is only for testing and indicates |  0..1      |
|               |that the data is simulated.                            |            |
|_______________|_______________________________________________________|____________|
|sender         |The Agent identification information.                  |  1         |
|_______________|_______________________________________________________|____________|
|bufferSize     |The number of Samples, Events, and Condition that will |						 |
|   					  |be retained by the Agent. The buffersize MUST be an    |		1				 |
|       			  |unsigned positive integer value with a maximum value   |						 |
|							  |of 2^32-1.                                             |						 |
|_______________|_______________________________________________________|____________|
|firstSequence  |The sequence number of the first sample or event				|						 |
|							  |available. This value MUST have a maximum value of 		|		0..1		 |
|							  |2^64-1 and MUST be stored in an unsigned 64 bit        |						 |
| 						  | integer.																							|						 |
|_______________|_______________________________________________________|____________|
|lastSequence   |The sequence number of the last sample or event  			|						 |
|               |available. This value MUST have a maximum value of 		|			0..1	 |
|							  |2^64-1 and MUST be stored in an unsigned 64 bit				|						 |
|   					  | integer.																							|						 |
|_______________|_______________________________________________________|____________|
|version			  |The protocol version number. This is the major and 		|						 |
|							  |minor version number of the MTConnect standard being		|			1 		 |
|							  | used. For example if the version number is current	 	|						 |
|							  |10.21.33, the version will be 10.21.										|						 |
|_______________|_______________________________________________________|____________|
|assetBufferSize|The maximum number of assets this agent can store. MUST|						 |						 
|								|be an unsigned positive integer value with a maximum   |			1			 |
|               |value of 2^32-1.                                       |						 |
|_______________|_______________________________________________________|____________|
|assetCount			|The total number of assets in the agent. MUST be an 		|						 |
|								|unsigned positive integer value with a maximum value of|		1				 |
|								|2^32-1. This value MUST not be greater than 						|						 |
|								|assetBufferSize.																				|						 |
|_______________|_______________________________________________________|____________|


The nextSequence, firstSequence, and lastSequence number MUST be included
in sample and current responses. These values MAY be used by the client application to
determine if the sequence values are within range.The testIndicator MAY be provided as
needed.

Details on the meaning of various fields and how they relate to the protocol are described in
detail in the next section on Section 5 - Protocol. The standard specifies how the protocol MUST
be implemented to provide consistent MTConnect® Agent behavior.

The instanceId MAY be implemented using any unique information that will be guaranteed
to be different each time the sequence number counter is reset. This will usually happen when the
MTConnect® Agent is restarted. If the Agent is implemented with the ability to recover the event
stream and the next sequence number when it is restarted, then it MUST use the same
instanceId when it restarts.

The instanceId allows the MTConnect® Agents to forgo persistence of Events, Condition,
and Samples and restart clean each time. Persistence is a decision for each implementation to be
determined. This will be discussed further in the section on Section 5.11 - Fault Tolerance and
Recovery.

The sender MUST be included in the header to indicate the identity of the Agent sending the
response. The sender MUST be in the following format: http://<address>[:port]/.
The port MUST only be specified if it is NOT the default HTTP port 80.

The bufferSize MUST contain the maximum number of results that can be stored in the
Agent at any one instant. This number can be used by the application to determine how
frequently it needs to sample and if it can recover in case of failure. It is the decision of the
implementer to determine how large the buffer should be.

As a general rule, the buffer SHOULD be sufficiently large to contain at least five minutes’
worth of Events, Condition, and Samples. Larger buffers are more desirable since they allow
longer application recovery cycles. If the buffer is too small, data can be lost. The Agent
SHOULD NOT be designed so it becomes burdensome to the device and could cause any
interruption to normal operation.
