/**
  * Copyright 2016, System Insights, Inc.
  *
  * Licensed under the Apache License, Version 2.0 (the "License");
  * you may not use this file except in compliance with the License.
  * You may obtain a copy of the License at
  *
  *    http://www.apache.org/licenses/LICENSE-2.0
  *
  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
  */

// Imports - External
const R = require('ramda')

// Import - Internal

function goThruComponent(component, componentToFind){
  const keys = R.keys(component)
  const len = keys.length
  let foundComponent
  let i = 0
  let componentWithIn
  
  while((!foundComponent) && (i < len)){

    if(R.contains(componentToFind, keys)){
      foundComponent = component[componentToFind]
      return foundComponent
    }

    key = keys[i]
    componentWithIn = component[key]
    foundComponent = loopThruComponentWithIn(componentWithIn, componentToFind)
    
    i++
  }
  
  return foundComponent
}

function loopThruComponentWithIn(componentWithIn, componentToFind){
  const len = componentWithIn.length
  let foundComponent
  let i = 0
  let component
  while(!foundComponent && i < len){
    component = componentWithIn[i]

    if(component.Components){
      foundComponent = dealWithComponents(component.Components, componentToFind)
    }
    
    i++
  }
  return foundComponent
}

function dealWithComponents(components, componentToFind){
  const len = components.length
  let foundComponent
  let i = 0
  let component
  
  while((!foundComponent) && (i < len)){
    component = components[i]
    foundComponent = goThruComponent(component, componentToFind)
    i++
  }
  
  return foundComponent
}

function findComponent(latestSchema, componentToFind){
  let foundComponent
  let keys
  const components = latestSchema[latestSchema.length - 1].device.Components
  
  if(components){
    foundComponent = dealWithComponents(components, componentToFind)[0]
  }

  return foundComponent;
}

function getReferences(component) {
  let references = []
  if(component.References){
    R.map(({ Reference }) => {
      R.map(k => references.push(k), Reference)
    }, component.References)
  }
  return references
}

module.exports = {
  findComponent,
  getReferences
}