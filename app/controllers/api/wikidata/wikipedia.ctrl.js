'use strict';
let express = require('express'),
    router = express.Router(),
    _ = require('lodash'),
    apiConfig = require('../../../models/gbifdata/apiConfig'),
    request = require('request-promise'),
    log = require('../../../../config/log'),
    RULES = require('./wikipediaRules');

function getLocalizedEndpoint(locale, name) {
    return `https://${locale}.wikipedia.org/api/rest_v1/page/summary/${name}`;
}

module.exports = function(app) {
    app.use('/api', router);
};

router.get('/wikipedia/page/:speciesKey/summary', function(req, res) {
      return getWikipediaSummary(req, res)
        .then((response) => {
            return res.status(200).json(response);
        })
        .catch(function(err) {
            log.error(err);
            let status =
                err.message === 'not found'
                    ? 404
                    : err.statusCode
                    ? err.statusCode
                    : 500;
            res.sendStatus(status);
        });
});

const getWikipediaSummary = async (req, res) => {
    const locale = _.get(req, 'query.locale');
    const species = await request({
        url: apiConfig.taxon.url + req.params.speciesKey,
        json: true
    });

    let name = species.canonicalName.replace(/\s/g, '_');

    if (RULES.HOMONYMS[name]) {
        if (!RULES.HOMONYMS[name][species.kingdom]) {
            throw new Error('not found');
        } else {
            name = RULES.HOMONYMS[name][species.kingdom];
        }
    }

    try {
        const response = await request({
            url: getLocalizedEndpoint(locale, name),
            json: true
        });
        if (response.type === 'disambiguation') {
            throw new Error('disambiguation');
        }
        return {
            [locale]: _.merge(_.pick(response, ['extract', 'extract_html', 'thumbnail', 'title', 'displaytitle']), {link: `https://${locale}.wikipedia.org/wiki/${name}`})
        };
    } catch (err) {
        if (err.statusCode === 404 && locale !== 'en') {
            const response = await request({
                url: getLocalizedEndpoint('en', name),
                json: true
            });

             return {
                [locale]: null,
                en: _.merge(_.pick(response, ['extract', 'extract_html', 'thumbnail', 'title', 'displaytitle']), {link: `https://en.wikipedia.org/wiki/${name}`})
            };
        } else if (err.message === 'disambiguation') {
            const response = await request({
                url: `https://en.wikipedia.org/api/rest_v1/page/mobile-sections/${name}`,
                json: true
            });
            const taxonomySection = _.find(response.remaining.sections, function(s) {
                return s.line === 'Taxonomy';
            });
            if (!taxonomySection) {
                throw new Error('not found');
            }
            const taxonmyTextWithReplacedLinks = taxonomySection.text.replace(/\/wiki\//g, 'https://en.wikipedia.org/wiki/');
            const extractHtml = _.get(response, 'lead.sections[0].text') ? _.get(response, 'lead.sections[0].text') + taxonmyTextWithReplacedLinks : taxonmyTextWithReplacedLinks;

            return {
                en: {
                    type: 'disambiguation',
                    extract_html: extractHtml,
                    displaytitle: response.title,
                    title: response.title
                }
            };
        } else {
            throw err;
        }
    }
};

