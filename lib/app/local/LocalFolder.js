var $ = require('jquery');
var events = require('events');
var fs = require('fs');
var path = require('path');
var jade = require('jade');
var util = require('util');


var mime = require(global.libPath + '/app/local/Mime');


// Template engine
var gen_files_view = jade.compileFile(global.libPath + '/view/templates/local/folder.jade');

// Our type
function LocalFolder(parent, jquery_element) {
    this.parent = parent;
    events.EventEmitter.call(this);
    this.element = jquery_element;

    var self = this;
    // Click on blank
    this.element.parent().on('click', function () {
        self.element.children('.focus').removeClass('focus');
    });
    // Click on file
    this.element.delegate('.file', 'click', function (e) {
        self.element.children('.focus').removeClass('focus');
        $(this).addClass('focus');
        e.stopPropagation();
    });
    // Double click on file
    this.element.delegate('.file', 'dblclick', function () {
        var file_path = $(this).attr('data-path');
        self.emit('navigate', file_path, mime.stat(file_path));
    });
}

util.inherits(LocalFolder, events.EventEmitter);

LocalFolder.prototype.open = function (dir) {
    var that = this;
    fs.readdir(dir, function (error, files) {
        if (error) {
            console.log(error);
            window.alert(error);
            return;
        }
        var result;
        for (var i = 0; i < files.length; ++i) {

            result = mime.stat(path.join(dir, files[i]));
            //if (result.type == 'folder' || result.ext.toLowerCase() == 'jpg') {
                files[i] = result;
            //}

        }

        that.element.html(gen_files_view({files: files}));
    });
};

LocalFolder.prototype.getThumbnail = function (file) {
    var length = 65635;
    var buffer = new Buffer(length);
    var fd = fs.openSync(file, 'r');
    fs.readSync(fd, buffer, 0, length);
    var parser = exifParser.create(buffer);
    var result = parser.parse();

    var size = result.getImageSize();
    var x = result.tags.ExifImageHeight;
    var y = result.tags.ExifImageWidth;

    var thumbnail = false;
    var type = false
    if (result.hasThumbnail('image/jpeg')) {
        thumbnail = result.getThumbnailBuffer().toString('base64');
        type = 'image/jpeg';
    } else if (result.hasThumbnail('image/tiff')) {
        thumbnail = result.getThumbnailBuffer().toString('base64');
        type = 'image/tiff';
    }
    return {t: thumbnail, o: (x > y), tt: type};
}

module.exports = LocalFolder;
