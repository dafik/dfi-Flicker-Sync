var utils = require('util');
var EventEmitter = require('events').EventEmitter;

function TreeItem(node) {
    TreeItem.super_.call(this);

    this.children = [];

    if(node) {
        this.data = node.data;
        this.selected = node.selected;
        this.partsel = node.partsel;
    }
}
utils.inherits(TreeItem, EventEmitter);


TreeItem.prototype.addChild = function (child) {
    this.children.push(child);
};


var Events = {

};

module.exports = TreeItem;
module.exports.Events = Events;

