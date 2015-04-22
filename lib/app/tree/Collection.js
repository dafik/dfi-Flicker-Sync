var utils = require('util');
var TreeItem = require('./Item');

function TreeCollection(node) {
    TreeCollection.super_.call(this,node);

}
utils.inherits(TreeCollection, TreeItem);

TreeCollection.prototype.start = function () {

};

var Events = {

};

module.exports = TreeCollection;
module.exports.Events = Events;

