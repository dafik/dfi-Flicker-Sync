/**
 * Created by dafi on 24.03.15.
 */
var utils = require('util');
var EventEmitter = require('events').EventEmitter;
var fs = require('fs');

var DfiFlicker = require(global.libPath + '/app/flickr/FlickrApi');
var DfiSync = require(global.libPath + '/app/DfiSync');

function QueueItem(type, options) {
    QueueItem.super_.call(this);
    this.type = type;
    this.view = undefined;
    this.options = options;
    this.id = ActionUniqueId();
    this.progress = 0;
}
utils.inherits(QueueItem, EventEmitter);

QueueItem.prototype.start = function () {
    var that = this;

    this.on(Events.complete, onComplete);
    this.on(Events.progress, onProgress);
    /**
     * @type {number}
     */
    var random = Math.floor(Math.random() * 1000);


    //var interval = setInterval(onInterval, random);
    switch (this.type) {
        case Types.collection :
            this.syncCollection();
            break;
        case Types.album :
            this.syncAlbum();
            break;
        case Types.photo :
            this.syncPhoto();
            break;

    }

    this.emit(Events.start, this);


    function onProgress() {
        that.view.find('.progress-bar').css('width', that.progress + '%').text(that.progress + '%');
    }

    function onComplete() {
        //clearInterval(interval);
        that.removeListener(Events.progress, onProgress);
        that.removeListener(Events.complete, onComplete);
    }

    function onInterval() {
        that.setProgress(10);
    }
};


QueueItem.prototype.setProgress = function (value) {

    value = parseInt(value);

    if (value >= 100) {
        this.emit(Events.progress, this);
        this.emit(Events.complete, this);
    } else {
        this.progress = value;
        this.emit(Events.progress, this);
    }
};


/**
 * @param {FancytreeNode} node
 */
QueueItem.prototype.syncCollection = function () {
    //noinspection JSUnusedLocalSymbols
    var that = this;


    /*
     title:test
     description:
     parent_id:0
     method:flickr.collections.create
     src:js

     no_move:1
     after_new_coll:1
     collection_id:0
     child_collection_ids:56747602-72157651467753026,56747602-72157651457912026,56747602-72157640685004114,56747602-72157640434862224,56747602-72157640434476163,56747602-72157640430582455,56747602-72157640431431814,56747602-72157640430894183,56747602-72157640428966385,56747602-72157640431099874
     method:flickr.collections.sortCollections
     src:js

     collection_id:56747602-72157651467753026
     photoset_ids:72157651539750685
     do_remove:0
     method:flickr.collections.editSets
     src:js

     collection_id:56747602-72157651467753026
     photoset_ids:72157651539750685,72157651526904521
     do_remove:0
     method:flickr.collections.editSets
     src:js
     */


    function createCollection() {

        var opt = {
            method: 'flickr.collections.create',
            title: that.options.title,
            parent_id: that.options.parentId
        };

        DfiFlicker(opt, DfiSync.configuration.conf, function (err, response) {

            var collectionId = response.collection[0].$.id;
            that.options.collectionId = collectionId;
            that.options.item.setId(collectionId);

            that.emit(Events.complete, this);
        }, that);
    }

    function sortCollection() {

        var opt = {
            method: 'flickr.collections.create',
            title: that.options.title,
            parent_id: that.options.parentId
        };

        DfiFlicker(opt, DfiSync.configuration.conf, function (err, response) {

            that.options.collectionId = response
            that.options.fCollectionId = function () {
                return node.data.photoSetId;
            }
            sortCollection();
        }, that);
    }


    createCollection();

};

/**
 * @param {FancytreeNode} node
 * @param callback
 * @param thisp
 */
