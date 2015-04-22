var utils = require('util');
var TreeItem = require('./Item');

function Tree() {
    Tree.super_.call(this);

}
utils.inherits(Tree, TreeItem);

var Events = {

};

module.exports = Tree;
module.exports.Events = Events;