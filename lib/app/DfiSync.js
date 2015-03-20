var $ = require('jquery');
var jade = require('jade');

var Configuration = require(global.libPath + '/app/Config');
var LocalAddressBar = require(global.libPath + '/app/local/LocalAddressBar');
var LocalFolder = require(global.libPath + '/app/local/LocalFolder');
var FlickerAddressBar = require(global.libPath + '/app/flickr/FlickrAddressBar');
var FlickerFolder = require(global.libPath + '/app/flickr/FlickrFolder');

var DfiFlicker = require(global.libPath + '/app/flickr/FlickrApi');

var DfiSync = {
    gui: null,
    init: function (gui) {
        var self = this;
        this.gui = gui;
        this.main.init(this);

        this.aside.init(this);
        this.configuration.init(this);
        this.local.init(this);
        this.flickr.init(this);
        this.sync.init(this);

        setTimeout(function () {
            self.aside.onLocal();
        }, 300);
    },
    main: {
        parent: null,
        view: null,
        init: function (parent) {

            var main = jade.renderFile(global.libPath + '/view/templates/main.jade');
            $('body').append(main);

            var asside = jade.renderFile(global.libPath + '/view/templates/aside/main.jade');
            var local = jade.renderFile(global.libPath + '/view/templates/local/main.jade');
            var flickr = jade.renderFile(global.libPath + '/view/templates/flickr/main.jade');
            var sync = jade.renderFile(global.libPath + '/view/templates/sync/main.jade');


            $('aside').append(asside);

            $('#localView').append(local);
            $('#flickrView').append(flickr);
            $('#syncView').append(sync);
        }
    },
    aside: {
        /**
         * @type DfiSync
         */
        parent: null,
        view: null,
        nav: null,
        init: function (parent) {
            this.parent = parent;
            this.view = $('aside');
            this.nav = this.view.find('.nav');

            this.view.find('.local-view').click(this.onLocal.bind(this));
            this.view.find('.flicker-view').click(this.onFlicker.bind(this));
            this.view.find('.sync-view').click(this.onSync.bind(this));
            this.view.find('.conf-view').click(this.onConfig.bind(this));
            this.view.find('.about-view').click(this.onAbout.bind(this));


        },
        changeView: function (type) {
            var allowed = ['local', 'flickr', 'sync'];
            var tmp,
                i = 0;

            if (-1 == allowed.indexOf(type)) {
                throw new Error('type: ' + type + ' not allowed in change view');
            }

            this.nav.find('li.active').removeClass('active');
            this.view.find('.' + type + '-view').parents('li').addClass('active');

            var current = this.parent[type];

            if (this.parent.configuration.conf.getConfig().app.useAnimation) {
                for (i; i < allowed.length; i++) {
                    var tmp = allowed[i];
                    if (tmp != type) {
                        this.parent[tmp].view.hide("drop", {direction: "up"}, "slow");
                    }
                }
                current.view.show("drop", {direction: "down"}, "slow");
            } else {
                for (i; i < allowed.length; i++) {
                    var tmp = allowed[i];
                    if (tmp != type) {
                        this.parent[tmp].view.hide();
                    }
                }
                current.view.show();
            }
            return current;
        },
        onLocal: function () {
            var local = this.changeView('local');

            local.folder.open(this.parent.configuration.folderPath);
            local.addressBar.set(this.parent.configuration.folderPath);

            local.folder.on('navigate', this.parent.local.onFolderNavigate);
            local.addressBar.on('navigate', this.parent.local.onAddressBarNavigate);
        },
        onFlicker: function (e) {
            var local = this.changeView('flickr');
            local.folder.on('navigate', this.parent.flickr.onNavigate);
            local.addressBar.on('navigate', this.parent.flickr.onNavigate);
            local.navigateCollections();
        },
        onSync: function () {
            var local = this.changeView('sync');
            //local.folder.on('navigate', this.parent.flickr.onNavigate);
            //local.addressBar.on('navigate', this.parent.flickr.onNavigate);
            //local.navigateCollections();
        },
        onConfig: function () {
        },
        onAbout: function () {
        }
    },
    local: {
        view: null,
        folder: null,
        folderPath: null,
        addressBar: null,
        init: function (parent) {
            this.parent = parent;
            this.view = $('#localView');
            this.folder = new LocalFolder(this, this.view.find('.files'));
            this.addressBar = new LocalAddressBar(this, this.view.find('.addressbar'));
        },
        onFolderNavigate: function (dir, mime) {
            if (mime.type == 'folder') {
                this.parent.parent.local.addressBar.enter(mime);
            } else {
                this.parent.parent.local.parent.gui.Shell.openItem(mime.path);
            }
        },
        onAddressBarNavigate: function (dir) {
            this.parent.parent.local.folder.open(dir);
        }
    },
    flickr: {
        view: null,
        /**
         * @type null|FlickerFolder
         */
        folder: null,
        /**
         * @type null|FlickerAddressBar
         */
        addressBar: null,
        flickrUserId: null,
        foundCollections: [],
        foundPhotosets: {},
        init: function (parent) {
            this.parent = parent;
            this.view = $('#flickrView');
            this.folder = new FlickerFolder(this, this.view.find('.files'));
            this.addressBar = new FlickerAddressBar(this, this.view.find('.addressbar'));
        },
        onNavigate: function (e) {
            if (e.type == 'collections') {
                this.parent.navigateCollections();
            } else if (e.type == 'collection') {
                this.parent.navigateCollection(e);
            } else if (e.type == 'photoset') {
                this.parent.navigatePhotoset(e)
            } else if (e.type == 'photo') {
                this.parent.navigatePhoto(e)
            }
        },
        navigateCollections: function () {
            this.addressBar.set('collections');
            if (this.foundCollections.length > 0) {
                this.folder.open(this.foundCollections, 'collections');
            } else {
                var opt = {method: 'flickr.collections.getTree'};
                DfiFlicker(opt, this.parent.configuration.conf, onFlickrCollectionsResponse, this);

                function onFlickrCollectionsResponse(err, response) {
                    this.flickrUserId = decodeURIComponent(this.parent.configuration.getConfig().flickr.userNsId);

                    this.foundCollections = response.collections[0].collection;
                    this.folder.open(this.foundCollections, 'collections');
                }
            }
        },

        navigateCollection: function (e) {
            this.addressBar.enter(e);

            var found = [];
            this.foundCollections.forEach(function (collection) {
                if (collection['$'].id == e.id) {
                    found = collection.set || [];
                }
            });

            this.folder.open(found, 'collection');
            this.findPhotoSetThumbnails(found);
        },

        navigatePhotoset: function (e) {
            var id = e.id;
            this.addressBar.enter(e);
            if (this.foundPhotosets.hasOwnProperty(id) && this.foundPhotosets[id].hasOwnProperty('photos')) {
                this.folder.open(this.foundPhotosets[id].photos, 'photoset');
            } else {
                var opt = {method: 'flickr.photosets.getPhotos', photoset_id: e.id, user_id: this.flickrUserId};
                DfiFlicker(opt, this.parent.configuration.conf, onFlickrPhotoSetResponse, this);

                function onFlickrPhotoSetResponse(err, response) {
                    if (this.foundPhotosets.hasOwnProperty(id)) {
                        this.foundPhotosets[id].photos = response.photoset[0].photo;
                    }
                    this.folder.open(response.photoset[0].photo, 'photoset');
                }
            }
        },
        navigatePhoto: function (data) {
            var opt = {method: 'flickr.photos.getSizes', photo_id: data.id};
            DfiFlicker(opt, this.parent.configuration.conf, onFlickerGetSizes, this);

            function onFlickerGetSizes(err, resp) {
                var self = this.parent;
                //      setTimeout(function () {
                var gui = self.gui;

                var screen = this.parent.configuration.determineCurrentScreen()

                var current = gui.Window.get();
                var currentW = current.window;

                var found;
                resp.sizes[0].size.forEach(function (value) {
                    if (value['$'].height < (screen.work_area.height - 50) && value['$'].width < screen.work_area.width) {
                        found = value;
                    }
                });

                var url = found['$'].source;
                var opt = {
                    position: 'center',
                    width: parseInt(found['$'].width),
                    height: parseInt(found['$'].height),
                    "toolbar": false,
                    "true": false
                }

                var new_win = gui.Window.open(url, opt);
                new_win.on('loaded', function () {

                });
                /*
                 close
                 closed
                 */

                //  }, 100);
            }
        },
        findPhotoSetThumbnails: function (tmp) {
            var ids = [];
            tmp.forEach(function (value) {
                var id = value['$'].id;
                if (this.foundPhotosets.hasOwnProperty(id)) {
                    setImage.call(this, this.foundPhotosets[id]);
                } else {
                    var opt = {
                        method: 'flickr.photosets.getInfo',
                        photoset_id: id
                    }
                    DfiFlicker(opt, this.parent.configuration.conf, onFlickrPhotosetResponse, this);
                }
            }, this);

            function onFlickrPhotosetResponse(err, resp) {
                if (resp.hasOwnProperty('photoset')) {
                    this.foundPhotosets[resp.photoset[0]['$'].id] = resp.photoset[0];
                    setImage.call(this, resp.photoset[0]);
                } else {
                    var x = 1;
                }
            }

            function setImage(data) {
                var url = buildUrl(data['$']);
                this.view.find(' .files div[data-id=' + data['$'].id + ']').find('img.imgThumbC').attr('src', url)
            }

            function buildUrl(data) {
                var url = 'https://farm' + data.farm + '.staticflickr.com/' + data.server + '/' + data.primary + '_' + data.secret + '_s.jpg';
                return url;
            }

        }
    },
    sync: {
        view: null,
        init: function (parent) {
            this.parent = parent;
            this.view = $('#syncView');
        }
    },
    configuration: {
        /**
         * @type null|Configuration
         */
        conf: null,
        folderPath: null,
        /**
         * @type null|DfiSync
         */
        parent: null,
        init: function (parent) {
            this.parent = parent;
            this.conf = new Configuration();
            this.folderPath = this.conf.getConfig().app.folder || process.cwd();
        },
        getConfig: function () {
            if (typeof this.conf == "object") {
                return this.conf.getConfig();
            }
        },
        determineCurrentScreen: function () {
            var gui = this.parent.gui;
            if (typeof gui.Screen.Init == "function") {
                gui.Screen.Init();
            }
            var screens = gui.Screen.screens;
            var currentWindow = gui.Window.get();
            var x = currentWindow.x;
            var y = currentWindow.y;

            var width = currentWindow.width;
            var height = currentWindow.height;

            if (x < screens[0].bounds.width) {
                return screens[0]
            } else {
                return screens[1]
            }
        }

    }

};

module.exports = DfiSync;