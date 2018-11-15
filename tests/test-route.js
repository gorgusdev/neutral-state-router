var historyManager = new Neutral.RouterHistoryManager(location.pathname, true, location, history, sessionStorage);
var router = new Neutral.Router({ 
    historyManager: historyManager,
    routeFoundCallback: function(state) {
        console.log(state);
        configPath.value = state.configPath;
        url.value = state.url;
        trackId.value = state.historyTrackId;
        transitionId.value = state.transitionId;
        routerData.value = JSON.stringify(state.data, undefined, 4);
        urlParams.value = JSON.stringify(state.urlParams, undefined, 4);
        queryParams.value = JSON.stringify(state.queryParams, undefined, 4);
    },
    routeNotFoundCallback: function() {
        console.error('Not Found:', arguments);
        configPath.value = 'Not Found';
        url.value = '';
        trackId.value = '';
        transitionId.value = '';
        routerData.value = '';
        urlParams.value = '';
        queryParams.value = '';
    }
});
router.addConfig('a', {
    url: '/',
    data: {
        level: 'first'
    },
    errorPath: 'app.error',
    configs: {
        error: {
            data: {
                error: true
            }
        },
        b1: {
            url: '/b1',
            data: {
                level: 'second',
                '+acc': 'b1acc'
            },
            unrouted: true,
            configs: {
                c1: {
                    url: '/c1',
                    reloadable: true,
                    data: {
                        level: 'third',
                        '+acc': 'c1acc'
                    }
                },
                c2: {
                    url: '/c2',
                    data: {
                        level: 'third',
                        '+acc': ['c2acc1', 'c2acc2']
                    }
                },
                c3: {
                    data: {
                        level: 'third',
                        '+acc': [['c3acc']]
                    },
                },
                c4: {
                    url: '/c4/:arg1',
                    data: {
                        level: 'third'
                    }
                },
                c5: {
                    url: '^/c5'
                }
            }
        },
        b2: {
            url: '/b2',
            unrouted: true,
            data: {
                level: 'second'
            },
            routeExtensionCallback: function() {
                console.log('Extend!');
                return new Promise((resolve, reject) => {
                    setTimeout(() => {
                        resolve({
                            c1: {
                                url: '/c1',
                                data: {
                                    level: 'third'
                                }
                            }
                        });
                    }, 5000);
                });
            }
        },
        b3: {
            configs: {
                c1: {
                    url: '/b3c1'
                }
            }
        }
    }
});
var configPath = document.getElementById('configPath');
var url = document.getElementById('url');
var trackId = document.getElementById('trackId');
var transitionId = document.getElementById('transitionId');
var routerData = document.getElementById('routerData');
var urlParams = document.getElementById('urlParams');
var queryParams = document.getElementById('queryParams');
console.log('Start');
router.start();
var navButton = document.getElementById('navA1');
navButton.addEventListener('click', function() {
    router.navigateTo('a');
    return false;
});
navButton = document.getElementById('navB1');
navButton.addEventListener('click', function() {
    router.navigateTo('a.b1');
    return false;
});
navButton = document.getElementById('navB1C1');
navButton.addEventListener('click', function() {
    router.navigateTo('a.b1.c1', {}, { query: 'test' });
    return false;
});
navButton = document.getElementById('navB1C2');
navButton.addEventListener('click', function() {
    router.navigateTo('a.b1.c2');
    return false;
});
navButton = document.getElementById('navB1C3');
navButton.addEventListener('click', function() {
    router.navigateTo('a.b1.c3');
    return false;
});
navButton = document.getElementById('navB1C4');
navButton.addEventListener('click', function() {
    router.navigateTo('a.b1.c4', { arg1: 'test-arg' });
    return false;
});
navButton = document.getElementById('navB1C5');
navButton.addEventListener('click', function() {
    router.navigateTo('a.b1.c5');
    return false;
});
navButton = document.getElementById('navB2');
navButton.addEventListener('click', function() {
    router.navigateTo('a.b2');
    return false;
});
navButton = document.getElementById('navB2C1');
navButton.addEventListener('click', function() {
    router.navigateTo('a.b2.c1');
    return false;
});
