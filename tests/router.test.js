const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const expect = chai.expect;
const sinon = require('sinon');
const routerModule = require('../cjs/router');

chai.use(chaiAsPromised);

describe('router', function() {
    describe('getCurrentState', function() {
		it('should get the current state from the state manager', function() {
            const fakeHistoryManager = {};
            const fakeConfigManager = {};
            const fakeStateManager = {
                getCurrentState: sinon.spy()
            };
            const router = new routerModule.Router(
                fakeHistoryManager,
                fakeConfigManager,
                fakeStateManager
            );
            router.getCurrentState();
            expect(fakeStateManager.getCurrentState).to.have.property('callCount', 1);
        });
    });
    describe('setAccumulatedStateDataPropNames', function() {
		it('should set the accumulated state data props on the state manager', function() {
            const fakeHistoryManager = {};
            const fakeConfigManager = {};
            const fakeStateManager = {
                setAccumulatedStateDataPropNames: sinon.spy()
            };
            const router = new routerModule.Router(
                fakeHistoryManager,
                fakeConfigManager,
                fakeStateManager
            );
            router.setAccumulatedStateDataPropNames(['a']);
            expect(fakeStateManager.setAccumulatedStateDataPropNames).to.have.property('callCount', 1);
        });
    });
    describe('setNonInheritedStateDataPropNames', function() {
		it('should set the non-inherited state data props on the state manager', function() {
            const fakeHistoryManager = {};
            const fakeConfigManager = {};
            const fakeStateManager = {
                setNonInheritedStateDataPropNames: sinon.spy()
            };
            const router = new routerModule.Router(
                fakeHistoryManager,
                fakeConfigManager,
                fakeStateManager
            );
            router.setNonInheritedStateDataPropNames(['a']);
            expect(fakeStateManager.setNonInheritedStateDataPropNames).to.have.property('callCount', 1);
        });
    });
    describe('isRunning', function() {
		it('should report the running status of the router', function() {
            const fakeHistoryManager = {
                startHistoryUpdates: sinon.spy(),
                init: sinon.spy()
            };
            const fakeConfigManager = {
                buildRouterConfigs: sinon.spy()
            };
            const fakeStateManager = {};
            const router = new routerModule.Router(
                fakeHistoryManager,
                fakeConfigManager,
                fakeStateManager
            );
            expect(router.isRunning()).to.equal(false);
            router.start({
                routeFoundCallback: sinon.spy()
            });
            expect(router.isRunning()).to.equal(true);
        });
    });
    describe('addConfig', function() {
		it('should add a configuration to the config manager', function() {
            const fakeHistoryManager = {};
            const fakeConfigManager = {
                addConfig: sinon.spy()
            };
            const fakeStateManager = {};
            const router = new routerModule.Router(
                fakeHistoryManager,
                fakeConfigManager,
                fakeStateManager
            );
            router.addConfig('a.b', {});
            expect(fakeConfigManager.addConfig).to.have.property('callCount', 1);
        });
    });
    describe('getConfigUrl', function() {
		it('should throw exception when called on a router that is not running', function() {
            const fakeHistoryManager = {};
            const fakeConfigManager = {};
            const fakeStateManager = {};
            const router = new routerModule.Router(
                fakeHistoryManager,
                fakeConfigManager,
                fakeStateManager
            );
            expect(function() { router.getConfigUrl('a.b'); }).to.throw('Router not running');
        });
		it('should find the configuration from the config manager and then complete the URL from the history manager', function() {
            const fakeHistoryManager = {
                startHistoryUpdates: sinon.spy(),
                init: sinon.spy(),
                getFullUrl: sinon.stub().returns('/a/b')
            };
            const fakeConfigManager = {
                buildRouterConfigs: sinon.spy(),
                getConfigUrl: sinon.stub().returns('/b')
            };
            const fakeStateManager = {};
            const router = new routerModule.Router(
                fakeHistoryManager,
                fakeConfigManager,
                fakeStateManager
            );
            router.start({
                routeFoundCallback: sinon.spy()
            });
            router.getConfigUrl('a.b');
            expect(fakeHistoryManager.getFullUrl, 'getFullUrl').to.have.property('callCount', 1);
            expect(fakeConfigManager.getConfigUrl, 'getConfigUrl').to.have.property('callCount', 1);
        });
    });
    describe('start', function() {
		it('should set callback and initialize config and history managers', function() {
            const fakeHistoryManager = {
                startHistoryUpdates: sinon.spy(),
                init: sinon.spy(),
            };
            const fakeConfigManager = {
                buildRouterConfigs: sinon.spy(),
            };
            const fakeStateManager = {};
            const router = new routerModule.Router(
                fakeHistoryManager,
                fakeConfigManager,
                fakeStateManager
            );
            router.start({
                routeFoundCallback: sinon.spy()
            });
            expect(fakeHistoryManager.startHistoryUpdates).to.have.property('callCount', 1);
            expect(fakeHistoryManager.init).to.have.property('callCount', 1);
            expect(fakeConfigManager.buildRouterConfigs).to.have.property('callCount', 1);
            expect(router.isRunning()).to.equal(true);
        });
		it('should throw exception if called while already running', function() {
            const fakeHistoryManager = {
                startHistoryUpdates: sinon.spy(),
                init: sinon.spy(),
            };
            const fakeConfigManager = {
                buildRouterConfigs: sinon.spy(),
            };
            const fakeStateManager = {};
            const router = new routerModule.Router(
                fakeHistoryManager,
                fakeConfigManager,
                fakeStateManager
            );
            router.start({
                routeFoundCallback: sinon.spy()
            });
            expect(function() {
                router.start({
                    routeFoundCallback: sinon.spy()
                });
            }).to.throw('Router already running');
        });
    });
    describe('stop', function() {
		it('should stop the history manager', function() {
            const fakeHistoryManager = {
                startHistoryUpdates: sinon.spy(),
                stopHistoryUpdates: sinon.spy(),
                init: sinon.spy()
            };
            const fakeConfigManager = {
                buildRouterConfigs: sinon.spy()
            };
            const fakeStateManager = {};
            const router = new routerModule.Router(
                fakeHistoryManager,
                fakeConfigManager,
                fakeStateManager
            );
            router.start({
                routeFoundCallback: sinon.spy()
            });
            router.stop();
            expect(fakeHistoryManager.stopHistoryUpdates).to.have.property('callCount', 1);
            expect(router.isRunning()).to.equal(false);
        });
		it('should do nothing if not running when called', function() {
            const fakeHistoryManager = {
                startHistoryUpdates: sinon.spy(),
                stopHistoryUpdates: sinon.spy(),
                init: sinon.spy()
            };
            const fakeConfigManager = {
                buildRouterConfigs: sinon.spy()
            };
            const fakeStateManager = {};
            const router = new routerModule.Router(
                fakeHistoryManager,
                fakeConfigManager,
                fakeStateManager
            );
            router.stop();
            expect(fakeHistoryManager.stopHistoryUpdates).to.have.property('callCount', 0);
            expect(router.isRunning()).to.equal(false);
        });
    });
    describe('navigateTo / redirectTo', function() {
		it('should navigate to a new state', function() {
            const fakeHistoryManager = {
                startHistoryUpdates: sinon.spy(),
                init: sinon.spy(),
                navigateTo: sinon.spy(),
                getHistoryTrackId: sinon.stub().returns('routerHistoryTrack1')
            };
            const fakeConfigManager = {
                buildRouterConfigs: sinon.spy(),
                findRouterConfigByName: sinon.stub().returns(Promise.resolve([{
                    url: '/a/b'
                }])),
                buildConfigStateUrl: sinon.stub().returns('/b')
            };
            const fakeRouterState = {
                configPath: 'a.b',
                url: '/a/b',
                urlParams: {},
                queryParams: {},
                historyTrackId: '',
                transitionId: 0,
                data: {}
            };
            const fakeStateManager = {
                updateState: sinon.stub().returns(fakeRouterState)
            };
            const routeFoundCallback = sinon.spy();
            const router = new routerModule.Router(
                fakeHistoryManager,
                fakeConfigManager,
                fakeStateManager
            );
            router.start({
                routeFoundCallback: routeFoundCallback
            });
            return router.navigateTo('a.b', {}, {}, {}).then(function() {
                expect(routeFoundCallback).to.have.property('callCount', 1);
                expect(routeFoundCallback.args[0][0]).to.deep.equal(fakeRouterState);
            });
        });
		it('should redirect to a new state', function() {
            const fakeHistoryManager = {
                startHistoryUpdates: sinon.spy(),
                init: sinon.spy(),
                redirectTo: sinon.spy(),
                getHistoryTrackId: sinon.stub().returns('routerHistoryTrack1')
            };
            const fakeConfigManager = {
                buildRouterConfigs: sinon.spy(),
                findRouterConfigByName: sinon.stub().returns(Promise.resolve([{
                    url: '/a/b'
                }])),
                buildConfigStateUrl: sinon.stub().returns('/b')
            };
            const fakeRouterState = {
                configPath: 'a.b',
                url: '/a/b',
                urlParams: {},
                queryParams: {},
                historyTrackId: '',
                transitionId: 0,
                data: {}
            };
            const fakeStateManager = {
                updateState: sinon.stub().returns(fakeRouterState)
            };
            const routeFoundCallback = sinon.spy();
            const router = new routerModule.Router(
                fakeHistoryManager,
                fakeConfigManager,
                fakeStateManager
            );
            router.start({
                routeFoundCallback: routeFoundCallback
            });
            return router.redirectTo('a.b', {}, {}, {}).then(function() {
                expect(routeFoundCallback).to.have.property('callCount', 1);
                expect(routeFoundCallback.args[0][0]).to.deep.equal(fakeRouterState);
                expect(fakeHistoryManager.redirectTo).to.have.property('callCount', 1);
            });
        });
		it('should throw exception if not running', function() {
            const fakeHistoryManager = {};
            const fakeConfigManager = {};
            const fakeStateManager = {};
            const router = new routerModule.Router({
                historyManager: fakeHistoryManager,
                configManager: fakeConfigManager,
                stateManager: fakeStateManager,
                routeFoundCallback: sinon.spy()
            });
            expect(function() { router.navigateTo('a.b', {}, {}, {}); }).to.throw('Router is not running');
        });
		it('should fail if the requested config is unrouted', function() {
            const fakeHistoryManager = {
                startHistoryUpdates: sinon.spy(),
                init: sinon.spy(),
                navigateTo: sinon.spy(),
                getHistoryTrackId: sinon.stub().returns('routerHistoryTrack1')
            };
            const fakeConfigManager = {
                buildRouterConfigs: sinon.spy(),
                findRouterConfigByName: sinon.stub().returns(Promise.resolve([{
                    url: '/a/b',
                    unrouted: true
                }])),
                buildConfigStateUrl: sinon.stub().returns('/b')
            };
            const fakeRouterState = {
                configPath: 'a.b',
                url: '/a/b',
                urlParams: {},
                queryParams: {},
                historyTrackId: '',
                transitionId: 0,
                data: {}
            };
            const fakeStateManager = {
                updateState: sinon.stub().returns(fakeRouterState)
            };
            const routeFoundCallback = sinon.spy();
            const routeNotFoundCallback = sinon.spy();
            const router = new routerModule.Router(
                fakeHistoryManager,
                fakeConfigManager,
                fakeStateManager
            );
            router.start({
                routeFoundCallback: routeFoundCallback,
                routeNotFoundCallback: routeNotFoundCallback
            });
            return expect(router.navigateTo('a.b', {}, {}, {})).to.eventually.rejectedWith('Unable to navigate to unrouted path');
        });
		it('should cancel transition if navigation fails', function() {
            const fakeHistoryManager = {
                startHistoryUpdates: sinon.spy(),
                init: sinon.spy(),
                navigateTo: sinon.spy(),
                getHistoryTrackId: sinon.stub().returns('routerHistoryTrack1')
            };
            const fakeConfigManager = {
                buildRouterConfigs: sinon.spy(),
                findRouterConfigByName: sinon.stub().returns(Promise.resolve([{
                    url: '/a/b',
                    unrouted: true
                }])),
                buildConfigStateUrl: sinon.stub().returns('/b')
            };
            const fakeRouterState = {
                configPath: 'a.b',
                url: '/a/b',
                urlParams: {},
                queryParams: {},
                historyTrackId: '',
                transitionId: 0,
                data: {}
            };
            const fakeStateManager = {
                updateState: sinon.stub().returns(fakeRouterState)
            };
            const routeFoundCallback = sinon.spy();
            const routeNotFoundCallback = sinon.spy();
            const cancelCallback = sinon.spy();
            const router = new routerModule.Router(
                fakeHistoryManager,
                fakeConfigManager,
                fakeStateManager
            );
            router.start({
                routeFoundCallback: routeFoundCallback,
                routeNotFoundCallback: routeNotFoundCallback,
                transitionCancel: cancelCallback
            });
            return router.navigateTo('a.b', {}, {}, {}).catch(function() {
                expect(cancelCallback).to.have.property('callCount', 1);
            });
        });
        it('should reload at URL if requested', function() {
            const fakeHistoryManager = {
                startHistoryUpdates: sinon.spy(),
                init: sinon.spy(),
                navigateTo: sinon.spy(),
                getHistoryTrackId: sinon.stub().returns('routerHistoryTrack1'),
                reloadAtUrl: sinon.spy()
            };
            const fakeConfigManager = {
                buildRouterConfigs: sinon.spy(),
                findRouterConfigByName: sinon.stub().returns(Promise.resolve([{
                    url: '/a/b',
                    reloadable: true
                }])),
                buildConfigStateUrl: sinon.stub().returns('/b')
            };
            const fakeStateManager = {
                updateState: sinon.spy()
            };
            const routeFoundCallback = sinon.spy();
            const router = new routerModule.Router(
                fakeHistoryManager,
                fakeConfigManager,
                fakeStateManager
            );
            router.start({
                routeFoundCallback: routeFoundCallback
            });
            router.requestReload();
            return router.navigateTo('a.b', {}, {}, {}).then(function() {
                expect(fakeHistoryManager.reloadAtUrl).to.have.property('callCount', 1);
            });
        });
		it('should start and end a transition', function() {
            const fakeHistoryManager = {
                startHistoryUpdates: sinon.spy(),
                init: sinon.spy(),
                navigateTo: sinon.spy(),
                getHistoryTrackId: sinon.stub().returns('routerHistoryTrack1')
            };
            const fakeConfigManager = {
                buildRouterConfigs: sinon.spy(),
                findRouterConfigByName: sinon.stub().returns(Promise.resolve([{
                    url: '/a/b'
                }])),
                buildConfigStateUrl: sinon.stub().returns('/b')
            };
            const fakeRouterState = {
                configPath: 'a.b',
                url: '/a/b',
                urlParams: {},
                queryParams: {},
                historyTrackId: '',
                transitionId: 0,
                data: {}
            };
            const fakeStateManager = {
                updateState: sinon.stub().returns(fakeRouterState)
            };
            const routeFoundCallback = sinon.spy();
            const beginCallback = sinon.spy();
            const endCallback = sinon.spy();
            const router = new routerModule.Router(
                fakeHistoryManager,
                fakeConfigManager,
                fakeStateManager
            );
            router.start({
                routeFoundCallback: routeFoundCallback,
                transitionBegin: beginCallback,
                transitionEnd: endCallback
            });
            return router.navigateTo('a.b', {}, {}, {}).then(function() {
                expect(beginCallback, 'transitionBegin').to.have.property('callCount', 1);
                expect(endCallback, 'transitionEnd').to.have.property('callCount', 1);
            });
        });
		it('should cancel an ongoing transition', function() {
            const fakeHistoryManager = {
                startHistoryUpdates: sinon.spy(),
                init: sinon.spy(),
                navigateTo: sinon.spy(),
                getHistoryTrackId: sinon.stub().returns('routerHistoryTrack1')
            };
            const fakeConfigManager = {
                buildRouterConfigs: sinon.spy(),
                findRouterConfigByName: sinon.stub().returns(Promise.resolve([{
                    url: '/a/b'
                }])),
                buildConfigStateUrl: sinon.stub().returns('/b')
            };
            const fakeRouterState = {
                configPath: 'a.b',
                url: '/a/b',
                urlParams: {},
                queryParams: {},
                historyTrackId: '',
                transitionId: 0,
                data: {}
            };
            const fakeStateManager = {
                updateState: sinon.stub().returns(fakeRouterState)
            };
            const routeFoundCallback = sinon.spy();
            const beginCallback = sinon.spy();
            const cancelCallback = sinon.spy();
            const endCallback = sinon.spy();
            const router = new routerModule.Router(
                fakeHistoryManager,
                fakeConfigManager,
                fakeStateManager
            );
            router.start({
                routeFoundCallback: routeFoundCallback,
                transitionBegin: beginCallback,
                transitionCancel: cancelCallback,
                transitionEnd: endCallback
            });
            return Promise.all([router.navigateTo('a.b'), router.navigateTo('a.c', {}, {}, {}).then(function() {
                expect(beginCallback, 'transitionBegin').to.have.property('callCount', 2);
                expect(cancelCallback, 'transitionCancel').to.have.property('callCount', 1);
                expect(endCallback, 'transitionEnd').to.have.property('callCount', 1);
            })]).catch(function() {});
        });
   });
    describe('updateFromHistory', function() {
        it('should do nothing if not running', function() {
            const fakeHistoryManager = {};
            const fakeConfigManager = {};
            const fakeStateManager = {};
            const router = new routerModule.Router({
                historyManager: fakeHistoryManager,
                configManager: fakeConfigManager,
                stateManager: fakeStateManager,
                routeFoundCallback: sinon.spy()
            });
            return expect(router.updateFromHistory()).to.eventually.rejectedWith('Router is not running');
        });
        it('should report missing URL', function() {
            const fakeHistoryManager = {
                startHistoryUpdates: sinon.spy(),
                init: sinon.spy(),
                getConfigPath: sinon.stub().returns(undefined),
                getUrl: sinon.stub().returns(undefined)
            };
            const fakeConfigManager = {
                buildRouterConfigs: sinon.spy()
            };
            const fakeStateManager = {};
            const routeFoundCallback = sinon.spy();
            const urlMissingCallback = sinon.spy();
            const router = new routerModule.Router(
                fakeHistoryManager,
                fakeConfigManager,
                fakeStateManager
            );
            router.start({
                routeFoundCallback: routeFoundCallback,
                urlMissingRouteCallback: urlMissingCallback
            });
            return router.updateFromHistory().catch(function() {
                expect(urlMissingCallback).to.have.property('callCount', 1);
            });
        });
        describe('with config path', function() {
            it('should find a new state', function() {
                const fakeHistoryManager = {
                    startHistoryUpdates: sinon.spy(),
                    init: sinon.spy(),
                    navigateTo: sinon.spy(),
                    getHistoryTrackId: sinon.stub().returns('routerHistoryTrack1'),
                    getConfigPath: sinon.stub().returns('a.b'),
                    getUrl: sinon.stub().returns('/b')
                };
                const fakeConfigManager = {
                    buildRouterConfigs: sinon.spy(),
                    findRouterConfigByName: sinon.stub().returns(Promise.resolve([{
                        url: '/a/b'
                    }])),
                    findAndBuildUrlParams: sinon.stub().returns({}),
                    buildConfigStateUrl: sinon.stub().returns('/b')
                };
                const fakeRouterState = {
                    configPath: 'a.b',
                    url: '/a/b',
                    urlParams: {},
                    queryParams: {},
                    historyTrackId: '',
                    transitionId: 0,
                    data: {}
                };
                const fakeStateManager = {
                    updateState: sinon.stub().returns(fakeRouterState)
                };
                const routeFoundCallback = sinon.spy();
                const router = new routerModule.Router(
                    fakeHistoryManager,
                    fakeConfigManager,
                    fakeStateManager
                );
                router.start({
                    routeFoundCallback: routeFoundCallback
                });
                return router.updateFromHistory().then(function() {
                    expect(routeFoundCallback).to.have.property('callCount', 1);
                });
             });
        });
        describe('with URL', function() {
            it('should find a new state', function() {
                const fakeHistoryManager = {
                    startHistoryUpdates: sinon.spy(),
                    init: sinon.spy(),
                    navigateTo: sinon.spy(),
                    getHistoryTrackId: sinon.stub().returns('routerHistoryTrack1'),
                    getConfigPath: sinon.stub().returns(undefined),
                    getUrl: sinon.stub().returns('/b')
                };
                const fakeConfigManager = {
                    buildRouterConfigs: sinon.spy(),
                    findRoutedConfigByUrl: sinon.stub().returns(Promise.resolve({
                        configPath: 'a.b',
                        configMatches: [{
                            url: '/a/b'
                        }]
                    })),
                    buildUrlParams: sinon.stub().returns({}),
                    buildConfigStateUrl: sinon.stub().returns('/b')
                };
                const fakeRouterState = {
                    configPath: 'a.b',
                    url: '/a/b',
                    urlParams: {},
                    queryParams: {},
                    historyTrackId: '',
                    transitionId: 0,
                    data: {}
                };
                const fakeStateManager = {
                    updateState: sinon.stub().returns(fakeRouterState),
                    getCurrentState: sinon.stub().returns(fakeRouterState)
                };
                const routeFoundCallback = sinon.spy();
                const router = new routerModule.Router(
                    fakeHistoryManager,
                    fakeConfigManager,
                    fakeStateManager
                );
                router.start({
                    routeFoundCallback: routeFoundCallback
                });
                return router.updateFromHistory().then(function() {
                    expect(routeFoundCallback).to.have.property('callCount', 1);
                });
            });
        });
    });
});