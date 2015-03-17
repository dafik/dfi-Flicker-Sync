global.$ = $;

var $ = require('jquery');
var conf = require('configuration');

var AddressBar = require('address_bar');
var AddressBarFlicker = require('addressBarFlicker');
var Folder = require('folder_view');
var path = require('path');
var shell = require('nw.gui').Shell;

var FlickerCollections = require('flicker_collections_view');

var gui = require('nw.gui');
global.nwGui = gui;
global.appRoot = process.cwd();

var DfiFlicker = require('flickr');

var foundCollections;

$(document).ready(function () {
    var folderLocal = new Folder($('#folderView .files'));
    var addressBarLocal = new AddressBar($('#folderView .addressbar'));

    var folderFlicker = new FlickerCollections($('#flickrView .files'));
    var addressBarFlicker = new AddressBarFlicker($('#flickrView .addressbar'));

    var con = new conf();
    var folderPath = con.getConfig().app.folder || process.cwd();


    function onFolder() {
        $('.nav li.active').removeClass('active');
        $('.local-view').parents('li').addClass('active');

        $('#flickrView').hide("drop", { direction: "up" }, "slow");
        $('#folderView').show("drop", { direction: "down" }, "slow");


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
        $('#folderView').hide("drop", { direction: "down" }, "slow");
        $('#flickrView').show("drop", { direction: "up" }, "slow");

        var flickrUserId;

        folderFlicker.on('navigate', onNavigate);
        addressBarFlicker.on('navigate', onNavigate);
        navigateCollections();


        function onNavigate(e) {
            if (e.type == 'collections') {
                navigateCollections();
            } else if (e.type == 'collection') {
                navigateCollection(e);
            } else if (e.type == 'photoset') {
                navigatePhotoset(e)
            }
        }

        function navigateCollections() {
            addressBarFlicker.set('collections');
            var opt = {method: 'flickr.collections.getTree'};
            DfiFlicker(opt, con, onFlickrCollectionsResponse, this);

            function onFlickrCollectionsResponse(err, response) {
                flickrUserId = decodeURIComponent(con.getConfig().flickr.userNsId);

                foundCollections = response.collections[0].collection;
                folderFlicker.open(response.collections, 'collections');
            }
        }

        function navigateCollection(e) {
            addressBarFlicker.enter(e);

            var found = [];
            foundCollections.forEach(function (collection) {
                if (collection['$'].id == e.id) {
                    found = collection.set || [];
                }
            });

            folderFlicker.open(found, 'collection');
            findPhotoSetThumbnails(found);
        }

        function navigatePhotoset(e) {
            var x = foundCollections;
            addressBarFlicker.enter(e);
            var opt = {method: 'flickr.photosets.getPhotos', photoset_id: e.id, user_id: flickrUserId};
            DfiFlicker(opt, con, onFlickrPhotoSetResponse, this);

            function onFlickrPhotoSetResponse(err, response) {
                folderFlicker.open(response.photoset[0].photo, 'photoset');
            }

        }


        function findPhotoSetThumbnails(tmp) {
            var ids = [];
            tmp.forEach(function (value) {
                var opt = {
                    method: 'flickr.photosets.getInfo',
                    photoset_id: value['$'].id
                }
                DfiFlicker(opt, con, onFlickrPhotosetResponse, this);
            })

            function onFlickrPhotosetResponse(err, resp) {
                var x = 1;
                //https://farm4.staticflickr.com/3766/12275679564_2b7250a34b_s.jpg
                var url = buildUrl(resp.photoset[0]['$']);

                $('#flickrView .files div[data-id=' + resp.photoset[0]['$'].id + ']').find('img.imgThumb').attr('src', url)
            }

            function buildUrl(data) {
                var url = 'https://farm' + data.farm + '.staticflickr.com/' + data.server + '/' + data.primary + '_' + data.secret + '_s.jpg';
                return url;
            }

        }


    }


    $('a.local-view').click(onFolder)
    $('a.flicker-view').click(onFlicker)
    onFolder();
});