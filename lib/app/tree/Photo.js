var utils = require('util');
var TreeItem = require('./Item');

function TreePhoto(node) {
    TreePhoto.super_.call(this,node);

}
utils.inherits(TreePhoto, TreeItem);

TreePhoto.prototype.start = function () {

};


var Events = {

};

module.exports = TreePhoto;
module.exports.Events = Events;
