//externals
const fs = require('fs')
const R = require('ramda')

//constants
const files = fs.readdirSync('./schema')
const schemas = R.filter(item => item !== '.git' && item !== 'readme.md', files)
const readme = R.filter(item => item === 'readme.md', files)[0]

function *getSchema () {
	const { id } = this.params
	const contains = R.contains(id, schemas)
	let content
	
	if(contains){
		content = fs.readFileSync(`./schema/${id}`)
		this.set('Content-Type', 'text/xml')
	} else {
		content = 'Not found'
	}

	this.body = String(content)
}

function *showSchemas () {
	let content
	
	if(readme){
		content = fs.readFileSync(`./schema/${readme}`)
	} else {
		content = 'Not found'
	}
	
	this.body = String(content)
}

module.exports = (router) => {
	router
		.get('/schema/:id', getSchema)
		.get('/schema', showSchemas)
}