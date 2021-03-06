'use strict';

var angular = require('angular');

angular
    .module('portal')
    .controller('networkDatasetCtrl', networkDatasetCtrl);

/** @ngInject */
function networkDatasetCtrl($state, $stateParams, $anchorScroll, Network, NetworkDatasets) {
    var vm = this;
    vm.$state = $state;
    vm.datasets = {};
    vm.maxSize = 5;
    vm.limit = 20;
    vm.key = $stateParams.key;
    vm.getDatasets = function() {
        NetworkDatasets.get({id: vm.key, limit: vm.limit, offset: vm.offset},
            function(response) {
                vm.datasets = response;
            },
            function() {
                // TODO handle errors
            }
        );
    };

    vm.setPageNumbers = function() {
        vm.offset = $stateParams.offset || 0;
        vm.currentPage = Math.floor(vm.offset / vm.limit) + 1;
        vm.getDatasets();
    };
    vm.setPageNumbers();

    vm.pageChanged = function() {
        vm.offset = (vm.currentPage - 1) * vm.limit;
        var offset = vm.offset == 0 ? undefined : vm.offset;
        $state.go($state.current, {'limit': vm.limit, 'offset': offset}, {inherit: true, notify: false, reload: true});
        vm.getDatasets();
    };
}


module.exports = networkDatasetCtrl;
