'use strict';

var angular = require('angular'),
    mapController = require('./map'),
    ol = require('openlayers'),
    utils = require('../../../shared/layout/html/utils/utils'),
//globeCreator = require('./globe'),
    _ = require('lodash');

angular
    .module('portal')
    .directive('mapWidget', mapWidgetDirective);

/** @ngInject */
function mapWidgetDirective(BUILD_VERSION) {
    var directive = {
        restrict: 'E',
        transclude: true,
        templateUrl: '/templates/components/map/mapWidget/mapWidget.html?v=' + BUILD_VERSION,
        scope: {
            filter: '=',
            mapStyle: '='
        },
        link: mapLink,
        controller: mapWidget,
        controllerAs: 'vm',
        bindToController: true
    };

    return directive;

    /** @ngInject */
    function mapLink(scope, element) {//, attrs, ctrl
        scope.create(element);
    }

    /** @ngInject */
    function mapWidget($state, $scope, $timeout, enums, $httpParamSerializer, MapCapabilities, $localStorage) {
        var vm = this;
        vm.styleBreaks = {
            breakpoints: [0, 700],
            classes: ['isSmall', 'isLarge']
        };
        vm.projections = {
            ARCTIC: 'EPSG_3575',
            MERCATOR: 'EPSG_3857',
            PLATE_CAREE: 'EPSG_4326',
            ANTARCTIC: 'EPSG_3031'
        };
        vm.activeProjection = vm.projections.PLATE_CAREE;
        vm.activeControl = undefined;
        vm.controls = {
            OCCURRENCES: 1,
            PROJECTION: 10,
            BOR: 11,
            STYLE: 12,
            YEAR: 13,
            FILTERS: 14
        };

        vm.basemaps = [
            {
                name: 'classic',
                query: {style: 'gbif-classic'}
            },
            {
                name: 'light',
                query: {style: 'gbif-light'}
            },
            {
                name: 'dark',
                query: {style: 'gbif-dark'}
            },
            {
                name: 'roads',
                query: {style: 'osm-bright'}
            }
        ];
        vm.selectedBaseMap = vm.basemaps[0];
        vm.binningOptions = [
            {
                name: 'PIXEL',
                query: {},
                type: 'POINT'
            },
            {
                name: 'SMALL_HEX',
                query: {bin: 'hex', hexPerTile: 79},
                type: 'POLY'
            },
            {
                name: 'LARGE_HEX',
                query: {bin: 'hex', hexPerTile: 17},
                type: 'POLY'
            },
            {
                name: 'SMALL_SQUARE',
                query: {bin: 'square', squareSize: 64},
                type: 'POLY'
            },
            {
                name: 'LARGE_SQUARE',
                query: {bin: 'square', squareSize: 256},
                type: 'POLY'
            }
        ];
        vm.selectedBinning = vm.binningOptions[0];
        vm.colorOptions = [
            {
                name: 'classic',
                query: ['classic.point'],
                type: 'POINT'
            },
            {
                name: 'fire',
                query: ['fire.point'],
                type: 'POINT'
            },
            {
                name: 'glacier',
                query: ['glacier.point'],
                type: 'POINT'
            },
            {
                name: 'purpleYellow',
                query: ['purpleYellow.point'],
                type: 'POINT'
            },
            {
                name: 'blueHeat',
                query: ['blueHeat.point'],
                type: 'POINT'
            },
            {
                name: 'orangeHeat',
                query: ['orangeHeat.point'],
                type: 'POINT'
            },
            {
                name: 'green',
                query: ['green2.point'],
                type: 'POINT'
            },
            {
                name: 'classic',
                query: ['classic.poly'],
                type: 'POLY'
            },
            {
                name: 'purpleYellow',
                query: ['purpleYellow.poly'],
                type: 'POLY'
            },
            {
                name: 'blueCluster',
                query: ['outline.poly', 'blue.marker'],
                type: 'POLY'
            },
            {
                name: 'green',
                query: ['green2.poly'],
                type: 'POLY'
            }
        ];
        vm.selectedColor = vm.colorOptions[0];

        vm.predefinedStyles = {
            CLASSIC_HEX: {
                baseMap: {style: 'gbif-classic'},
                overlay: [{style: 'classic.poly', bin: 'hex', hexPerTile: 70}],
                background: '#272727'
            },
            CLASSIC: {
                baseMap: {style: 'gbif-classic'},
                overlay: [],
                background: '#02393d'
            },
            ORANGE_DOTS: {
                baseMap: {style: 'gbif-light'},
                overlay: [{style: 'outline.poly', bin: 'hex', hexPerTile: 15}, {
                    style: 'orange.marker',
                    bin: 'hex',
                    hexPerTile: 15
                }],
                background: '#e0e0e0'
            },
            OSM: {
                baseMap: {style: 'osm-bright'},
                overlay: [{style: 'outline.poly', bin: 'hex', hexPerTile: 15}, {
                    style: 'orange.marker',
                    bin: 'hex',
                    hexPerTile: 15
                }],
                background: '#e0e0e0'
            },
            GREEN: {
                baseMap: {style: 'gbif-light'},
                overlay: [{style: 'green2.poly', bin: 'hex', hexPerTile: 40}],
                background: '#e0e0e0'
            },
            DARK: {
                baseMap: {style: 'gbif-dark'},
                overlay: [{style: 'classic.poly', bin: 'hex', hexPerTile: 70}],
                background: '#272727'
            }
        };

        vm.customMap = $localStorage.customMap;
        if (vm.customMap) {
            vm.selectedBinning = _.find(vm.binningOptions, {name: vm.customMap.binning.name, type: vm.customMap.binning.type});
            vm.selectedColor = _.find(vm.colorOptions, {name: vm.customMap.color.name, type: vm.customMap.color.type});
            vm.selectedBaseMap = _.find(vm.basemaps, {name: vm.customMap.basemap.name});
        }
        vm.composeCustomStyle = function() {
            var style;
            vm.selectedBinning = vm.selectedBinning || {};
            if (!vm.selectedColor || vm.selectedColor.type != vm.selectedBinning.type) {
                var colorMatch = _.find(vm.colorOptions, { type: vm.selectedBinning.type, name: vm.prevColorName });
                if (!colorMatch) {
                    colorMatch = _.find(vm.colorOptions, { type: vm.selectedBinning.type });
                }
                vm.selectedColor = colorMatch;
            }
            if (vm.selectedColor.query) {
                style = vm.selectedColor.query.map(function(e){
                    return _.assign({style: e}, vm.selectedBinning.query);
                });
            }
            vm.prevColorName = vm.selectedColor.name;
            vm.customMap = {
                baseMap: _.get(vm.selectedBaseMap, 'query') || vm.basemaps[0].query,
                overlay: style
            };
            $localStorage.customMap = {
                binning: vm.selectedBinning,
                color: vm.selectedColor,
                basemap: vm.selectedBaseMap
            };
            map.update(vm.customMap);
        };

        vm.styleOptions = Object.keys(vm.predefinedStyles);
        vm.basisOfRecord = {};
        enums.basisOfRecord.forEach(function (bor) {
            vm.basisOfRecord[bor] = false;
        });
        var map;

        vm.allYears = true;
        vm.yearRange = {};

        $scope.create = function (element) {
            var suggestedStyle = vm.predefinedStyles[_.get(vm.mapStyle, 'suggested', 'CLASSIC_HEX')] || vm.predefinedStyles.CLASSIC_HEX;
            vm.style = _.get(vm.mapStyle, 'suggested', 'CLASSIC_HEX');
            vm.widgetContextStyle = {
                background: suggestedStyle.background
            };
            map = mapController.createMap(element, {
                baseMap: suggestedStyle.baseMap,
                overlay: suggestedStyle.overlay,
                filters: getQuery()
            });

            //set up zoom control
            var zoomInteraction;
            zoomInteraction = new ol.interaction.MouseWheelZoom();
            zoomInteraction.setActive(false);
            map.map.addInteraction(zoomInteraction);

            var disableZoomTimer;
            var mapArea = element[0].querySelector('.mapWidget__mapArea');
            mapArea.addEventListener('click', function(e){
                if (!zoomInteraction.getActive()) {
                    zoomInteraction.setActive(true);
                }
            });
            mapArea.addEventListener('doubleclick', function(){
                if (!zoomInteraction.getActive()) {
                    zoomInteraction.setActive(true);
                }
            });
            mapArea.addEventListener('mouseleave', function(){
                disableZoomTimer = $timeout(function(){
                    zoomInteraction.setActive(false);
                }, 2500);
            });
            mapArea.addEventListener('mouseenter', function(){
                if(disableZoomTimer) {
                    $timeout.cancel(disableZoomTimer);
                    disableZoomTimer = undefined;
                }
            });

            var query = _.assign({}, vm.filter);
            query = _.mapKeys(query, function (value, key) {
                return _.camelCase(key);
            });

            vm.capabilities = MapCapabilities.get(query);
            var zoomAreaPadding = 2;
            vm.capabilities.$promise.then(function (response) {
                //only zoom in if the area is less than half the world
                if (response.maxLng - response.minLng < 180) {
                    map.setExtent([response.minLng - zoomAreaPadding, response.minLat - zoomAreaPadding, response.maxLng + zoomAreaPadding, response.maxLat + zoomAreaPadding]);//expand with one degree as the API sometimes crop away content see https://github.com/gbif/maps/issues/17
                }
                //only create the slider if there are any years in the data to filter on
                if (response.maxYear) {
                    createSlider(element, response.minYear, response.maxYear);
                }
            }).catch(function () {
                createSlider(element);
            });

            map.on('moveend', function () {
                $timeout(function () {
                    vm.viewBbox = map.getViewExtent();
                    vm.viewBboxWidth = vm.viewBbox[2] - vm.viewBbox[0];
                }, 0);
            });

            function searchOnClick(e) {
                if (vm.activeControl !== vm.controls.OCCURRENCES) {
                    return;
                }
                console.log(e);
                var coordinate = map.getProjectedCoordinate(e.coordinate);
                var size = 30;
                var onePixelOffset = map.getProjectedCoordinate(map.map.getCoordinateFromPixel([e.pixel[0] + size, e.pixel[1] + size]));
                var offset = Math.min(2, Math.max(Math.abs(onePixelOffset[0] - coordinate[0]), Math.abs(onePixelOffset[1] - coordinate[1])));//lazy failsafe for those odd cases in polar projections
                while (_.isNumber(coordinate[0]) && coordinate[0] < -180) {
                    coordinate[0] = coordinate[0] + 360;
                }
                while (_.isNumber(coordinate[0]) && coordinate[0] > 180) {
                    coordinate[0] = coordinate[0] - 360;
                }
                getOccurrencesInArea(coordinate[1], coordinate[0], offset);
            }
            map.on('singleclick', searchOnClick);
        };

        function createSlider(element, startYear, endYear) {
            startYear = startYear || 1700;
            endYear = endYear || 2017;
            var slider = element[0].querySelector('.time-slider__slider');
            var years = element[0].querySelector('.time-slider__years');

            noUiSlider.create(slider, {
                start: [startYear, endYear],
                step: 1,
                connect: true,
                range: {
                    'min': startYear,
                    'max': endYear
                }
            });
            slider.noUiSlider.on('update', function (vals) {
                // only adjust the range the user can see
                vm.yearRange.start = Math.floor(vals[0]);
                vm.yearRange.end = Math.floor(vals[1]);
                years.innerText = vm.yearRange.start + " - " + vm.yearRange.end;
            });
            slider.noUiSlider.on('start', function () {
                $scope.$apply(function () {
                    vm.allYears = false;
                });
            });
            slider.noUiSlider.on('change', vm.sliderChange);
        }

        vm.setStyle = function (style) {
            var s = vm.predefinedStyles[style] || vm.predefinedStyles.CLASSIC;
            vm.widgetContextStyle = {
                background: s.background
            };
            map.update(s);
        };

        vm.setProjection = function (epsg) {
            map.update({projection: epsg});
        };

        vm.setFilters = function () {
            map.update({filters: {basisOfRecord: 'HUMAN_OBSERVATION', taxonKey: 18}});
        };

        vm.updateFilters = function () {
            map.update({filters: getQuery()});
        };

        vm.clearFilters = function () {
            map.update({filters: {}});
        };

        vm.toggleControl = function (control) {
            if (vm.activeControl == control) {
                vm.activeControl = 0;
            } else {
                vm.activeControl = control;
            }
        };

        vm.toggleFullscreen = function() {
            vm.fullscreen = !vm.fullscreen;
            $timeout(function(){
                map.map.updateSize();
                map.map.render();
            }, 100);
        };

        vm.zoomIn = function() {
            var view = map.map.getView();
            view.setZoom(view.getZoom() + 1);
        };

        vm.zoomOut = function() {
            var view = map.map.getView();
            view.setZoom(view.getZoom() - 1);
        };

        vm.getProjection = function () {
            return map ? map.getProjection() : undefined;
        };

        vm.getExploreQuery = function () {
            var q = getQuery();
            if (map && map.getProjection() == 'EPSG_4326') {
                q.geometry = getBoundsAsQueryString();
                q.has_coordinate = true;
                q.has_geospatial_issue = false;
            }
            q = _.mapKeys(q, function (value, key) {
                return _.snakeCase(key);
            });
            return $httpParamSerializer(q);
        };

        vm.getClickedQuery = function () {
            var q = getQuery();
            q.geometry = vm.clickedGeometry;
            q.has_coordinate = true;
            q.has_geospatial_issue = false;
            q = _.mapKeys(q, function (value, key) {
                return _.snakeCase(key);
            });
            return q;
        };

        /**
         * Make sure that longitude coordinates are within the bounds of the map (dateline wrapping).
         * @param n
         * @returns {number} within the -180 to 180 bounds. -200 will fx wrap to 160
         */
        function normalizeLng(extent) {
            while (_.isNumber(extent[2]) && extent[2] < -180) {
                extent[0] = extent[0] + 360;
                extent[2] = extent[2] + 360;
            }
            return extent;
        }

        /**
         * cap latitude (north south) to be within -90 to 90. no wrapping as we do not do that when displaying the map
         * @param n
         * @returns {number} -110 will return -90. 92 will return 90
         */
        function capBounds(n) {
            var m = typeof n === 'number' ? n : 0;
            m = Math.min(90, m);
            m = Math.max(-90, m);
            return m;
        }

        /**
         * Get the bounds of the map as wkt string.
         * @returns {string} format 'POLYGON((W S,W N,E N,E S,W S))'
         */
        function getBoundsAsQueryString() {
            if (!map) return;
            var extent = map.getViewExtent();
            extent = normalizeLng(extent);
            var N = capBounds(extent[3]),
                S = capBounds(extent[1]),
                W = extent[0],
                E = extent[2];

            var str = 'POLYGON' + '((W S,W N,E N,E S,W S))'
                    .replace(/N/g, N.toFixed(2))
                    .replace(/S/g, S.toFixed(2))
                    .replace(/W/g, W.toFixed(2))
                    .replace(/E/g, E.toFixed(2));
            //if we are seeing all of earth then do not filter on bounds. TODO, this will be different code for other projections. How to handle that well?
            if (Math.abs(E - W) >= 180) {
                str = undefined;
            }
            return str;
        }

        function getQuery() {
            var query = _.assign({}, vm.filter);
            query = _.mapKeys(query, function (value, key) {
                return _.camelCase(key);
            });
            if (!vm.allYears && vm.yearRange.start && vm.yearRange.end) {
                query.year = vm.yearRange.start + "," + vm.yearRange.end;
            }
            //basis of record as array
            var basisOfRecord = Object.keys(vm.basisOfRecord).filter(function (e) {
                return vm.basisOfRecord[e];
            });
            query.basisOfRecord = basisOfRecord;
            if (basisOfRecord.length == 0 || basisOfRecord.length == Object.keys(vm.basisOfRecord).length) {
                delete query.basisOfRecord;
            }
            return query;
        }

        vm.sliderChange = function (vals) {
            vm.yearRange.start = Math.floor(vals[0]);
            vm.yearRange.end = Math.floor(vals[1]);
            vm.updateFilters();
            $scope.$apply(function () {
                vm.allYears = false;
            });
        };

        vm.mapMenu = {};
        vm.clickedQuery = {};
        vm.clickedGeometry;
        function getOccurrencesInArea(lat, lng, offset) {
            if (vm.occurrenceRequest && vm.occurrenceRequest.$cancelRequest) vm.occurrenceRequest.$cancelRequest();

            vm.clickedQuery = getQuery();
            var decimalLatitudeMin = lat - offset;
            var decimalLatitudeMax = lat + offset;
            var decimalLongitudeMin = lng - offset;
            var decimalLongitudeMax = lng + offset;
            vm.clickedGeometry =  'POLYGON' + '((W S,W N,E N,E S,W S))'
                    .replace(/N/g, decimalLatitudeMin)
                    .replace(/S/g, decimalLatitudeMax)
                    .replace(/W/g, decimalLongitudeMin)
                    .replace(/E/g, decimalLongitudeMax);

            decimalLatitudeMin = Math.max(-90, decimalLatitudeMin);
            decimalLongitudeMin = Math.max(-180, decimalLongitudeMin);
            decimalLatitudeMin = Math.min(90, decimalLatitudeMin);
            decimalLongitudeMin = Math.min(180, decimalLongitudeMin);

            decimalLatitudeMax = Math.min(90, decimalLatitudeMax);
            decimalLongitudeMax = Math.min(180, decimalLongitudeMax);
            decimalLatitudeMax = Math.max(-90, decimalLatitudeMax);
            decimalLongitudeMax = Math.max(-180, decimalLongitudeMax);

            vm.clickedQuery.decimalLatitude = decimalLatitudeMin + ',' + decimalLatitudeMax;
            vm.clickedQuery.decimalLongitude = decimalLongitudeMin + ',' + decimalLongitudeMax;
            vm.clickedQuery.clickedGeometry = vm.clickedGeometry;
            vm.clickedQuery.has_geospatial_issue = false;
            vm.clickedQuery.has_coordinate = true;
            $state.go('occurrenceSearchTable', vm.getClickedQuery(), {inherit: false, notify: true, reload: true});
            //vm.activeControl = vm.controls.OCCURRENCES;
            //vm.mapMenu.isLoading = true;
            //vm.occurrenceRequest = OccurrenceSearch.query(vm.clickedQuery, function (data) {
            //    utils.attachImages(data.results);
            //    vm.mapMenu.isLoading = false;
            //    vm.mapMenu.occurrences = data;
            //}, function () {
            //    //TODO error handling
            //});
        }

        $scope.$watchCollection(function () {
            return vm.filter
        }, function () {
            vm.activeControl = undefined;
            map.update({filters: getQuery()});
        });
    }
}

module.exports = mapWidgetDirective;
