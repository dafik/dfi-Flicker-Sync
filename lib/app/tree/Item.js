var utils = require('util');
var EventEmitter = require('events').EventEmitter;
var Tree = require('./Tree');

function TreeItem(node) {
    TreeItem.super_.call(this);

    this.children = [];
    this.parent = undefined;

    if (node) {
        this.data = node.data;
        this.selected = node.selected;
        this.partsel = node.partsel;
        this.data.name = node.title;
    }

    this.onIdCallbacks = [];
}
utils.inherits(TreeItem, EventEmitter);

/**
 *
 * @param {TreeItem} child
 */
TreeItem.prototype.addChild = function (child) {
    this.children.push(child);
    child.setParent(this);
};

TreeItem.prototype.setParent = function (parent) {
    this.parent = parent;
}

TreeItem.prototype.hasParent = function () {
    if (this.parent) {
        if (!this.parent instanceof  Tree) {
            return true;
        }
    }
    return false;
}

TreeItem.prototype.visit = function (fn, includeSelf) {
    var i, l,
        res = true,
        children = this.children;

    if (includeSelf === true) {
        res = fn(this);
        if (res === false || res === "skip") {
            return res;
        }
    }
    if (children) {
        for (i = 0, l = children.length; i < l; i++) {
            res = children[i].visit(fn, true);
            if (res === false) {
                break;
            }
        }
    }
    return res;
}


TreeItem.prototype.setId = function (id) {
    this.onIdCallbacks.forEach(function (item) {
        var fn = item[0];
        var that = item[1];
        fn.call(that, id);
    })
}
TreeItem.prototype.addOnIdCallback = function (callback, that) {
    this.onIdCallbacks.push([callback, that]);
}


var Events = {};

module.exports = TreeItem;
module.exports.Events = Events;

