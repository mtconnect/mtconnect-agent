
const config = require('./config')
const Dom = require('xmldom').DOMParser
const fs = require('fs')

module.exports = (file) => {
  const xml = fs.readFileSync(file, 'utf8')
  const doc = new Dom().parseFromString(xml, 'application/xml')
  
  const desc = doc.getElementsByTagName('Description')[0]
  const data = desc.getElementsByTagName('Data')
  if (data.length > 0) {
    data[0].setAttribute('href', `shdr://${config.get('app:address')}:${config.get('app:machinePort')}`)
  } else {
    const ele = doc.createElement('Data')
    ele.setAttribute('href', `shdr://${config.get('app:address')}:${config.get('app:machinePort')}`)
    desc.appendChild(ele)
  }
	
  return doc.toString()
}
