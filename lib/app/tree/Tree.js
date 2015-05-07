var utils = require('util');
var TreeItem = require('./Item');

function Tree() {
    Tree.super_.call(this);

}
utils.inherits(Tree, TreeItem);

Tree.prototype.test = function(){

}

module.exports = Tree;