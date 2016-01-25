var fsm = angular.module('fsm', []);

fsm.directive('fsmStickyHeader', function () {
    return {
        restrict: 'EA',
        replace: false,
        scope: {
            scrollBody: '=',
            scrollStop: '=',
            scrollableContainer: '='
        },
        link: function (scope, element, attrs, control) {
            var headerSelector = angular.isDefined(attrs.headerSelector) ? attrs.headerSelector : "";

            var header = $(element, this);
            var content = $(scope.scrollBody);
            var scrollableContainer = $(scope.scrollableContainer)[0] || $(window);
            var clonedHeader = null;

            scope.$on("tableUpdated", function () {
                if (clonedHeader) {
                    calculateSize();
                }
            });

            function createClone() {
                if (headerSelector !== "") {
                    clonedHeader = angular.element(headerSelector);
                } else {
                    clonedHeader = header.clone();
                }

                header.before(clonedHeader);
                clonedHeader.addClass('fsm-sticky-header');
                clonedHeader.css({
                    position: 'fixed',
                    'z-index': 10000,
                    visibility: 'hidden'
                });
                calculateSize();
            }

            function calculateSize() {
                var scrollLeft = scrollableContainer.scrollLeft();

                clonedHeader.css({
                    top: scope.scrollStop,
                    width: header.outerWidth(),
                    left: header.offset().left - scrollLeft
            });

                setColumnHeaderSizes();
            };

            function setColumnHeaderSizes() {
                if (clonedHeader.is('tr')) {
                    var clonedColumns = clonedHeader.find('th');
                    header.find('th').each(function (index, column) {
                        var clonedColumn = $(clonedColumns[index]);
                        clonedColumn.css('width', column.offsetWidth + 'px');
                    });
                }
            }

            function determineVisibility() {
                var scrollTop = scrollableContainer.scrollTop() + scope.scrollStop;
                var contentTop = content.offset().top;
                var contentBottom = contentTop + content.outerHeight(false);

                

                if ((scrollTop > contentTop) && (scrollTop < contentBottom)) {
                    if (!clonedHeader) {
                        createClone();
                        clonedHeader.css({ "visibility": "visible" });
                    }
                    else {
                        if (headerSelector !== "") {
                            calculateSize();
                            clonedHeader.css({
                                position: 'fixed',
                                'z-index': 10000,
                                'visibility': 'visible',
                                'display': 'table-row'
                            });
                        }
                    }

                    if (scrollTop < contentBottom && scrollTop > contentBottom - clonedHeader.outerHeight(false)) {
                        var top = contentBottom - scrollTop + scope.scrollStop - clonedHeader.outerHeight(false);
                        clonedHeader.css('top', top + 'px');
                    } else {
                        calculateSize();
                    }
                } else {
                    if (clonedHeader) {
                        if (headerSelector === "") {
                            clonedHeader.remove();
                            clonedHeader = null;
                        }
                        else {
                            clonedHeader.css({ visibility: 'hidden', display: 'none' });
                        }
                    }
                };
            };

            scrollableContainer.scroll(determineVisibility).trigger("scroll");
            scrollableContainer.resize(determineVisibility);
        }
    }
});

fsm.directive('fsmMenuButton', function () {
    return {
        restrict: 'EA',
        replace: false,
        scope: {},
        link: function (scope, element, attrs, control) {
            var menuButton = $(element, this);

            menuButton.addClass('fsm-menu-button');
            menuButton.click(menuOnClick);

            function menuOnClick() {
                $('body').toggleClass('fsm-menu-toggle');
                setMenuSpin();
                setTimeout(setMenuSpin, 50);
            };

            function setMenuSpin() {
                menuButton.find('.fsm-menu-button-open').toggleClass('fsm-spin-forward');
                menuButton.find('.fsm-menu-button-closed').toggleClass('fsm-spin-backward');
            };
        }
    }
});