QueueItem.prototype.syncAlbum = function () {
    var that = this;
    //noinspection JSUnusedLocalSymbols
    //var placeholderId = DfiSync.configuration.getConfig().flickr.photosetPlaceholderId;

    function onAlbumCreated(albumId) {
        var opt = {
            method: 'flickr.collections.getTree',
            collection_id: that.options.collectionId
        };

        DfiFlicker(opt, DfiSync.configuration.conf, function (err, response) {
            onCollectionInfo(response, albumId);
        }, this);
    }

    function onCollectionInfo(info, albumId) {
        /*collection_id:56747602-72157651467753026
         photoset_ids:72157651539750685
         do_remove:0
         method:flickr.collections.editSets*/

        var currentIds = [];
        var item = info.collections[0].collection[0];
        item.set.forEach(function (value) {
            currentIds.push(value['$'].id)
        })
        currentIds.push(albumId);

        var opt = {
            method: 'flickr.collections.editSets',
            collection_id: that.options.collectionId,
            photoset_ids: currentIds.join(),
            do_remove: 0
        };

        DfiFlicker(opt, DfiSync.configuration.conf, function (err, response) {
            that.emit(Events.complete, this);
        }, this);
    }

    var opt = {
        method: 'flickr.photosets.create',
        title: this.options.title,
        primary_photo_id: this.options.placeholderId
    };

    DfiFlicker(opt, DfiSync.configuration.conf, function (err, response) {
        var albumId = response.photoset[0]['$'].id;

        that.options.albumId = albumId;
        that.options.item.setId(albumId);

        onAlbumCreated(albumId);
    }, this);
};

/**
 * @param {FancytreeNode} node
 * @param {function} [callback]
 * @param {*} [thisp]
 */
