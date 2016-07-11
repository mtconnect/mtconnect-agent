const R = require('ramda');
// const LRUMap = require('collections/lru-map');
const CBuffer = require('CBuffer')

const bufferSize = 10; // TODO: change it to the required buffer size

const circularBuffer = new CBuffer(bufferSize);



circularBuffer.overflow = function(data) {
    console.log(data);
};

k = circularBuffer.toArray()
//console.log(require('util').inspect(circularBuffer, { depth: null }));
//console.log(cbArray.length);

console.log(k[0], k[bufferSize - 1])
circularBuffer.push({ dataItemName: 'avail', uuid:'000', id: 'dtop_2',
value: 'AVAILABLE', sequenceId: 0 });

k = circularBuffer.toArray()
console.log(k[0], k[bufferSize - 1])
circularBuffer.push({ dataItemName: 'estop', uuid:'000', id: 'dtop_3',
value: 'TRIGGERED', sequenceId: 1 });

k = circularBuffer.toArray()
console.log(k[0], k[bufferSize - 1])
circularBuffer.push({ dataItemName: 'avail', uuid:'000', id: 'dtop_2',
value: 'UNAVAILABLE', sequenceId: 2 });

k = circularBuffer.toArray()

console.log(k[0], k[bufferSize - 1])
circularBuffer.push({ dataItemName: 'estop', uuid:'000', id: 'dtop_3',
value: 'ARMED', sequenceId: 3 });

k = circularBuffer.toArray()
console.log(k[0], k[bufferSize - 1])
circularBuffer.push({ dataItemName: 'estop', uuid:'000', id: 'dtop_3',
value: 'TRIGGERED', sequenceId: 4 });

k = circularBuffer.toArray()

console.log(k[0], k[bufferSize - 1])
circularBuffer.push({ dataItemName: 'avail', uuid:'000', id: 'dtop_2',
value: 'UNAVAILABLE', sequenceId: 5 });

k = circularBuffer.toArray()

console.log(k[0], k[bufferSize - 1])
circularBuffer.push({ dataItemName: 'avail', uuid:'000', id: 'dtop_2',
value: 'AVAILABLE', sequenceId: 6 });

k = circularBuffer.toArray()

console.log(k[0], k[bufferSize - 1])
circularBuffer.push({ dataItemName: 'estop', uuid:'000', id: 'dtop_3',
value: 'TRIGGERED', sequenceId: 7 });

k = circularBuffer.toArray()

console.log(k[0], k[bufferSize - 1])
circularBuffer.push({ dataItemName: 'avail', uuid:'000', id: 'dtop_2',
value: 'AVAILABLE', sequenceId: 8 });

k = circularBuffer.toArray()

console.log(k[0], k[bufferSize - 1])
circularBuffer.push({ dataItemName: 'estop', uuid:'000', id: 'dtop_3',
value: 'ARMED', sequenceId: 9 });

k = circularBuffer.toArray()

console.log(k[0], k[bufferSize - 1])
circularBuffer.push({ dataItemName: 'estop', uuid:'000', id: 'dtop_3',
value: 'ARMED', sequenceId: 10 });

k = circularBuffer.toArray()

console.log(k[0], k[bufferSize - 1])

// console.log(cbArray);


//console.log( R.values(cbArray) );


// const bufferObjects = R.values(circularBuffer.toArray());
// const sameUuid = R.filter((v) => v.uuid === '000')(bufferObjects);
// //sameUuid = sameUuid(cbPtr.toObject());
// const sameId = R.filter((v) => v.id === 'dtop_3')(sameUuid);
// const sameName = R.filter((v) => v.dataItemName === 'estop')(sameId);
//console.log(sameName[sameName.length -1])
