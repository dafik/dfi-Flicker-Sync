global.$ = $;
var $ = require('jquery');
var gui = require('nw.gui');
//var DfiSync = require(global.libPath + '/app/DfiSync');

$(document).ready(function () {
   DfiSync.init(gui);
});
