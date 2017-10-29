const dom = require('xmldom').DOMParser
const fs = require('fs')

module.exports = (file, config) => {
		const xml = fs.readFileSync(file, 'utf8')
    const doc = new dom().parseFromString(xml, "application/xml")

		const desc = doc.getElementsByTagName("Description")[0];
		var data = desc.getElementsByTagName("Data");
		if (data.length > 0) {
				data = data[0];
				data.setAttribute("href", `${config.address}:${config.machinePort}`)
		} else {
				data = doc.createElement("Data");
				data.setAttribute("href", `${config.address}:${config.machinePort}`)
				desc.appendChild(data);
		}

    return doc.toString()
}
