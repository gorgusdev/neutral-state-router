const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const expect = chai.expect;
const sinon = require('sinon');
const manager = require('../cjs/router-history-manager');

chai.use(chaiAsPromised);

describe('router-history-manager', function() {
    function createManager(hashMode, urlCallback, fakeLocation, fakeHistory, fakeStorage, fakeWindow, maxHistoryEntries, disposeCallback) {
        const defaultUrlCallback = sinon.stub().returns({
            catch: sinon.spy()
        });
        const defaultDisposeCallback = sinon.spy();
        const defaultFakeLocation = {
            hash: '',
            href: '/a/b',
            pathname: '/a/b',
            search: '',
            reload: sinon.spy(),
        };
        const defaultFakeHistory = {
            state: undefined,
            pushState: sinon.spy(),
            replaceState: sinon.spy()
        };
        const defaultFakeStorage = {
            getItem: sinon.stub()
                .onCall(0).returns('{"nextTrackId":1}')
                .onCall(1).returns('{"nextTrackId":2}')
                .onCall(2).returns('{"nextTrackId":3}')
                .onCall(3).returns('{"nextTrackId":4}')
                .onCall(4).returns('{"nextTrackId":5}'),
            setItem: sinon.spy(),
        };
        const defaultFakeWindow = {
            addEventListener: sinon.spy()
        };
        const historyManager = new manager.RouterHistoryManager(
            '/a',
            hashMode,
            fakeLocation || defaultFakeLocation,
            fakeHistory || defaultFakeHistory,
            fakeStorage || defaultFakeStorage,
            maxHistoryEntries || 10,
            disposeCallback || defaultDisposeCallback
        );
        historyManager.startHistoryUpdates(urlCallback || defaultUrlCallback, fakeWindow || defaultFakeWindow);

        return historyManager;
    }
    describe('startHistoryUpdates', function() {
        it('should set URL update callback and install history API event listeners', function() {
            const urlCallback = sinon.spy();
            const fakeWindow = {
                addEventListener: sinon.spy()
            };
            const historyManager = createManager(true, urlCallback, undefined, undefined, undefined, fakeWindow, undefined, undefined);
            expect(historyManager).to.have.property('updateUrlCallback', urlCallback);
            expect(fakeWindow.addEventListener).to.have.property('callCount', 2);
        });
    });
    describe('stopHistoryUpdates', function() {
        it('should remove URL update callback and uninstall history API event listeners', function() {
            const fakeWindow = {
                addEventListener: sinon.spy(),
                removeEventListener: sinon.spy()
            };
            const historyManager = createManager(true, undefined, undefined, undefined, undefined, fakeWindow, undefined, undefined);
            historyManager.stopHistoryUpdates(fakeWindow);
            expect(historyManager).to.have.property('updateUrlCallback', undefined);
            expect(fakeWindow.removeEventListener).to.have.property('callCount', 2);
        });
    });
    describe('init', function() {
        describe('hash URL mode', function() {
            it('should create a new history API state', function() {
                const fakeLocation = {
                    hash: '#/b',
                    href: '/a#/b',
                    pathname: '/a',
                    search: '',
                    reload: sinon.spy(),
                };
                const fakeHistory = {
                    state: undefined,
                    pushState: sinon.spy(),
                    replaceState: sinon.spy()
                };
                const historyManager = createManager(true, undefined, fakeLocation, fakeHistory, undefined, undefined, undefined, undefined);
                historyManager.init();
                expect(fakeHistory.replaceState).to.have.property('callCount', 1);
                expect(fakeHistory.replaceState.args[0][0]).to.deep.equal({
                    configPath: undefined,
                    url: '/b',
                    historyTrackId: 'routerHistoryTrack1'
                });
            });
            it('should create a new history API state from other URL mode', function() {
                const fakeLocation = {
                    hash: '',
                    href: '/a/b',
                    pathname: '/a/b',
                    search: '',
                    reload: sinon.spy(),
                };
                const fakeHistory = {
                    state: undefined,
                    pushState: sinon.spy(),
                    replaceState: sinon.spy()
                };
                const historyManager = createManager(true, undefined, fakeLocation, fakeHistory, undefined, undefined, undefined, undefined);
                historyManager.init();
                expect(fakeHistory.replaceState).to.have.property('callCount', 1);
                expect(fakeHistory.replaceState.args[0][0]).to.deep.equal({
                    configPath: undefined,
                    url: '/b',
                    historyTrackId: 'routerHistoryTrack1'
                });
            });
            it('should read the current history API state and call url callback', function() {
                const urlCallback = sinon.stub().returns({
                    catch: sinon.spy()
                });
                const fakeLocation = {
                    hash: '#/b',
                    href: '/a#/b',
                    pathname: '/a',
                    search: '',
                    reload: sinon.spy(),
                };
                const fakeHistory = {
                    state: {
                        configPath: 'a.b',
                        url: '/b',
                        historyTrackId: 'routerHistoryTrack2'
                    },
                    pushState: sinon.spy(),
                    replaceState: sinon.spy()
                };
                const historyManager = createManager(true, urlCallback, fakeLocation, fakeHistory, undefined, undefined, undefined, undefined);
                historyManager.init();
                expect(urlCallback).to.have.property('callCount', 1);
            });
        });
        describe('path URL mode', function() {
            it('should create a new history API state', function() {
                const fakeLocation = {
                    hash: '',
                    href: '/a/b',
                    pathname: '/a/b',
                    search: '',
                    reload: sinon.spy(),
                };
                const fakeHistory = {
                    state: undefined,
                    pushState: sinon.spy(),
                    replaceState: sinon.spy()
                };
                const historyManager = createManager(false, undefined, fakeLocation, fakeHistory, undefined, undefined, undefined, undefined);
                historyManager.init();
                expect(fakeHistory.replaceState).to.have.property('callCount', 1);
                expect(fakeHistory.replaceState.args[0][0]).to.deep.equal({
                    configPath: undefined,
                    url: '/b',
                    historyTrackId: 'routerHistoryTrack1'
                });
            });
            it('should create a new history API state from other URL mode', function() {
                const urlCallback = sinon.spy();
                const fakeLocation = {
                    hash: '#/b',
                    href: '/a#/b',
                    pathname: '/a',
                    search: '',
                    reload: sinon.spy(),
                };
                const fakeHistory = {
                    state: undefined,
                    pushState: sinon.spy(),
                    replaceState: sinon.spy()
                };
                const historyManager = createManager(false, urlCallback, fakeLocation, fakeHistory, undefined, undefined, undefined, undefined);
                historyManager.init();
                expect(fakeHistory.replaceState).to.have.property('callCount', 1);
                expect(fakeHistory.replaceState.args[0][0]).to.deep.equal({
                    configPath: undefined,
                    url: '/b',
                    historyTrackId: 'routerHistoryTrack1'
                });
            });
            it('should read the current history API state and call url callback', function() {
                const urlCallback = sinon.stub().returns({
                    catch: sinon.spy()
                });
                const fakeLocation = {
                    hash: '',
                    href: '/a/b',
                    pathname: '/a/b',
                    search: '',
                    reload: sinon.spy(),
                };
                const fakeHistory = {
                    state: {
                        configPath: 'a.b',
                        url: '/b',
                        historyTrackId: 'routerHistoryTrack2'
                    },
                    pushState: sinon.spy(),
                    replaceState: sinon.spy()
                };
                const historyManager = createManager(false, urlCallback, fakeLocation, fakeHistory, undefined, undefined, undefined, undefined);
                historyManager.init();
                expect(urlCallback).to.have.property('callCount', 1);
            });
        });
    });
    describe('reloadAtUrl', function() {
        describe('hash URL mode', function() {
            it('should reload with a provided URL', function() {
                const fakeLocation = {
                    hash: '#/b',
                    href: '/a#/b',
                    pathname: '/a',
                    search: '',
                    reload: sinon.spy(),
                };
                const historyManager = createManager(true, undefined, fakeLocation, undefined, undefined, undefined, undefined, undefined);
                historyManager.reloadAtUrl('/c');
                expect(fakeLocation).to.have.property('hash', '/a#/c');
                expect(fakeLocation.reload).to.have.property('callCount', 1);
            });
        });
        describe('path URL mode', function() {
            it('should reload with a provided URL', function() {
                const fakeLocation = {
                    hash: '',
                    href: '/a/b',
                    pathname: '/a/b',
                    search: '',
                    reload: sinon.spy(),
                };
                const historyManager = createManager(false, undefined, fakeLocation, undefined, undefined, undefined, undefined, undefined);
                historyManager.reloadAtUrl('/c');
                expect(fakeLocation).to.have.property('href', '/a/c');
            });
        });
    });
    describe('navigateTo', function() {
        describe('hash URL mode', function() {
            it('should create a new history API state', function() {
                const fakeHistory = {
                    state: {
                        configPath: 'a.b',
                        url: '/b',
                        historyTrackId: 'routerHistoryTrack1'
                    },
                    pushState: sinon.spy(),
                    replaceState: sinon.spy()
                };
                const historyManager = createManager(true, undefined, undefined, fakeHistory, undefined, undefined, undefined, undefined);
                historyManager.navigateTo('a.c', '/c');
                expect(fakeHistory.pushState).to.have.property('callCount', 1);
                expect(fakeHistory.pushState.args[0][0]).to.deep.equal({
                    configPath: 'a.c',
                    url: '/c',
                    historyTrackId: 'routerHistoryTrack1'
                });
                expect(fakeHistory.pushState.args[0][2]).to.equal('/a#/c');
            });
        });
        describe('path URL mode', function() {
            it('should create a new history API state', function() {
                const fakeHistory = {
                    state: {
                        configPath: 'a.b',
                        url: '/b',
                        historyTrackId: 'routerHistoryTrack1'
                    },
                    pushState: sinon.spy(),
                    replaceState: sinon.spy()
                };
                const historyManager = createManager(false, undefined, undefined, fakeHistory, undefined, undefined, undefined, undefined);
                historyManager.navigateTo('a.c', '/c');
                expect(fakeHistory.pushState).to.have.property('callCount', 1);
                expect(fakeHistory.pushState.args[0][2]).to.equal('/a/c');
            });
        });
    });
    describe('redirectTo', function() {
        describe('hash URL mode', function() {
            it('should create a new history API state and replace the current one', function() {
                const fakeHistory = {
                    state: {
                        configPath: 'a.b',
                        url: '/b',
                        historyTrackId: 'routerHistoryTrack1'
                    },
                    pushState: sinon.spy(),
                    replaceState: sinon.spy()
                };
                const historyManager = createManager(true, undefined, undefined, fakeHistory, undefined, undefined, undefined, undefined);
                historyManager.redirectTo('a.c', '/c');
                expect(fakeHistory.replaceState).to.have.property('callCount', 1);
                expect(fakeHistory.replaceState.args[0][0]).to.deep.equal({
                    configPath: 'a.c',
                    url: '/c',
                    historyTrackId: 'routerHistoryTrack1'
                });
                expect(fakeHistory.replaceState.args[0][2]).to.equal('/a#/c');
            });
        });
        describe('path URL mode', function() {
            it('should create a new history API state and replace the current one', function() {
                const fakeHistory = {
                    state: {
                        configPath: 'a.b',
                        url: '/b',
                        historyTrackId: 'routerHistoryTrack1'
                    },
                    pushState: sinon.spy(),
                    replaceState: sinon.spy()
                };
                const historyManager = createManager(false, undefined, undefined, fakeHistory, undefined, undefined, undefined, undefined);
                historyManager.redirectTo('a.c', '/c');
                expect(fakeHistory.replaceState).to.have.property('callCount', 1);
                expect(fakeHistory.replaceState.args[0][2]).to.equal('/a/c');
            });
        });
    });
    describe('getUrl', function() {
        describe('hash URL mode', function() {
            it('should get the current URL without prefix from location', function() {
                const fakeLocation = {
                    hash: '#/b?x=y',
                    href: '/a#/b',
                    pathname: '/a',
                    search: '',
                    reload: sinon.spy(),
                };
                const historyManager = createManager(true, undefined, fakeLocation, undefined, undefined, undefined, undefined, undefined);
                expect(historyManager.getUrl()).to.equal('/b?x=y');
            });
        });
        describe('path URL mode', function() {
            it('should get the current URL without prefix from location', function() {
                const fakeLocation = {
                    hash: '',
                    href: '/a/b',
                    pathname: '/a/b',
                    search: '?x=y',
                    reload: sinon.spy(),
                };
                const historyManager = createManager(false, undefined, fakeLocation, undefined, undefined, undefined, undefined, undefined);
                expect(historyManager.getUrl()).to.equal('/b?x=y');
            });
        });
    });
    describe('getFullUrl', function() {
        describe('hash URL mode', function() {
            it('should get the current URL with prefix from location', function() {
                const fakeLocation = {
                    hash: '',
                    href: '/a',
                    pathname: '/a',
                    search: '',
                    reload: sinon.spy(),
                };
                const historyManager = createManager(true, undefined, fakeLocation, undefined, undefined, undefined, undefined, undefined);
                expect(historyManager.getFullUrl('/b?x=y')).to.equal('/a#/b?x=y');
            });
        });
        describe('path URL mode', function() {
            it('should get the current URL with prefix from location', function() {
                const fakeLocation = {
                    hash: '',
                    href: '/a',
                    pathname: '/a',
                    search: '',
                    reload: sinon.spy(),
                };
                const historyManager = createManager(false, undefined, fakeLocation, undefined, undefined, undefined, undefined, undefined);
                expect(historyManager.getFullUrl('/b?x=y')).to.equal('/a/b?x=y');
            });
        });
    });
    describe('getConfigPath', function() {
        it('should return undefined if no history entry has been set', function() {
            const historyManager = createManager(false, undefined, undefined, undefined, undefined, undefined, undefined, undefined);
            expect(historyManager.getConfigPath()).to.equal(undefined);
        });
        it('should return current config path', function() {
            const fakeLocation = {
                hash: '',
                href: '/a/b',
                pathname: '/a/b',
                search: '',
                reload: sinon.spy(),
            };
            const historyManager = createManager(false, undefined, fakeLocation, undefined, undefined, undefined, undefined, undefined);
            historyManager.init();
            historyManager.navigateTo('a.c', '/a/c');
            expect(historyManager.getConfigPath()).to.equal('a.c');
        });
    });
    describe('getHistoryTrackId', function() {
        it('should return undefined if no history entry has been set', function() {
            const historyManager = createManager(false, undefined, undefined, undefined, undefined, undefined, undefined, undefined);
            expect(historyManager.getHistoryTrackId()).to.equal(undefined);
        });
        it('should return current history track id', function() {
            const fakeLocation = {
                hash: '',
                href: '/a/b',
                pathname: '/a/b',
                search: '',
                reload: sinon.spy(),
            };
            const historyManager = createManager(false, undefined, fakeLocation, undefined, undefined, undefined, undefined, undefined);
            historyManager.init();
            historyManager.navigateTo('a.c', '/a/c');
            expect(historyManager.getHistoryTrackId()).to.equal('routerHistoryTrack2');
        });
    });

    describe('dispose history entries', function() {
        it('should dispose history entries when to many has been created', function() {
            const fakeHistory = {
                state: undefined,
                pushState: sinon.spy(),
                replaceState: sinon.spy()
            };
            const disposeCallback = sinon.spy();
            const historyManager = createManager(false, undefined, undefined, fakeHistory, undefined, undefined, 2, disposeCallback);
            historyManager.navigateTo('a.c', '/a/c');
            historyManager.navigateTo('a.d', '/a/d');
            historyManager.navigateTo('a.e', '/a/e');
            historyManager.navigateTo('a.f', '/a/f');
            expect(disposeCallback).to.have.property('callCount', 2);
            expect(disposeCallback.args[0][0]).to.equal('routerHistoryTrack1');
            expect(disposeCallback.args[1][0]).to.equal('routerHistoryTrack2');
        });
        it('should dispose forward history entries when navigating from a back history entry', function() {
            const fakeHistory = {
                state: {
                    configPath: 'a.c',
                    url: '/a/c',
                    historyTrackId: 'routerHistoryTrack1'
                },
                pushState: sinon.spy(),
                replaceState: sinon.spy()
            };
            const disposeCallback = sinon.spy();
            const historyManager = createManager(false, undefined, undefined, fakeHistory, undefined, undefined, 10, disposeCallback);
            historyManager.navigateTo('a.c', '/a/c');
            historyManager.navigateTo('a.d', '/a/d');
            historyManager.navigateTo('a.e', '/a/e');
            historyManager.updateUrlFromPopState();
            historyManager.navigateTo('a.f', '/a/f');
            expect(disposeCallback).to.have.property('callCount', 2);
            expect(disposeCallback.args[0][0]).to.equal('routerHistoryTrack2');
            expect(disposeCallback.args[1][0]).to.equal('routerHistoryTrack3');
        });
    });
});