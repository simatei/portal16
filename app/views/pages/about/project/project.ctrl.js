'use strict';
var angular = require('angular');

angular
    .module('portal')
    .controller('projectCtrl', projectCtrl);

/** @ngInject */
function projectCtrl(DevDatasetSearch) {
    var vm = this;
    vm.getRelatedDatasets = function () {
        DevDatasetSearch.query({project_id: vm.projectId}).$promise.then(function (response) {
            vm.relatedDatasets = response.results;
        }, function (error) {
            return error;
        });
    };

    vm.sortField = 'title';
    vm.sortReverse = false;

}

module.exports = projectCtrl;

