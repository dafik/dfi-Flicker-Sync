global.$ = $;

var $ = require('jquery');
var conf = require('configuration');

var AddressBar = require('address_bar');
var Folder = require('folder_view');
var path = require('path');
var shell = require('nw.gui').Shell;

var FlickerCollections = require('flicker_collections_view');

var gui = require('nw.gui');
global.nwGui = gui;
global.appRoot = process.cwd();

var DfiFlicker = require('flickr');

var collections;

$(document).ready(function () {
    var folderLocal = new Folder($('#folderView .files'));
    var addressBarLocal = new AddressBar($('#folderView .addressbar'));

    var folderFlicker = new FlickerCollections($('#flickrView .files'));
    var addressBarFlicker = new AddressBar($('#flickrView .addressbar'));

    var con = new conf();
    var folderPath = con.getConfig().app.folder;


    function onFolder() {
        $('.nav li.active').removeClass('active');
        $('.local-view').parents('li').addClass('active');
        $('#folderView').show();
        $('#flickrView').hide();

        folderLocal.open(folderPath);
        addressBarLocal.set(folderPath);

        folderLocal.on('navigate', function (dir, mime) {
            if (mime.type == 'folder') {
                addressBarLocal.enter(mime);
            } else {
                shell.openItem(mime.path);
            }
        });

        addressBarLocal.on('navigate', function (dir) {
            folderLocal.open(dir);
        });
    }


    function onFlicker(e) {
        $('.nav li.active').removeClass('active');
        $('.flicker-view').parents('li').addClass('active');
        $('#folderView').hide();
        $('#flickrView').show();

        var opt = {
            method: 'flickr.collections.getTree'
        }
        DfiFlicker(opt, con, onFlickrCollectionsResponse, this);

        function onFlickrCollectionsResponse(err, response) {
            folderFlicker.on('navigate', function (collectionId, collectionName) {
                addressBarFlicker.enter({path: collectionId, name: collectionName});

                var opt = {
                    method: 'flickr.collections.getInfo',
                    collection_id: collectionId
                }

                var found = false;
                collections.forEach(function (collection) {
                    if (collection['$'].id == collectionId) {
                        found = collection.set;
                    }
                })


                folderFlicker.open(found, 'collection');

            });
            collections = response.collections[0].collection;
            addressBarFlicker.set('collections');
            folderFlicker.open(response.collections, 'collections');
        }

        function onFlickrCollectionResponse(colllection, response) {
            folderFlicker.on('navigate', function (photosetId, photosetName) {
                addressBarFlicker.enter({path: photosetId, name: photosetName});

                var opt = {
                    method: 'flickr.photosets.getInfo',
                    photoset_id: photosetId
                }
                DfiFlicker(opt, con, onFlickrCollectionResponse, this);

            });
            addressBarFlicker.set('collections');
            folderFlicker.open(response.photosets);
        }

        function onFlickrSetResponse(err, response) {
            folderFlicker.on('navigate', function (collectionId, collectionName) {
                addressBarFlicker.enter({path: collectionId, name: collectionName});


            });
            addressBarFlicker.set('collections');
            folderFlicker.open(response.photos);
        }

    }


    $('a.local-view').click(onFolder)
    $('a.flicker-view').click(onFlicker)
    onFolder();
});
