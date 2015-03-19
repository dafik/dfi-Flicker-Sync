var fs = require('fs'),
    ini = require('ini');


function Config() {
    var location = process.cwd() + '/appConfig.ini';

    if (!fs.existsSync(location)) {
        var handle = fs.openSync(location, 'wx+');
        var defaults = {
            app: {
                folder: process.cwd()
            }
        };
        fs.writeSync(handle, ini.stringify(defaults));
        fs.closeSync(handle);
    }
    this.getConfig = function () {

        if (typeof this.config == "undefined") {
            this.config = ini.parse(fs.readFileSync(location, 'utf-8'))
        }
        return this.config
    };
    this.writeConfig = function () {

        fs.writeFileSync(location, ini.stringify(this.config))
    }
}

module.exports = Config;