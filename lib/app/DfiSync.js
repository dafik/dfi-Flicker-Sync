var $ = require('jquery');
var jade = require('jade');
var fs = require('fs');
var path = require('path');

var Configuration = require(global.libPath + '/app/Config');
var LocalAddressBar = require(global.libPath + '/app/local/LocalAddressBar');
var LocalFolder = require(global.libPath + '/app/local/LocalFolder');
var FlickerAddressBar = require(global.libPath + '/app/flickr/FlickrAddressBar');
var FlickerFolder = require(global.libPath + '/app/flickr/FlickrFolder');

var DfiFlicker = require(global.libPath + '/app/flickr/FlickrApi');

//noinspection JSClosureCompilerSyntax
var DfiSync = {
    /**
     * @type {NWGui}
     */
    gui: null,
    /**
     * @param {NWGui} gui
     */
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
        }, 1000);
    },
    main: {
        /**
         * @type DfiSync
         */
        parent: null,
        view: null,
        init: function (parent) {
            this.parent = parent;

            var main = jade.renderFile(global.libPath + '/view/templates/main.jade');
            $('body').append(main);

            var aside = jade.renderFile(global.libPath + '/view/templates/aside/main.jade');
            var local = jade.renderFile(global.libPath + '/view/templates/local/main.jade');
            var flickr = jade.renderFile(global.libPath + '/view/templates/flickr/main.jade');
            var sync = jade.renderFile(global.libPath + '/view/templates/sync/main.jade');


            $('aside').append(aside);

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
                    tmp = allowed[i];
                    if (tmp != type) {
                        this.parent[tmp].view.hide("drop", {direction: "up"}, "slow");
                    }
                }
                current.view.show("drop", {direction: "down"}, "slow");
            } else {
                for (i; i < allowed.length; i++) {
                    tmp = allowed[i];
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
        onFlicker: function () {
            var local = this.changeView('flickr');
            local.folder.on('navigate', this.parent.flickr.onNavigate);
            local.addressBar.on('navigate', this.parent.flickr.onNavigate);
            local.navigateCollections();
        },
        onSync: function () {
            this.changeView('sync');
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
        /**
         * @type LocalFolder|null
         */
        folder: null,
        folderPath: null,
        /**
         * @type LocalAddressBar| null
         */
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
        /**
         * @type null|string
         */
        flickrUserId: null,
        foundCollections: [],
        foundPhotoSets: {},
        /**
         * @type DfiSync
         */
        parent: null,
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
                    if (err) {
                        throw err;
                    }
                    //noinspection JSPotentiallyInvalidUsageOfThis
                    this.flickrUserId = decodeURIComponent(this.parent.configuration.getConfig().flickr.userNsId);

                    //noinspection JSPotentiallyInvalidUsageOfThis
                    this.foundCollections = response.collections[0].collection;
                    //noinspection JSPotentiallyInvalidUsageOfThis
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
            if (this.foundPhotoSets.hasOwnProperty(id) && this.foundPhotoSets[id].hasOwnProperty('photos')) {
                this.folder.open(this.foundPhotoSets[id].photos, 'photoset');
            } else {
                var opt = {method: 'flickr.photosets.getPhotos', photoset_id: e.id, user_id: this.flickrUserId};
                DfiFlicker(opt, this.parent.configuration.conf, onFlickrPhotoSetResponse, this);

                /**
                 * @param err
                 * @param {{photoset:Array}} response
                 */
                function onFlickrPhotoSetResponse(err, response) {
                    if (err) {
                        throw err;
                    }
                    //noinspection JSPotentiallyInvalidUsageOfThis
                    if (this.foundPhotoSets.hasOwnProperty(id)) {
                        //noinspection JSPotentiallyInvalidUsageOfThis
                        this.foundPhotoSets[id].photos = response.photoset[0].photo;
                    }
                    //noinspection JSPotentiallyInvalidUsageOfThis
                    this.folder.open(response.photoset[0].photo, 'photoset');
                }
            }
        },
        navigatePhoto: function (data) {
            var opt = {method: 'flickr.photos.getSizes', photo_id: data.id};
            DfiFlicker(opt, this.parent.configuration.conf, onFlickerGetSizes, this);

            /**
             *
             * @param err
             * @param {{sizes:Array}} resp
             */
            function onFlickerGetSizes(err, resp) {
                if (err) {
                    throw err;
                }
                //noinspection JSPotentiallyInvalidUsageOfThis
                var self = this.parent;
                /**
                 * @type {NWGui}
                 */
                var gui = self.gui;

                //noinspection JSPotentiallyInvalidUsageOfThis
                /**
                 * @type {{work_area}}
                 */
                var screen = this.parent.configuration.determineCurrentScreen();

                var current = gui.Window.get();
                var currentW = current.window;

                var found = {};
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
                };

                var new_win = gui.Window.open(url, opt);
                new_win.on('loaded', function () {

                });
                new_win.on('closed', function () {
                    currentW.focus();
                });
                /*
                 close
                 closed
                 */

                //  }, 100);
            }
        },
        findPhotoSetThumbnails: function (tmp) {
            tmp.forEach(function (value) {
                var id = value['$'].id;
                if (this.foundPhotoSets.hasOwnProperty(id)) {
                    setImage.call(this, this.foundPhotoSets[id]);
                } else {
                    var opt = {
                        method: 'flickr.photosets.getInfo',
                        photoset_id: id
                    };
                    DfiFlicker(opt, this.parent.configuration.conf, onFlickrPhotosetResponse, this);
                }
            }, this);

            function onFlickrPhotosetResponse(err, resp) {
                if (err) {
                    throw err;
                }
                if (resp.hasOwnProperty('photoset')) {
                    this.foundPhotoSets[resp.photoset[0]['$'].id] = resp.photoset[0];
                    setImage.call(this, resp.photoset[0]);
                } else {
                    //noinspection JSUnusedLocalSymbols
                    var x = 1;
                }
            }

            function setImage(data) {
                var url = buildUrl(data['$']);
                this.view.find(' .files div[data-id=' + data['$'].id + ']').find('img.imgThumbC').attr('src', url)
            }

            function buildUrl(data) {
                return 'https://farm' + data.farm + '.staticflickr.com/' + data.server + '/' + data.primary + '_' + data.secret + '_s.jpg';
            }

        }
    },
    sync: {
        /**
         * @type null|DfiSync
         */
        parent: null,
        view: null,
        localTree: {},
        flickerTree: {},
        treesLoaded: false,
        init: function (parent) {
            this.parent = parent;
            this.view = $('#syncView');
            $('#getTrees').click(this.getTrees.bind(this));
            $('#sync').click(this.onSync.bind(this));
            $('#compare').click(this.onCompare.bind(this));
        },
        onCompare: function () {

            if (this.treesLoaded) {
                doCompare();
            } else {
                this.getTrees(function () {
                    doCompare();
                }, this)
            }

            function doCompare() {
                try {

                    var dataLocal = $('#dataLocal');
                    var dataFlickr = $('#dataFlickr');

                    var localTree = dataLocal.find('.data').fancytree('getTree');
                    var flickrTree = dataFlickr.find('.data').fancytree('getTree');
                    //noinspection JSMismatchedCollectionQueryUpdate
                    /**
                     * @type Array
                     */
                    var local = localTree.toDict();
                    /**
                     * @type Array
                     */
                    var flickr = flickrTree.toDict();


                    function hasItem(dict, title) {
                        var result = $.grep(dict, function (e) {
                            return e.title == title;
                        });
                        return result.length > 0;
                    }

                    function getItemKey(dict, title) {
                        var result = $.grep(dict, function (e) {
                            return e.title == title;
                        });
                        if (result.length > 1) {
                            //noinspection JSUnusedLocalSymbols
                            var x = 1;
                        }
                        return dict.indexOf(result[0])
                    }

                    function markAdd(key) {
                        var node = localTree.getNodeByKey(key);
                        node.setSelected(true);
                        if (node.extraClasses == undefined) {
                            node.extraClasses = 'fAdd';
                        } else {
                            node.extraClasses += ' fAdd';
                        }
                        $(node.span).addClass('fAdd');
                        if (node.hasChildren()) {
                            node.getChildren().forEach(function (item) {
                                markAdd(item.key);
                            })
                        }
                    }

                    function markError(key) {
                        var node = localTree.getNodeByKey(key);
                        node.setSelected(false);
                        if (node.extraClasses == undefined) {
                            node.extraClasses = 'fError';
                        } else {
                            node.extraClasses += ' fError';
                        }
                        $(node.span).addClass('fError');
                        if (node.hasChildren()) {
                            node.getChildren().forEach(function (item) {
                                markError(item.key);

                            })
                        }
                    }

                    local.forEach(function (lCollection, compareKey) {
                        setTimeout(function () {
                            if (!hasItem(flickr, lCollection.title)) {
                                //mark green
                                //node.setExtraClasses('green')
                                markAdd(lCollection.key)

                            } else {
                                if (lCollection.hasOwnProperty('children') && lCollection.children.length > 0) {
                                    var fCollectionKey = getItemKey(flickr, lCollection.title);
                                    if (-1 != fCollectionKey && flickr[fCollectionKey].hasOwnProperty('data') && flickr[fCollectionKey].data.hasOwnProperty('collectionId')) {
                                        localTree.getNodeByKey(lCollection.key).data.fCollectionId = flickr[fCollectionKey].data.collectionId;
                                    }
                                    lCollection.children.forEach(function (lPhotoset) {
                                        setTimeout(function () {
                                            if (!lPhotoset.hasOwnProperty('folder')) {
                                                markError(lPhotoset.key)
                                            } else if (flickr[fCollectionKey].hasOwnProperty('children')) {
                                                if (!hasItem(flickr[fCollectionKey].children, lPhotoset.title)) {
                                                    //mark green
                                                    markAdd(lPhotoset.key)
                                                } else {

                                                    if (lPhotoset.hasOwnProperty('children') && lPhotoset.children.length > 0) {
                                                        var fPhotoSetKey = getItemKey(flickr[fCollectionKey].children, lPhotoset.title);
                                                        if (-1 != fPhotoSetKey && flickr[fCollectionKey].children[fPhotoSetKey].hasOwnProperty('data') && flickr[fCollectionKey].children[fPhotoSetKey].data.hasOwnProperty('photoSetId')) {
                                                            localTree.getNodeByKey(lPhotoset.key).data.fPhotoSetId = flickr[fCollectionKey].children[fPhotoSetKey].data.photoSetId;
                                                        }
                                                        lPhotoset.children.forEach(function (lPhoto) {

                                                            try {

                                                                if (flickr[fCollectionKey].hasOwnProperty('children')
                                                                    && flickr[fCollectionKey].children[fPhotoSetKey].hasOwnProperty('children')
                                                                    && (!hasItem(flickr[fCollectionKey].children[fPhotoSetKey].children, lPhoto.title))) {
                                                                    //mark green
                                                                    markAdd(lPhoto.key)
                                                                } else {
                                                                    //noinspection JSUnusedLocalSymbols
                                                                    var x = 1;
                                                                }
                                                            } catch (e) {
                                                                throw e;
                                                            }

                                                        });

                                                    } else {
                                                        //noinspection JSUnusedLocalSymbols
                                                        var x = 1;
                                                    }
                                                }
                                            } else {
                                                //noinspection JSUnusedLocalSymbols
                                                markAdd(lPhotoset.key);
                                            }
                                        }, 100)
                                    });
                                }
                            }
                            if (compareKey == local.length - 1) {
                                var btn = DfiSync.sync.view.find('#sync');
                                btn.removeClass('disabled');
                            }
                        }, 100);
                    }, this);
                } catch (e) {
                    //noinspection JSUnusedLocalSymbols
                    var x = 1;
                    throw e;
                }
            }

        },
        onSync: function () {
            var opt = {method: 'flickr.people.getUploadStatus'};
            DfiFlicker(opt, this.parent.configuration.conf, onFlickrUploadStatus, this);

            function onFlickrUploadStatus(err, response) {
                if (err) {
                    throw err;
                }


                var dataLocal = $('#dataLocal');
                var localTree = dataLocal.find('.data').fancytree('getTree');
                var selected = localTree.getSelectedNodes();

                window.alert(selected.length);
                if (selected.length < 100) {
                    selected.forEach(onNode, this);
                }
            }

            /**
             * @param {FancytreeNode} node
             */
            function onNode(node) {
                if (node.extraClasses != undefined && -1 !== node.extraClasses.indexOf('fAdd')) {
                    switch (node.data.level) {
                        case 1 :
                            addCollection.call(this, node);
                            break;
                        case 2 :
                            addPhotoSet.call(this, node);
                            break;
                        case 3 :
                            //addPhoto.call(this, node);
                            break;
                    }


                } else {
                    //skip not to add (auto select parent)
                }
            }

            /**
             * @param {FancytreeNode} node
             */
            function addCollection(node) {
                //noinspection JSUnusedLocalSymbols
                var x = 1;
            }

            /**
             * @param {FancytreeNode} node
             */
            function addPhotoSet(node, callback, thisp) {
                //noinspection JSUnusedLocalSymbols
                //var placeholderId = DfiSync.configuration.getConfig().flickr.photosetPlaceholderId;

                function findPlaceholderId() {

                    var placeholderId;


                    function getItemKey(dict, title) {
                        var result = $.grep(dict, function (e) {
                            return e.title == title;
                        });
                        if (result.length > 1) {
                            //noinspection JSUnusedLocalSymbols
                            var x = 1;
                        }
                        return dict.indexOf(result[0])
                    }

                    var colId = getItemKey(this.flickerTree, 'placeholder');
                    var psId = getItemKey(this.flickerTree[colId].children, 'placeholder');

                    var placeholderId = this.flickerTree[colId].children[psId].children[0].id;
                    onPlaceholder.call(this,placeholderId);
                }

                function onPlaceholder(placeholderId) {
                    var opt = {
                        method: 'upload',
                        title: node.data.title,
                        primary_photo_id: placeholderId
                    };
                    DfiFlicker(opt, this.parent.configuration.conf, function (err, response) {
                        if (typeof callback == "function") {
                            callback.call(thisp, err);
                        }
                    }, this);
                }

                findPlaceholderId.call(this, onPlaceholder);
            }

            /**
             * @param {FancytreeNode} node
             * @param {function} [callback]
             * @param {*} [thisp]
             */
            function addPhoto(node, callback, thisp) {
                function assignToPhotoSet(err, response) {

                    var opt = {
                        method: 'flickr.photosets.addPhoto',
                        photoset_id: '(Required)',
                        photo_id: response.photoid[0]
                    };
                    if (node.parent.data.hasOwnProperty('fPhotoSetId')) {
                        opt.photoset_id = node.parent.data.fPhotoSetId;
                    } else {
                        var x = 1;
                    }
                    //noinspection JSPotentiallyInvalidUsageOfThis
                    DfiFlicker(opt, this.parent.configuration.conf, function (err, response) {
                        if (typeof callback == "function") {
                            callback.call(thisp, err);
                        }
                    }, this);
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

                var fullPath = node.data.path;

                var opt = {
                    method: 'upload',
                    photo: fs.createReadStream(fullPath),
                    title: node.title,
                    is_public: 0,
                    is_friend: 0,
                    is_family: 0,
                    safety_level: 1,
                    content_type: 1,
                    hidden: 2
                };

                DfiFlicker(opt, this.parent.configuration.conf, assignToPhotoSet, this);
            }

        },
        /**
         *
         * @param callback
         * @param thisp
         */
        getTrees: function (callback, thisp) {
            if (this.treesLoaded) {
                setTimeout(function () {
                    callback.call(thisp);
                }, 500);
            } else {


                var dataLocal = $('#dataLocal');
                var dataFlickr = $('#dataFlickr');

                var readyFlickr = false;
                var readyLocal = false;


                var localViewAddress = this.parent.local.view.find('.addressbar');

                var localPath = localViewAddress.find('li.active').data('path');
                dataLocal.find('.addressbar').html(localPath).append('<i class="fa fa-refresh fa-spin pull-right"></i><span class="counter pull-right">0</span>');
                dataFlickr.find('.addressbar').html('collections').append('<i class="fa fa-refresh fa-spin pull-right"></i>');

                function onLocalTree(err, results) {
                    if (err) {
                        throw err;
                    }
                    var treeOpt = {
                        source: results,
                        checkbox: true,
                        selectMode: 3
                    };
                    dataLocal.find('.addressbar').find('.counter').remove();
                    dataLocal.find('.addressbar i.fa.fa-refresh.fa-spin').remove();
                    dataLocal.find('.data').fancytree(treeOpt);

                    dataLocal.find('.ui-fancytree').addClass('flex-grow');

                    readyLocal = true;
                    checkLoaded.call(this);
                }

                function updateLocalCounter(value) {
                    var elem = dataLocal.find('.addressbar').find('.counter');
                    var current = parseInt(elem.html());
                    elem.html(value + current);
                }

                function onFlickrTree(err, results) {
                    if (err) {
                        throw err;
                    }
                    var treeOpt = {
                        source: results,
                        checkbox: true,
                        selectMode: 3
                    };
                    dataFlickr.find('.addressbar i.fa.fa-refresh.fa-spin').remove();
                    dataFlickr.find('.data').fancytree(treeOpt);

                    dataFlickr.find('.ui-fancytree').addClass('flex-grow');
                    readyFlickr = true;
                    checkLoaded.call(this);
                }

                function checkLoaded() {
                    if (!(readyFlickr && readyLocal)) {
                        return
                    }
                    //noinspection JSPotentiallyInvalidUsageOfThis
                    this.treesLoaded = true;

                    var btn = this.view.find('#compare');
                    btn.removeClass('disabled');

                    if (typeof  callback == "function") {

                        setTimeout(function () {
                            callback.call(thisp);
                        }, 500);
                    }
                }

                this.getLocalTree(localPath, updateLocalCounter, onLocalTree, this);
                this.getFlickrTree(onFlickrTree, this);
            }
        },
        /**
         * @param {string} localPath
         * @param {function(value:number)} counter
         * @param {function(err:Error,results:{title:string,data:{level:number}}[])} callback
         * @param {*} [thisp]
         */
        getLocalTree: function (localPath, counter, callback, thisp) {
            var level = 1;

            function walk(dir, level, done) {
                var results = [];
                fs.readdir(dir, function (err, list) {
                    if (err) {
                        return done(err);
                    }
                    var pending = list.length;
                    counter(list.length);
                    if (!pending) {
                        return done(null, results);
                    }
                    list.forEach(function (file) {
                        var filePath = path.resolve(dir, file);
                        fs.stat(filePath, function (err, stat) {
                            var localRes = {
                                title: file,
                                data: {
                                    level: level,
                                    path: filePath
                                }
                            };
                            if (stat && stat.isDirectory()) {
                                localRes['folder'] = true;
                                localRes['children'] = [];

                                results.push(localRes);
                                walk(filePath, level + 1, function (err, res) {
                                    if (err) {
                                        throw err;
                                    }
                                    localRes.children = res;
                                    res.sort(sortByTitle);
                                    counter(-1);
                                    if (!--pending) {
                                        done(null, results);
                                    }
                                });
                            } else {
                                results.push(localRes);
                                counter(-1);
                                if (!--pending) {
                                    done(null, results);
                                }
                            }
                        });
                    });
                });
            }

            function sortByTitle(a, b) {
                var keyA = a.title,
                    keyB = b.title;
                if (keyA < keyB) return -1;
                if (keyA > keyB) return 1;
                return 0;
            }

            walk(localPath, level, function (err, results) {
                if (err) {
                    throw err;
                }
                results.sort(sortByTitle);
                this.localTree = results;
                callback.call(thisp, null, results);
            });


        },
        getFlickrTree: function (callback, thisp) {

            var results = [];
            var collections = this.parent.flickr.foundCollections;

            if (collections.length > 0) {
                onFlickrCollections.call(this, collections);
            } else {
                var opt = {method: 'flickr.collections.getTree'};
                DfiFlicker(opt, this.parent.configuration.conf, onFlickrCollectionsResponse, this);

                function onFlickrCollectionsResponse(err, response) {
                    if (err) {
                        throw err;
                    }
                    collections = response.collections[0].collection;
                    onFlickrCollections.call(this, collections);
                }
            }

            function onTreeReady(results) {
                this.flickerTree = results;
                callback.call(thisp, null, results);
            }

            function onFlickrCollections(collections) {
                //noinspection JSPotentiallyInvalidUsageOfThis
                var flickrUserId = decodeURIComponent(this.parent.configuration.getConfig().flickr.userNsId);
                var pending = collections.length;

                function sort(a, b) {
                    var keyA = a.title,
                        keyB = b.title;
                    // Compare the 2 dates
                    if (keyA < keyB) return -1;
                    if (keyA > keyB) return 1;
                    return 0;
                }


                collections.forEach(function (collection) {
                    var item;
                    if (collection.hasOwnProperty('set')) {
                        item = {
                            title: collection['$'].title,
                            folder: true,
                            children: [],
                            data: {
                                collectionId: collection['$'].id
                            }
                        };
                        results.push(item);
                        pending += collection.set.length;
                        collection.set.forEach(function (photoSet) {
                            var itemSet = {
                                title: photoSet['$'].title,
                                folder: true,
                                children: [],
                                data: {
                                    photoSetId: photoSet['$'].id
                                }
                            };
                            item.children.push(itemSet);

                            pending++;
                            var opt = {
                                method: 'flickr.photosets.getPhotos',
                                photoset_id: photoSet['$'].id,
                                user_id: flickrUserId
                            };
                            DfiFlicker(opt, this.parent.configuration.conf, onFlickrPhotoSetResponse, this);

                            function onFlickrPhotoSetResponse(err, response) {
                                if (err) {
                                    throw err;
                                }

                                response.photoset[0].photo.forEach(function (photo) {
                                    var itemPhoto = {
                                        title: photo['$'].title,
                                        id: photo['$'].id
                                    };
                                    itemSet.children.push(itemPhoto);
                                }, this);

                                itemSet.children.sort(sort);
                                if (!--pending) {
                                    onTreeReady.call(this, results)
                                }
                            }

                            if (!--pending) {
                                onTreeReady.call(this, results)
                            }
                        }, this);

                        item.children.sort(sort);

                        if (!--pending) {
                            onTreeReady.call(this, results)
                        }
                    } else {
                        item = {title: collection['$'].title};
                        results.push(item);
                        if (!--pending) {
                            onTreeReady.call(this, results)
                        }
                    }
                }, this);
                results.sort(sort);
            }
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
        /**
         * @returns {*|{app: {folder: string, useAnimation: boolean}, flickr: {consumerKey: string, consumerKeySecret: string, oauthToken: string, oauthTokenSecret: string, oauthVerifier: string, userNsId: string, userName: string, fullName: string, oAccessAuthToken: string, oAccessAuthTokenSecret: string}}}
         */
        getConfig: function () {
            if (typeof this.conf == "object") {
                return this.conf.getConfig();
            }
        },
        /**
         *
         * @returns {{work_area:{height:number,width:number}}
         */
        determineCurrentScreen: function () {
            /**
             * @type {NWGui}
             */
            var gui = this.parent.gui;
            if (typeof gui.Screen.Init == "function") {
                gui.Screen.Init();
            }
            var screens = gui.Screen.screens;
            var currentWindow = gui.Window.get();
            var x = currentWindow.x;
            /*var y = currentWindow.y;*/

            /* var width = currentWindow.width;
             var height = currentWindow.height;*/

            if (x < screens[0].bounds.width) {
                return screens[0]
            } else {
                return screens[1]
            }
        }

    }

};
if (typeof module != "undefined") {
    module.exports = DfiSync;
}