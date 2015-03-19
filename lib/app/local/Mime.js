var fs = require('fs');
var path = require('path');
var _ = require('underscore');
var exifParser = require('exif-parser');
var Buffer = require('buffer').Buffer;


var map = {
    'compressed': ['zip', 'rar', 'gz', '7z'],
    'text': ['txt', 'md', ''],
    'image': ['jpg', 'jpeg', 'png', 'gif', 'bmp'],
    'pdf': ['pdf'],
    'css': ['css'],
    'html': ['html'],
    'word': ['doc', 'docx'],
    'powerpoint': ['ppt', 'pptx'],
    'movie': ['mkv', 'avi', 'rmvb']
};


function getThumbnail(file) {
    var length = 65635;
    var buffer = new Buffer(length);
    var fd = fs.openSync(file, 'r');
    fs.readSync(fd, buffer, 0, length);
    var parser = exifParser.create(buffer);
    var result = parser.parse();

    var thumbnail = false;
    if (result.hasThumbnail('image/jpeg')) {
        thumbnail = result.getThumbnailBuffer().toString('base64');
    }
    return thumbnail;
}

var cached = {};

exports.stat = function (filePath) {
    var result = {
        name: path.basename(filePath),
        path: filePath
    };

    try {
        var stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            result.type = 'folder';
        } else {


            var ext = path.extname(filePath).substr(1);
            result.type = cached[ext];
            if (!result.type) {
                for (var key in map) {
                    if (map.hasOwnProperty(key)) {
                        if (_.include(map[key], ext)) {
                            cached[ext] = result.type = key;
                            break;
                        }
                    }
                }

                if (!result.type)
                    result.type = 'blank';
            }

            if (ext == 'jpg') {
                result.thumbnail = getThumbnail(filePath)
            }
        }
    } catch (e) {
        window.alert(e);
    }

    return result;
};
