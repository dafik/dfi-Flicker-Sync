var $ = require('jquery');
var jade = require('jade');
var fs = require('fs');
var path = require('path');

var Configuration = require(global.libPath + '/app/Config');
var LocalAddressBar = require(global.libPath + '/app/local/LocalAddressBar');
var LocalFolder = require(global.libPath + '/app/local/LocalFolder');
var FlickerAddressBar = require(global.libPath + '/app/flickr/FlickrAddressBar');
var FlickerFolder = require(global.libPath + '/app/flickr/FlickrFolder');

var Queue = require(global.libPath + '/app/queue/Queue');
var QueueItem = require(global.libPath + '/app/queue/Item');

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
            this.queue.init(this);

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
                var queue = jade.renderFile(global.libPath + '/view/templates/queue/main.jade');


                $('aside').append(aside);

                $('#localView').append(local);
                $('#flickrView').append(flickr);
                $('#syncView').append(sync);
                $('#queueView').append(queue);
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
                this.view.find('.queue-view').click(this.onQueue.bind(this));
                this.view.find('.conf-view').click(this.onConfig.bind(this));
                this.view.find('.about-view').click(this.onAbout.bind(this));


            },
            changeView: function (type) {
                var allowed = ['local', 'flickr', 'sync', 'queue'];
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
            onQueue: function () {
                this.changeView('queue');
                //local.folder.on('navigate', this.parent.flickr.onNavigate);
                //local.addressBar.on('navigate', this.parent.flickr.onNavigate);
                //local.navigateCollections();
            },
            onConfig: function () {
                alert('config')
            },
            onAbout: function () {
                alert('about')
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
            types: {
                collections: 'collections',
                collection: 'collection',
                album: 'album',
                photo: 'photo'
            },
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
            foundAlbums: {},
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
                if (e.type == this.types.collections) {
                    this.parent.navigateCollections();
                } else if (e.type == this.types.collection) {
                    this.parent.navigateCollection(e);
                } else if (e.type == this.types.album) {
                    this.parent.navigateAlbum(e)
                } else if (e.type == this.types.photo) {
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
                        this.flickrUserId = this.parent.configuration.getUserId();

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
                this.findAlbumThumbnail(found);
            },

            navigateAlbum: function (e) {
                var id = e.id;
                this.addressBar.enter(e);
                if (this.foundAlbums.hasOwnProperty(id) && this.foundAlbums[id].hasOwnProperty('photos')) {
                    this.folder.open(this.foundAlbums[id].photos, this.types.album);
                } else {
                    var opt = {
                        method: 'flickr.photosets.getPhotos',
                        photoset_id: e.id,
                        user_id: this.flickrUserId
                    };
                    DfiFlicker(opt, this.parent.configuration.conf, onFlickrAlbumResponse, this);

                    /**
                     * @param err
                     * @param {{photoset:Array}} response
                     */
                    function onFlickrAlbumResponse(err, response) {
                        if (err) {
                            throw err;
                        }
                        //noinspection JSPotentiallyInvalidUsageOfThis
                        if (this.foundAlbums.hasOwnProperty(id)) {
                            //noinspection JSPotentiallyInvalidUsageOfThis
                            this.foundAlbums[id].photos = response.photoset[0].photo;
                        }
                        //noinspection JSPotentiallyInvalidUsageOfThis
                        this.folder.open(response.photoset[0].photo, this.types.album);
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
            findAlbumThumbnail: function (tmp) {
                tmp.forEach(function (value) {
                    var id = value['$'].id;
                    if (this.foundAlbums.hasOwnProperty(id)) {
                        setImage.call(this, this.foundAlbums[id]);
                    } else {
                        var opt = {
                            method: 'flickr.photosets.getInfo',
                            photoset_id: id
                        };
                        DfiFlicker(opt, this.parent.configuration.conf, onFlickrAlbumResponse, this);
                    }
                }, this);

                function onFlickrAlbumResponse(err, resp) {
                    if (err) {
                        throw err;
                    }
                    if (resp.hasOwnProperty('photoset')) {
                        this.foundAlbums[resp.photoset[0]['$'].id] = resp.photoset[0];
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
            localPath: undefined,
            init: function (parent) {
                this.parent = parent;
                this.view = $('#syncView');
                $('#getTrees').click(this.getTrees.bind(this));
                $('#doCompare').click(this.onCompare.bind(this));
                $('#doQueue').click(this.onQueue.bind(this));

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
                            setTimeout(function () {
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
                            }, 0)
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
                                        lCollection.children.forEach(function (lAlbum) {
                                            setTimeout(function () {
                                                if (!lAlbum.hasOwnProperty('folder')) {
                                                    markError(lAlbum.key)
                                                } else if (flickr[fCollectionKey].hasOwnProperty('children')) {
                                                    if (!hasItem(flickr[fCollectionKey].children, lAlbum.title)) {
                                                        //mark green
                                                        markAdd(lAlbum.key)
                                                    } else {

                                                        if (lAlbum.hasOwnProperty('children') && lAlbum.children.length > 0) {
                                                            var fAlbumKey = getItemKey(flickr[fCollectionKey].children, lAlbum.title);
                                                            if (-1 != fAlbumKey && flickr[fCollectionKey].children[fAlbumKey].hasOwnProperty('data') && flickr[fCollectionKey].children[fAlbumKey].data.hasOwnProperty('albumId')) {
                                                                localTree.getNodeByKey(lAlbum.key).data.fAlbumId = flickr[fCollectionKey].children[fAlbumKey].data.albumId;
                                                            }
                                                            lAlbum.children.forEach(function (lPhoto) {

                                                                try {

                                                                    if (flickr[fCollectionKey].hasOwnProperty('children')
                                                                        && flickr[fCollectionKey].children[fAlbumKey].hasOwnProperty('children')
                                                                        && (!hasItem(flickr[fCollectionKey].children[fAlbumKey].children, lPhoto.title))) {
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
                                                    markAdd(lAlbum.key);
                                                }
                                            }, 100)
                                        });
                                    }
                                }
                                if (compareKey == local.length - 1) {
                                    var btn = DfiSync.sync.view.find('#doQueue');
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
            onQueue: function () {
                var that = this;

                this.findPlaceholder(onPlaceholderFound, this);

                function onPlaceholderFound(err, placeholderId) {
                    if (err) {
                        throw err;
                    }

                    var dataLocal = $('#dataLocal');
                    var localTree = dataLocal.find('.data').fancytree('getTree');
                    var selected = localTree.getSelectedNodes();

                    //window.alert(selected.length);

                    selected.forEach(onNode, that);

                    that.parent.aside.onQueue();


                    /**
                     * @param {FancytreeNode} node
                     */
                    function onNode(node) {
                        if (node.extraClasses != undefined && -1 !== node.extraClasses.indexOf('fAdd')) {
                            switch (node.data.level) {
                                case 1 :
                                    this.parent.queue.addCollection(node, (parentId || 0));
                                    break;
                                case 2 :
                                    this.parent.queue.addAlbum(node, placeholderId);
                                    break;
                                case 3 :
                                    this.parent.queue.addPhoto(node);
                                    break;
                            }


                        } else {
                            //skip not to add (auto select parent)
                        }
                    }

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
                    this.localPath = localPath;
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

                        var btn = this.view.find('#doCompare');
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
                                        path: filePath,
                                        ext: path.extname(filePath).substr(1).toLowerCase()
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
                                    if (localRes.data.ext == 'jpg') {
                                        results.push(localRes);
                                    }
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
                            collection.set.forEach(function (album) {
                                var itemSet = {
                                    title: album['$'].title,
                                    folder: true,
                                    children: [],
                                    data: {
                                        albumId: album['$'].id
                                    }
                                };
                                item.children.push(itemSet);

                                pending++;
                                var opt = {
                                    method: 'flickr.photosets.getPhotos',
                                    photoset_id: album['$'].id,
                                    user_id: flickrUserId
                                };
                                DfiFlicker(opt, this.parent.configuration.conf, onFlickrAlbumResponse, this);

                                function onFlickrAlbumResponse(err, response) {
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
            },
            findPlaceholder: function (callback, thisp) {
                var that = this;
                var step = 1;
                var placeholder = false;

                function checkInConfig() {

                    if (that.parent.configuration.getConfig().flickr.hasOwnProperty('albumPlaceholderId')) {
                        if (that.parent.configuration.getConfig().flickr.albumPlaceholderId) {
                            placeholder = that.parent.configuration.getConfig().flickr.albumPlaceholderId;
                        }
                    }
                    step = 2;
                    check.call(that, null, placeholder);
                }

                function checkInFlickr() {
                    //TODO

                    var opt = {
                        user_id: this.parent.configuration.getUserId(),
                        text: 'album_placeholder'
                    };


                    DfiFlicker(opt, this.parent.configuration.conf, onFlickrFoundPlaceholder, this);

                    function onFlickrFoundPlaceholder() {

                        step = 2;
                        check.call(that, null, placeholder);

                    }
                }

                function upload() {
                    //TODO
                    step = 2;
                    check.call(that, null, placeholder);
                }


                function check(err, placeholder) {
                    if (err) {
                        callback.call(thisp, err);
                        return;
                    }
                    if (placeholder) {
                        callback.call(thisp, null, placeholder);
                        return;
                    }

                    switch (step) {
                        case 1:
                            checkInConfig();
                            break;
                        case 2:
                            checkInFlickr();
                            break;
                        case 3:
                            upload();
                            break;
                    }
                }


                check(null, false);
            }
        },
        queue: {
            view: null,
            /**
             * @type null|Queue
             */
            queue: null,
            /**
             * @type null|DfiSync
             */
            parent: null,
            /**
             * @type function
             */
            itemTemplate: undefined,
            init: function (parent) {
                this.parent = parent;
                this.view = $('#queueView');
                this.queueCollections = new Queue();
                this.queueAlbums = new Queue();
                this.queuePhotos = new Queue();
                this.itemTemplate = jade.compileFile(global.libPath + '/view/templates/queue/item.jade');

                $('#start').click(this.start.bind(this));
                $('#stop').click(this.stop.bind(this));

                this.queueCollections.on('itemAdded', this.insertItem.bind(this));
                this.queueAlbums.on('itemAdded', this.insertItem.bind(this));
                this.queuePhotos.on('itemAdded', this.insertItem.bind(this));

                this.queueCollections.on('itemRemoved', this.removeItem.bind(this));
                this.queueAlbums.on('itemRemoved', this.removeItem.bind(this));
                this.queuePhotos.on('itemRemoved', this.removeItem.bind(this));
            },
            /**
             *
             * @param {QueueItem} data
             */
            insertItem: function (data) {
                var icon = 'fa-file';
                switch (data.type) {
                    case QueueItem.Types.collection:
                        icon = 'fa-cubes';
                        break;
                    case QueueItem.Types.album:
                        icon = 'fa-folder';
                        break;
                    case QueueItem.Types.photo:
                        icon = 'fa-picture-o';
                        break

                }
                var path = data.options.path || data.options.title;
                var tmp = this.itemTemplate({
                    title: path.replace(this.parent.sync.localPath, ''),
                    id: data.id,
                    icon: icon
                });
                //var li = $('<li data-id="' + data.id + '"><i class="fa fa-fw ' + icon + '"></i> ' + data.options.title + '</li>');
                var li = $(tmp);
                data.view = li;

                switch (data.type) {
                    case QueueItem.Types.collection:
                        this.view.find('ul.collections').append(li);

                        break;
                    case QueueItem.Types.album:
                        this.view.find('ul.albums').append(li);

                        break;
                    case QueueItem.Types.photo:
                        this.view.find('ul.photos').append(li);

                        break

                }
            },
            /**
             *
             * @param {QueueItem} data
             */
            removeItem: function (data) {
                data.view.remove();
                //this.view.find('li[data-id=' + data.id + ']').remove()
            },

            /**
             * @param {FancytreeNode} node
             * @param parentId
             */
            addCollection: function (node, parentId) {
                //noinspection JSUnusedLocalSymbols
                var x = 1;

                parentId = parentId || 0;

                var options = {
                    title: node.title,
                    parentId: parentId
                };
                var queueItem = new QueueItem(QueueItem.Types.collection, options);
                this.queueCollections.addItem(queueItem);

            },

            /**
             * @param {FancytreeNode} node
             * @param placeholderId
             */
            addAlbum: function (node, placeholderId) {
                var options = {
                    title: node.title,
                    placeholderId: placeholderId
                };
                if (node.parent.data.hasOwnProperty('fCollectionId')) {
                    function implemented() {
                        return node.parent.data.fCollectionId;
                    }

                    node.parent.onCollectionId = implemented;
                    options.fCollectionId = function () {
                        return node.parent.onCollectionId();
                    }
                } else {
                    function notImplemented() {
                        alert('not implemented');
                    }

                    node.parent.onCollectionId = notImplemented;
                    options.fCollectionId = function () {
                        return node.parent.onCollectionId();
                    }
                }
                var queueItem = new QueueItem(QueueItem.Types.album, options);
                this.queueAlbums.addItem(queueItem);
            },

            /**
             * @param {FancytreeNode} node
             */
            addPhoto: function (node) {
                var options = {
                    title: node.title,
                    path: node.data.path
                };
                if (node.parent.data.hasOwnProperty('fAlbumId')) {
                    function implemented() {
                        return node.parent.data.fAlbumId;
                    }

                    node.parent.onAlbumId = implemented;
                    options.fAlbumId = function () {
                        return node.parent.onAlbumId();
                    }
                } else {
                    function notImplemented() {
                        alert('not implemented');
                    }

                    node.parent.onCollectionId = notImplemented;
                    options.fAlbumId = function () {
                        return node.parent.onAlbumId();
                    }
                }
                var queueItem = new QueueItem(QueueItem.Types.photo, options);
                this.queuePhotos.addItem(queueItem);
            },
            start: function () {

                var that = this;


                function startCollections() {
                    console.log('starting collections');
                    that.queueCollections.on(Queue.Events.finish, startAlbums);
                    that.queueCollections.start();
                }

                function startAlbums() {
                    console.log('starting albums');
                    that.queueAlbums.on(Queue.Events.finish, startPhotos);
                    that.queueAlbums.start()
                }

                function startPhotos() {
                    console.log('starting photos');
                    that.queuePhotos.start();
                }

                startCollections();
            },
            stop: function () {

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
            }

            ,
            /**
             * @returns {*|{app: {folder: string, useAnimation: boolean}, flickr: {consumerKey: string, consumerKeySecret: string, oauthToken: string, oauthTokenSecret: string, oauthVerifier: string, userNsId: string, userName: string, fullName: string, oAccessAuthToken: string, oAccessAuthTokenSecret: string,albumPlaceholderId:string}}}
             */
            getConfig: function () {
                if (typeof this.conf == "object") {
                    return this.conf.getConfig();
                }
            }
            ,
            getUserId: function () {
                if (this.parent.flickrUserId == null) {
                    this.parent.flickrUserId = decodeURIComponent(this.getConfig().flickr.userNsId);
                }
                return this.parent.flickrUserId;
            }
            ,
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

    }
    ;
if (typeof module != "undefined") {
    module.exports = DfiSync;
}