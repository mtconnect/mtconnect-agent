console.log("##teamcity[setParameter name='vi-version-number' value='"+process.env.npm_package_version+"']");
console.log("##teamcity[buildNumber '"+ process.env.npm_package_version+"-{build.number}']");
