
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


		describe('Agent on receiving http request', () => {  
			//"Nodes js doesn't support request with body"
			it('with body, body should be ignored, send the response', () => {
					console.log('pending');
			});
			it('without body, send the response', () => {
					console.log('pending');
			});
		});


    _"3.3 MTConnect Agent Data Storage"

## 3.3 MTConnect Agent Data Storage

The MTConnect Agent stores a fixed amount of data. This makes the process
remain at a fixed maximum size since it is only required to store a finite
number of events, samples and conditions. The data storage for MTConnect
can be thought of as a tube where data is pushed in one end. When the tube
fills up, the oldest piece of data falls out the other end. The capacity, or
bufferSize, of the MTConnect Agent in this example is 8.  As each piece of
data is inserted into the tube it is assigned a sequentially increasing number.

As a client requests data from the MTConnect Agent it can specify the sequence
number from which it will start returning data and the number of items to inspect.
For example, the request starts at 15 (from) and requests three items (count).
This will set the next sequence number (nextSequence) to 18 and the last sequence
number will always be the last number in the tube. In this example it (lastSequence) is 19.

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
						rawData.insert({ sequenceId: 0, id: 'dtop_3', uuid: uuidVal, time: '2',
													dataItemName: 'estop', value: 'TRIGGERED' });
						let cbArr = cbPtr.toArray();

						return expect(cbArr.length).to.eql(1);
					});
					it('when the buffer is non empty and not full', () => {
						rawData.insert({ sequenceId: 0, id: idVal, uuid: uuidVal, time: '2',
													dataItemName: 'avail', value: 'AVAILABLE' });
						rawData.insert({ sequenceId: 0, id: idVal, uuid: uuidVal, time: '2',
													dataItemName: 'avail', value: 'AVAILABLE' });
						let cbArr = cbPtr.toArray();									
						return expect(cbArr.length).to.eql(3);
					});
					it('when the buffer is full', () => {
						let data = { dataItemName: 'estop',
												 uuid: '000',
												 id: 'dtop_3',
												 value: 'TRIGGERED',
												 time: 2,
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
							console.log('pending');
					});
					it('has atleast one entry for each dataItem', () => {
							console.log('pending');
					});
					it('has no entry for some dataItem', () => {
							console.log('pending');
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
location. These are the standard XML schema attributes:

	1. <MTConnectStreams xmlns:m="urn:mtconnect.com:MTConnectStreams:1.1"
	2. xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
	3. xmlns="urn:mtconnect.com:MTConnectStreams:1.1"
	4. xsi:schemaLocation="urn:mtconnect.com:MTConnectStreams:1.1
	 		http://www.mtconnect.org/schemas/MTConnectStreams.xsd">

 		_"4.1 MTConnectDevices"

## 4.1 MTConnectDevices

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


			// TO Do
			describe('Reply XML Document Structure', () => {
				describe('should contain <Header …/>',  () => {
					it('MTConnectDevices, <Devices> … </Devices>', () => {
							console.log('pending');

					});
				});
			});

    _"4.1.1 MTConnectDevices Elements"

## 4.1.1 MTConnectDevices Elements

An MTConnectDevices element MUST include the Header for all documents and the Devices element.

 ______________________________________________________________________________
|Element   |			Description 																	  | Occurence  |
|__________|______________________________________________________|____________|
| Header   | A simple header with next sequence and creation time |	    1   	 |
| Devices  | The root of the descriptive data                     |	 	 1 		   |
|__________|______________________________________________________|____________|


		_"4.2 MTConnectStreams"

## 4.2 MTConnectStreams

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
|Element 	 |			Description 																    | Occurence  |
|__________|______________________________________________________|____________|
| Header   | A simple header with next sequence and creation time |	   1   	 	 |
| Streams  | The root of the sample and event data                |		 1 		   |
|__________|______________________________________________________|____________|

		// MTConnect streams not established yet
		// To DO
		describe('Reply XML Document Structure', () => {
			describe('should contain <Header …/>,', () => {
				it(' MTConnectStreams, <Streams> … </Streams>', () => {
						console.log('pending');

				});
			});
		});

		_"4.4 MTConnectError"
## 4.4 MTConnectError

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


		_"4.4.1 MTConnectError Elements"

## 4.4.1 MTConnectError Elements

An MTConnect® document MUST include the Header for all documents and one Error element.
 ______________________________________________________________________________
|Element 	 |			Description 																	  | Occurence  |
|__________|______________________________________________________|____________|
| Header   | A simple header with next sequence and creation time |	   1   		 |
| Errors   | A collection of Error elements.                      |		 1 		 	 |
|__________|______________________________________________________|____________|


		// MTConnectError not done
		// TO DO
		describe('Reply XML Document Structure', () => {
		 describe('should contain <Header …/>,', () => {
		   it(' MTConnectError, <Error> … </Error>', () => {

				 		console.log('pending');
		   });
		 });
		});

		_" 4.5 Header"

## 4.5 Header

Every MTConnect® response MUST contain a header as the first element below the root element
of any MTConnect® XML Document sent back to an application. The following information
MUST be provided in the header: creationTime, instanceId, sender, bufferSize,
and version. If the document is an MTConnectStreams document it MUST also contain
the nextSequence, firstSequence, and lastSequence attributes as well.

		_"4.6 MTConnectDevices Header"

## 4.6 MTConnectDevices Header

		_"4.6.1 Header attributes"
## 4.6.1 Header attributes
See below for full description of common attributes

		_"4.6.2 Header Elements"
## 4.6.2 Header Elements
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


		_"4.7 MTConnectStreams Header"

## 4.7 MTConnectStreams Header

The second header is for MTConnectStreams where the protocol sequence information 650 MUST be provided:

<Header creationTime="2010-03-13T07:59:11+00:00" sender="localhost"
instanceId="1268463594" bufferSize="131072" version="1.1"
nextSequence="154" firstSequence="1" lastSequence="153" />

		_"4.9 MTConnectError Header"
## 4.9 MTConnectError Header
The MTConnectError header is as follows


		_"4.10 All Header Attributes"
## 4.10 All Header Attributes

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


		_"5 Protocol"

## 5 Protocol

The MTConnect® Agent collects and distributes data from the components of a device to other
devices and applications. The standard requires that the protocol MUST function as described in
this section; the tools used to implement the protocol are the decision of the developer.

MTConnect® provides a RESTful interface. The term REST is short for REpresentational State
Transfer and provides an architectural framework that defines how state will be managed within
the application and Agent. REST dictates that the server is unaware of the clients state and it is
the responsibility of the client application to maintain the current read position or next operation.
This removes the server’s burden of keeping track of client sessions. The underlying protocol is
HTTP, the same protocol as used in all web browsers.

The MTConnect® Agent MUST support HTTP version 1.0 or greater. The only requirement for
an MTConnect® Agent is that it MUST support the HTTP GET verb. The response to an
MTConnect® request MUST always be in XML. The HTTP request SHOULD NOT include a
body. If the Agent receives a body, the Agent MAY ignore it. The Agent MAY ignore any cookies
or additional information. The only information the Agent MUST consider is the URI in the
HTTP GET.

If the HTTP GET verb is not used, the Agent must respond with a HTTP 400 Bad Request
indicating that the client issued a bad request. See Section 5.7 HTTP Response Code and Error
for further discussion on error handling.

The reference implementation of MTConnect is based on the use of XML and HTTP. MTConnect
MAY also be implemented in conjunction with other technologies and standards. In its reference
implementation, MTConnect MUST follow the conventions defined in Part 1- Section 5 of the
MTConnect standard. When implemented using other technologies or standards, a companion
specification MUST be developed and exemptions to the requirements in Section 5 MUST be
defined in the companion specification.


		_"5.1 Standard Request Sequence"

## 5.1 Standard Request Sequence

MTConnect® Agent MUST support three types of requests:

probe
To retrieve the components and the data items for the device. Returns an MTCon-
nectDevices XML document.

current  
To retrieve a snapshot of the data item’s most recent values or the state of the de-
vice at a point in time. Returns an 	MTConnectStreams XML document.

sample
To retrieve the Samples, Events, and Condition in time series. Returns an MTCon-
nectStreams XML document.

asset
To request the most recent state of an asset known to this device.

The sequence of requests for a standard MTConnect® conversation will typically begin with the
application issuing a probe to determine the capabilities of the device. The result of the probe
will provide the component structure of the device and all the available data items for each
component.

Once the application determines the necessary data items are available from the Agent, it can
issue a current request to acquire the latest values of all the data items and the next sequence
number for subsequent sample requests. The application SHOULD also record the
instanceId to know when to reset the sequence number in the eventuality of Agent failure.
(See Section 5.11 Fault Tolerance for a complete discussion of the use of instanceId).

Once the current state has been retrieved, the Agent can be sampled at a rate determined by the
needs of the application. After each request, the application SHOULD save the
nextSequence number for the next request. This allows the application to receive all results
without missing a single sample or event and removes the need for the application to compute
the value of the from parameter for the next request.


		_"5.2 Probe Requests"

## 5.2 Probe Requests

The MTConnect® Agent MUST provide a probe response that describes this Agent’s devices
and all the devices’ components and data items being collected. The response to the probe
MUST always provide the most recent information available. A probe request MUST NOT
supply any parameters. If any are supplied, they MUST be ignored. The response from the
probe will be static as long as the machine physical composition and capabilities do not
change, therefore it is acceptable to probe very infrequently. In many cases, once a week may
be sufficient.

The probe request MUST support two variations:

The first provides information on only one device. The device’s name MUST be specified in
the first part of the path. This example will only retrieve components and data items for the
mill-1 device.
13. http://10.0.1.23/mill-1/probe

The second does not specify the device and therefore retrieves information for all devices:
14. http://10.0.1.23/probe


		describe('On receiving /probe ', () => {
			it('Agent sends device schema', () => {
					console.log('pending');
			});
		});

		_'5.3 Sample Request'

## 5.3 Sample Request

The sample request retrieves the values for the component’s data items. The response to a
sample request MUST be a valid MTConnectStreams XML Document.

The diagram below is an example of all the components and data items in relation to one another.
The device has one Controller with a single Path, three linear and one rotary axis. The
Controller’s Path is capable of providing the execution status and the current block of code. The
device has a DataItem with type=”AVAILABILITY”, that indicates the device is
available to communicate.


The following path will request the data items for all components in mill-1 with regards to the
example above (note that the path parameter refers to the XML Document structure from the
probe request, not the XML Document structure of the sample):
	15. http://10.0.1.23:3000/mill-1/sample

This is equivalent to providing a path-based filter for the device named mill-1:
	16. http://10.0.1.23:3000/sample?path=//Device[@name=”mill-1”]

To request all the axes’ data items the following path expression is used:
	17. http://10.0.1.23:3000/mill-1/sample?path=//Axes

To specify only certain data items to be included (e.g. the positions from the axes), use this form:
	18. http://10.0.1.23:3000/mill-1/sample?path=//Axes//DataItem[@type=”POSITION”]

To retrieve only actual positions instead of both the actual and commanded, the following path
 syntax can be used:

	19. http://10.0.1.23:3000/mill-1/sample?path=//Axes//DataItem[@type=”POSITION” and @subType=”ACTUAL”]

or:
	20. http://10.0.1.23:3000/mill- 1/sample?path=//Axes//DataItem[@type=”POSITION” and @subType=”ACTUAL”]&from=50&count=100


The above example will retrieve all the axes’ positions from sample 50 to sample 150. The actual
number of items returned will depend on the contents of the data in the Agent and the number of
results that are actual position samples.

A more complete discussion of the protocol can be found in the section on Protocol Details –
Part 1, Section 5.8.


		_'5.3.1 Parameters'

## 5.3.1 Parameters

All parameters MUST only be given once and the order of the parameters is not important. The
MTConnect® Agent MUST accept the following parameters for the sample request:

path - This is an xpath expression specifying the components and/or data items to include in the
			sample. If the path specifies a component, all data items for that component and any of its sub-
			components MUST be included. For example, if the application specifies the path=//Axes,
			then all the data items for the Axes component as well as the Linear and Rotary sub-
			components MUST be included as well. The path MUST also include any
			ComponentReference and DataItemReference that have been associated by another
			component in the References collection. These items MUST be included as if the xpath had been
			explicitly included in the path.

from - This parameter requests Events, Condition, and Samples starting at this sequence
				number. The sequence number can be obtained from a prior current or sample request. The
				response MUST provide the nextSequence number. If the value is 0 the first available
				sample or event MUST be used. If the value is less than 0 (< 0) an INVALID_REQUEST error
				MUST be returned.

count - The maximum number of Events, Condition, and Samples to consider, see detailed
				explanation below. Events, Condition, and Samples will be considered between from and from
				+ count, where the latter is the lesser of from + count and the last sequence number
				stored in the agent. The Agent MUST NOT send back more than this number of Events,
				Condition, and Samples (in aggregate), but fewer Events, Condition, and Samples MAY be
				returned. If the value is less than 1 (< 1) an INVALID_REQUEST error MUST be returned.


interval – The Agent MUST stream Samples, Events, and Condition to the client application
					 pausing for interval milliseconds between each part. Each part will contain a maximum of
					 count Events, Samples, and Condition and from will be used to indicate the beginning of the
					 stream.


The nextSequence number in the header MUST be set to the sequence number following
the largest sequence number (highest sequence number + 1) of all the Events, Condition, and
Samples considered when collecting the results.

If no parameters are given, the following defaults MUST be used:
The path MUST default to all components in the device or devices if no device is specified.
The count MUST default to 100 if it is not specified.

The from MUST default to 0 and return the first available event or sample. If the latest state is desired, see current.


		_'5.4 Current Request'

## 5.4 Current Request

If specified without the at parameter, the current request retrieves the values for the
components’ data items at the point the request is received and MUST contain the most current
values for all data items specified in the request path. If the path is not given, it MUST respond
with all data items for the device(s), in the same way as the sample request. The current MUST
return the values for the data items, even if the data items are no longer in the buffer.

current MUST return the nextSequence number for the event or sample directly
following the point at which the snapshot was taken. This MUST be determined by finding the
sequence number of the last event or sample in the Agent and adding one (+1) to that value. The
nextSequence number MAY be used for subsequent samples.

The Samples, Events, and Condition returned from the current request MUST have the time-
stamp and the sequence number that was assigned at the time the data was collected. The Agent
MUST NOT alter the original time, sequence, or values that were assigned when the data was
collected.

http://10.0.1.23:3000/mill-1/current?path=//Axes//DataItem[@type=”POSITION” and @subType=”ACTUAL”]

This example will retrieve the current actual positions for all the axes, as with a sample, except
with current, there will always be a sample or event for each data item if at least one piece of
data was retrieved from the device.

http://10.0.1.23:3000/mill-1/current?path=//Axes//DataItem[@type=”POSITION” 988 and @subType=”ACTUAL”]&at=1232

The above example retrieves the axis actual position at a specific earlier point in time - in this
case, at Sequence Number 1232.
