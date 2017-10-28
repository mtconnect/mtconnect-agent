const dom = require('xmldom').DOMParser
const fs = require('fs')

module.exports = (file, config) => {
	const xml = fs.readFileSync(file, 'utf8')
	const doc = new dom().parseFromString(xml, "text/xml")
	doc.getElementsByTagName("Data")[0].attributes[0].value = `${config.address}:${config.machinePort}`
	
	return doc.toString()
}