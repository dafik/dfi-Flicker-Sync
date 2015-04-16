var $ = require('jquery');
var events = require('events');
var fs = require('fs');
var path = require('path');
var jade = require('jade');
var util = require('util');


// Template engine
var collectionsView = jade.compileFile(global.libPath + '/view/templates/flickr/collections.jade');
var collectionView = jade.compileFile(global.libPath + '/view/templates/flickr/collection.jade');
var albumView = jade.compileFile(global.libPath + '/view/templates/flickr/set.jade');

// Our type
function FlickrFolder(parent, jquery_element) {
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
        var e = {
            id: $(this).data('id'),
            name: $(this).data('name'),
            type: $(this).data('type')
        };

        self.emit('navigate', e);
    });
}

util.inherits(FlickrFolder, events.EventEmitter);

FlickrFolder.prototype.open = function (collections, type) {
    var self = this;
    var tmp;

    if (type == 'collections') {
        tmp = [];
        collections.forEach(function (collection) {
            if (collection['$'].iconsmall.indexOf('http') == -1) {
                collection['$'].iconsmall = 'https://www.flickr.com' + collection['$'].iconsmall
            }
            tmp.push(collection['$']);
        });

        self.element.html(collectionsView({collections: tmp}));
    }
    if (type == 'collection') {
        tmp = [];
        collections.forEach(function (collection) {
            tmp.push(collection['$']);
        });

        self.element.html(collectionView({collection: tmp}));


    }
    if (type == 'album') {
        tmp = [];
        collections.forEach(function (collection) {
            var data = collection['$'];
            tmp.push({
                id: data.id,
                title: data.title,
                url: buildUrl(data),
                type: 'photo'
            })
        });

        self.element.html(
            albumView(
                {collection: tmp}
            )
        );
    }
};
/**
 * @param {{farm:string,server:string,id:string,secret:string}} data
 * @returns {string}
 */
function buildUrl(data) {
    return 'https://farm' + data.farm + '.staticflickr.com/' + data.server + '/' + data.id + '_' + data.secret + '_s.jpg';
}


module.exports = FlickrFolder;
