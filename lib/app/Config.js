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
    /**
     * @returns {{app:{folder:string,useAnimation:boolean},flickr:{consumerKey:string,consumerKeySecret:string,oauthToken:string,oauthTokenSecret:string,oauthVerifier:string,userNsId:string,userName:string,fullName:string,oAccessAuthToken:string,oAccessAuthTokenSecret:string}}}
     */
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