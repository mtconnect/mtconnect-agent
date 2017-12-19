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


var commonmark = require("commonmark");

var infile = "../doc/standard/upnp.md";
var outfile = "../build/upnp.md";

var fs = require('fs');
var md = fs.readFileSync(infile, {encoding: "utf8"});

var reader = new commonmark.Parser();
var parsed = reader.parse(md);

var out = md.split("\n");

var walker = parsed.walker();
var event, node, source, i;

while ((event = walker.next())) {
    node = event.node;
    if (node.type === "code_block") {
        source = node.sourcepos;
        for (i = source[0][0] - 1; i < source[1][0]; i += 1) {
            out[i] = false;
        }
    }
}

out = out.filter(function (el) {
    if (el === false) {
        return false;
    } else {
        return true;
    }
});

fs.writeFileSync(outfile, out.join("\n"));