QueueItem.prototype.syncPhoto = function () {
    var that = this;

    function onUploadRequest(err, request) {
        console.log('syncPhoto id: ' + that.id + ' up onUploadRequest');
        var totalbytes = request._headers['content-length'];

        function onInterval() {
            var dispatched = request.connection._bytesDispatched;
            var progress = dispatched * 100 / totalbytes;
            if (progress > 99) {
                progress = 99;
            }

            //console.log('syncPhoto id: ' + that.id + ' up progres ' + progress + ' total:' + totalbytes + ' dip:' + dispatched);
            that.setProgress(progress);
        }

        var interval = setInterval(onInterval, 100);

        request.on('response', function (res) {
            console.log('syncPhoto id: ' + that.id + ' upload onresponse ' + res.statusMessage);
            clearInterval(interval);
            that.setProgress(99);
        }).on('error', function (err) {
            console.log('syncPhoto id: ' + that.id + ' upload onerror ' + err.message);
            clearInterval(interval);
            that.setProgress(99);
        }).on('timeout', function () {
            console.log('syncPhoto id: ' + that.id + ' upload ontimeout ');
            clearInterval(interval);
            that.setProgress(99);
        })
    }

    function onAssignRequest(err, request) {
        console.log('syncPhoto id: ' + that.id + ' up onAssignRequest');
        function onInterval() {
            var x = 1;
        }

        /*       var interval = setInterval(onInterval, 1000);
         request.on('response', function (res) {
         console.log('syncPhoto id: ' + that.id + ' assign onresponse ' + res.statusMessage);
         clearInterval(interval);
         that.setProgress(99);
         that.emit(Events.complete, this);
         }).on('error', function (err) {
         console.log('syncPhoto id: ' + that.id + ' assign onerror ' + err.message);
         clearInterval(interval);
         that.setProgress(99);
         that.emit(Events.complete, this);
         }).on('timeout', function () {
         console.log('syncPhoto id: ' + that.id + ' assign ontimeout ');
         clearInterval(interval);
         that.setProgress(99);
         that.emit(Events.complete, this);
         })*/
    }


    function assignToAlbum(err, response) {
        console.log('syncPhoto id: ' + that.id + ' up assignToAlbum');
        that.setProgress(10);

        var opt = {
            method: 'flickr.photosets.addPhoto',
            photoset_id: that.options.fAlbumId(),
            photo_id: response.photoid[0]
        };

        //noinspection JSPotentiallyInvalidUsageOfThis
        DfiFlicker(opt, DfiSync.configuration.conf, function (err, response) {
            that.setProgress(20);
            console.log('syncPhoto id: ' + that.id + ' up onassignToPhotoSet');
            onAlbumAsigned();
        }, this, onAssignRequest, this);
    }

    function onAlbumAsigned() {
        console.log('syncPhoto id: ' + that.id + ' up onAlbumAsigned');
        that.setProgress(30);


        var opt = {
            method: 'flickr.photosets.getPhotos',
            photoset_id: that.options.fAlbumId(),
            user_id: that.options.userId
        };

        function hasPhoto(id, response) {
            var found = false;
            response.photoset[0].photo.forEach(function (item) {
                if (id == item['$'].id) {
                    found = true;
                }
            })
            return found;
        }

        //noinspection JSPotentiallyInvalidUsageOfThis
        DfiFlicker(opt, DfiSync.configuration.conf, function (err, response) {
            that.setProgress(40);
            console.log('syncPhoto id: ' + that.id + ' up onassignToPhotoSet');
            if (hasPhoto(that.options.placeholderId, response)) {
                onHasPlaceholder()
            } else {
                that.setProgress(100);
                if (typeof callback == "function") {
                    callback.call(thisp, err);
                }
            }
        }, this, onAssignRequest, this);
    }

    function onHasPlaceholder() {
        console.log('syncPhoto id: ' + that.id + ' up onHasPlaceholder');
        that.setProgress(50);

        var opt = {
            method: 'flickr.photosets.removePhoto',
            photoset_id: that.options.fAlbumId(),
            photo_id: that.options.placeholderId
        };

        //noinspection JSPotentiallyInvalidUsageOfThis
        DfiFlicker(opt, DfiSync.configuration.conf, function (err, response) {
            console.log('syncPhoto id: ' + that.id + ' up onassignToPhotoSet');
            that.setProgress(100);
            if (typeof callback == "function") {
                callback.call(thisp, err);
            }
        }, this, onAssignRequest, this);

    }

    /*           var opt = {
     method: 'upload',
     photo: 'The file to upload.',
     title: '(optional) The title of the photo.',
     description: '(optional) A description of the photo. May contain some limited HTML.',
     tags: ' (optional) A space-separated list of tags to apply to the photo.',
     is_public: ' (optional) Set to 0 for no, 1 for yes. Specifies who can view the photo.',
     is_friend: ' (optional) Set to 0 for no, 1 for yes. Specifies who can view the photo.',
     is_family: ' (optional) Set to 0 for no, 1 for yes. Specifies who can view the photo.',
     safety_level: ' (optional) Set to 1 for Safe, 2 for Moderate, or 3 for Restricted.',
     content_type: ' (optional) Set to 1 for Photo, 2 for ScreenShot, or 3 for Other.',
     hidden: ' (optional) Set to 1 to keep the photo in global search results, 2 to hide from public searches.'
     };*/

    var fullPath = that.options.path;

    var opt = {
        method: 'upload',
        photo: fs.createReadStream(fullPath),
        title: that.options.title,
        is_public: 0,
        is_friend: 0,
        is_family: 0,
        safety_level: 1,
        content_type: 1,
        hidden: 2
    };

    DfiFlicker(opt, DfiSync.configuration.conf, assignToAlbum, this, onUploadRequest, this);
};


var ActionUniqueId = (function () {
    var nextId = 0;
    return function () {
        return ++nextId;
    }
})();
module.exports = QueueItem;


var Events = {
    progress: 'itemAdded',
    start: 'start',
    stop: 'stop',
    complete: 'complete',
    error: 'error'
};
var Types = {
    collection: 'collection',
    album: 'album',
    photo: 'photo'
}

module.exports.Events = Events;
module.exports.Types = Types;




