/**
 * Created by dafi on 24.03.15.
 */
var utils = require('util');
var EventEmitter = require('events').EventEmitter;
var async = require('async');
require("collections/shim-array");
require("collections/listen/array-changes");


var QueueItem = require(global.libPath + '/app/queue/Item');

function Queue() {
    Queue.super_.call(this);
    /**
     * @type {Set}
     */
    this.items = new Array()
    var parallel = 10;

    this.queue = async.queue(onQueueTask, parallel);
    /**
     *
     * @param {QueueItem} task
     * @param {function} callback
     */
    function onQueueTask(task, callback) {
        console.log('hello ' + task.id);
        task.on(QueueItem.Events.complete, function () {
            callback();
        })
        task.start()
    }
};

utils.inherits(Queue, EventEmitter);


Queue.prototype.start = function () {
    var that = this;
    this.queue.drain = function () {
        console.log('all items have been processed');
        that.emit(Events.finish);
    };


    this.queue.push(this.items.toArray(), onTaskEnd);

    function onTaskEnd(err) {
        if (err) {
            throw err
        }
        that.removeItem(this.data);
    }

};
Queue.prototype.stop = function () {

};

/**
 * @param {QueueItem} queueItem
 */
Queue.prototype.addItem = function (queueItem) {
    this.items.set(queueItem.id,queueItem);
    this.emit(Events.itemAdded, queueItem);
};

/**
 * @param {QueueItem} queueItem
 */
Queue.prototype.removeItem = function (data) {
    this.items.delete(data.id);
    this.emit(Events.itemRemoved, data);
};

var Events = {
    itemAdded: 'itemAdded',
    itemRemoved: 'itemRemoved',
    start: 'start',
    finish: 'finish'
}

module.exports = Queue
module.exports.Events = Events;
