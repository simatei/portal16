/**
 * search types?
 * auto complete
 * integer is [between, below, above]
 * date interval etc
 * enum list, multiselect
 */
'use strict';
var angular = require('angular');

angular
    .module('portal')
    .controller('datasetCtrl', datasetCtrl);

/** @ngInject */
function datasetCtrl($scope, DatasetFilter) {
    var vm = this;

    vm.search = function() {
        DatasetFilter.search(function(data){
            vm.results = data.results;
            vm.count = data.count;
            vm.facets = data.facets;
        });
    };

    $scope.$watchCollection(DatasetFilter.getQuery, function() {
        vm.search();
    });
}

module.exports = datasetCtrl;