fsm.directive('fsmBigData', function ($filter) {

    return {
        restrict: 'AE',
        scope: {},
        replace: false,
        transclude: true,
        link: function (scope, element, attrs, controller, transclude) {
            var orderBy = $filter('orderBy');
            var currentPage = 0;
            var pagedDataName = attrs.fsmBigData.split(' of ')[0];
            var rightHandExpression = attrs.fsmBigData.split(' of ')[1];
            var pageSize = parseInt(rightHandExpression.split(' take ')[1]);
            var sourceData = rightHandExpression.split(' take ')[0];

            // Interesting things can be done here with the source object...
            // var displayGetter = $parse(sourceData);
            // var displaySetter = displayGetter.assign;
            // var results = orderBy(displayGetter(scope.$parent), sortColumns);
            // displaySetter(scope.$parent, results)

            var rawData = [];
            var sortedData = [];
            var pagedData = [];
            var page = $(window);
            var sortTypes = ['None', 'Ascending', 'Descending'];
            var sortColumns = [];

            scope.sortTypes = sortTypes;

            transclude(scope, function (clone, transcludedScope) {
                element.append(clone);
                transcludedScope[pagedDataName] = pagedData;

                function nextPage() {
                    var dataSlice = sortedData.slice(pageSize * currentPage, (pageSize * (currentPage + 1)));
                    if (dataSlice.length > 0) {
                        pagedData.push.apply(pagedData, dataSlice);
                        currentPage++;
                    }
                }

                function addSortColumn(columnName, sortType) {

                    // If this column is currently in the sort stack, remove it.
                    for (var i = 0; i < sortColumns.length; i++) {
                        if (sortColumns[i].indexOf(columnName) > -1) {
                            sortColumns.splice(i, 1);
                        }
                    }

                    // Push this sort on the top of the stack (aka. array)
                    if (sortType > 0) {
                        var direction = '';
                        if (sortTypes[sortType] === 'Descending') {
                            direction = '-'
                        }
                        sortColumns.unshift(direction + columnName);
                    }

                    renderData();
                }

                function renderData() {
                    if (sortColumns.length) {
                        sortedData = orderBy(rawData, sortColumns);
                    }
                    else {
                        sortedData = rawData;
                    }

                    pagedData.length = 0;
                    currentPage = 0;
                    nextPage();
                }

                function onPageScroll() {
                    var s = $(window).scrollTop(),
                    d = $(document).height(),
                    c = $(window).height();
                    scrollPercent = (s / (d - c));

                    if (scrollPercent > 0.98) {
                        // We use scope.apply here to tell angular about these changes because 
                        // they happen outside of angularjs context... we're using jquery here
                        // to figure out when we need to load another page of data.
                        transcludedScope.$apply(nextPage);
                    }
                }

                page.scroll(onPageScroll).trigger('scroll');

                scope.$parent.$watchCollection(sourceData, function (newData) {
                    if (newData) {
                        rawData = newData;
                        renderData();
                    }
                });

                scope.addSortColumn = addSortColumn;
            });
        }
    }
});

fsm.directive('fsmSort', function () {
    var sortIconTemplate = '<i class="fa fa-sort"></i>';

    return {
        restrict: 'AE',
        replace: false,
        scope: {},
        link: function (scope, element, attrs) {
            var columnHeader = element;
            var columnName = attrs.fsmSort;
            var sortIcon = angular.element(sortIconTemplate);
            columnHeader.append('&nbsp;')
            columnHeader.append(sortIcon);
            var currentSortType = 0;

            function swapIcons() {
                sortIcon.removeClass('fa-sort-desc fa-sort-asc fa-sort');

                var classToAdd = 'fa-sort';

                if (scope.$parent.sortTypes[currentSortType] === 'Ascending') {
                    classToAdd = 'fa-sort-asc';
                } else if (scope.$parent.sortTypes[currentSortType] === 'Descending') {
                    classToAdd = 'fa-sort-desc';
                }

                sortIcon.addClass(classToAdd);
            }

            columnHeader.css({ cursor: 'pointer' });

            columnHeader.bind('click', function () {
                // Find the kind of sort this should now be
                currentSortType++;
                if (currentSortType == scope.$parent.sortTypes.length) {
                    currentSortType = 0;
                }

                scope.$apply(scope.$parent.addSortColumn(columnName, currentSortType));

                swapIcons();
            });
        }
    }
});