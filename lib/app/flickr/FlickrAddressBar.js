var $ = require('jquery');
var events = require("events");
var path = require('path');
var jade = require('jade');
var util = require("util");

// Template engine
var gen_bar = jade.compileFile(global.libPath + '/view/templates/flickr/addressBar.jade');
var genOneFile = jade.compileFile(global.libPath + '/view/templates/flickr/oneFile.jade');

// Our real type
function FlickrAddressBar(parent, element) {
    this.parent = parent;
    events.EventEmitter.call(this);
    this.element = element;

    // Monitor click on FlickrAddressBar
    var self = this;
    element.delegate('a', 'click', function () {
        self.element.children('.active').removeClass('active');
        $(this).parent().addClass('active');

        self.emit('navigate', $(this).parent().data());

        return false;
    });
}

util.inherits(FlickrAddressBar, events.EventEmitter);

FlickrAddressBar.prototype.set = function (dir_path) {
    this.current_path = path.normalize(dir_path);

    // Split path into separate elements
    var sequence = this.current_path.split(path.sep);
    var result = [];

    var i = 0;
    for (; i < sequence.length; ++i) {
        result.push({
            name: sequence[i],
            type: 'collections',
            id: null
        });
    }

    // Add root for *nix
    if (sequence[0] == '' && process.platform != 'win32') {
        result[0] = {
            name: 'root',
            path: '/'
        };
    }

    this.element.html(gen_bar({sequence: result}));
};

FlickrAddressBar.prototype.enter = function (mine) {
    // Where is current
    var how_many = this.element.children().length;
    var where = this.element.children('.active').index();
    this.element.children('li:gt(' + where + ')').remove();

    // Add new folder
    this.element.append(genOneFile({item: mine}));
    //this.element.find('a:last').trigger('click');

    this.element.children('.active').removeClass('active');
    this.element.find('li:last').addClass('active');
};

module.exports = FlickrAddressBar;
