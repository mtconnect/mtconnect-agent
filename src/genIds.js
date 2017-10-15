const uuidv5 = require('uuid/v5')
const bigInt = require('big-integer')

const smallLetters = [...Array(26)].map((q,w)=>String.fromCharCode(w+97))
const capitalLetters = [...Array(26)].map((q,w)=>String.fromCharCode(w+65))
const numbers = [...Array(10)].map((q, w) => String.fromCharCode(w+48))
const firstDigit = ['_'].concat(smallLetters, capitalLetters)
const restDigits = firstDigit.concat(['-', '.'], numbers)


function genId(uuid) {
	const id = uuid.split('-').join('')
	const number = String(bigInt(id, 16))
	return to_id(number) 
}

function to_id(number){
	const obj = bigInt(number).divmod(firstDigit.length)
	number = String(obj.quotient)
	const first = firstDigit[Number(obj.remainder)]
	return first + rest_digits(number)
}

function rest_digits(number){
	let rest = '', obj
	for(let i = 0; i < 9; i++){
		obj = bigInt(number).divmod(restDigits.length)
		number = String(obj.quotient)
		rest += restDigits[Number(obj.remainder)]
	}
	return rest
}

module.exports = {
	genId
}