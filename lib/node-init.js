/**
 * Created by dafi on 15.03.15.
 */

/**
 * @typedef {string} global.appRoot
 */
global.appRoot = process.cwd();
/**
 * @typedef {string} global.libPath
 */
global.libPath = global.appRoot + '/lib';

console.log('node init');
console.log(global.appRoot);

