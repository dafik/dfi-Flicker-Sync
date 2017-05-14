"use strict"
global.$ = $;
var $ = require('jquery');
/**
 * @typedef {{App:App,Base:Base,Clipboard:{get:function()}, Menu:Menu,MenuItem:MenuItem, Screen:{Init:function()|undefined,screens:{bounds}[]}, Shell:{openExternal:function(uri),openItem:function(path),showItemInFolder:function(path)}, Shortcut:Shortcut, Tray:Tray, Window:{canSetVisibleOnAllWorkspaces:function(),get:function(other:string),open:function(url,options)} }} NWGui
 */

/**
 * @type {NWGui|exports}
 */
var gui = require('nw.gui');


//var DfiSync = require(global.libPath + '/app/DfiSync');

$(document).ready(function () {
    DfiSync.init(gui);
});
