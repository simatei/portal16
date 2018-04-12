'use strict';

let buildConfig = require('../config/build');
let config = require('../config/config');
let translationBuilder = require('./translations/builder');
let fs = require('fs');
let path = require('path');
let _ = require('lodash');
let dir = buildConfig.paths.root + '/locales/_build/';
ensureDirectoryExistence(dir + 'translation.json');

let enJson = translationBuilder('en');

config.locales.forEach(function(locale) {
    if (locale === 'de-CH') return;
    let localeJson = translationBuilder(locale);
    let mergedJson = _.merge({}, enJson, localeJson);
    fs.writeFile(dir + locale + '.json', JSON.stringify(mergedJson, null, 2), function(err) {
        if (err) {
            console.log(err);
            throw err;
        }
        console.log('Translation files was succesfully build');
    });
});

function ensureDirectoryExistence(filePath) {
    let dirname = path.dirname(filePath);
    if (fs.existsSync(dirname)) {
        return true;
    }
    ensureDirectoryExistence(dirname);
    fs.mkdirSync(dirname);
}
