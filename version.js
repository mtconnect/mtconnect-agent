const teamcityName = "##teamcity[setParameter name='vi-version-number' value='";
const teamcityBuild = "##teamcity[buildNumber '";

console.log(`${teamcityName}${process.env.npm_package_version}']`);
console.log(`${teamcityBuild}${process.env.npm_package_version}-{build.number}']`);
