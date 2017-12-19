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

const uuidv5 = require('uuid/v5');
const bigInt = require('big-integer');

const smallLetters = [...Array(26)].map((q, w) => String.fromCharCode(w + 97));
const capitalLetters = [...Array(26)].map((q, w) => String.fromCharCode(w + 65));
const numbers = [...Array(10)].map((q, w) => String.fromCharCode(w + 48));
const firstDigit = ['_'].concat(smallLetters, capitalLetters);
const restDigits = firstDigit.concat(['-', '.'], numbers);


function genId(uuid) {
    const id = uuid.split('-').join('');
    const number = String(bigInt(id, 16));
    return to_id(number);
}

function to_id(number) {
    const obj = bigInt(number).divmod(firstDigit.length);
    number = String(obj.quotient);
    const first = firstDigit[Number(obj.remainder)];
    return first + rest_digits(number);
}

function rest_digits(number) {
    let rest = '', obj;
    for (let i = 0; i < 9; i++) {
        obj = bigInt(number).divmod(restDigits.length);
        number = String(obj.quotient);
        rest += restDigits[Number(obj.remainder)];
    }
    return rest;
}

module.exports = {
    genId,
};
