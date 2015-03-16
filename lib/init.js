/**
 * Created by dafi on 15.03.15.
 */

global.appRoot = process.cwd();


console.log(global.appRoot);

(function(){
    var i = 0;
    exports.callback0 = function () {
        console.log(i + ": " + window.location);
        window.alert ("i = " + i);
        i = i + 1;
    }
})();