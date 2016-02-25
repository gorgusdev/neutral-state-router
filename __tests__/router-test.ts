// <reference path="../typings/defs.d.ts"/>

jest.dontMock('../src/router');
jest.dontMock('../src/router-exception');
jest.dontMock('../src/router-not-found-exception');
jest.dontMock('extend');
jest.dontMock('path-to-regexp');
jest.dontMock('es6-promise');
jest.dontMock('query-string');
jest.dontMock('strict-uri-encode');

import { Router } from '../src/router';
import { RouterConfig } from '../src/router-types';
import { RouterException } from '../src/router-exception';
import { RouterNotFoundException } from '../src/router-not-found-exception';
import { RouterMemoryHistory } from '../src/router-memory-history';

class TestRouter extends Router {
	getRootConfig(): RouterConfig {
		return this.rootConfig;
	}
	
	triggerUpdateUrl() {
		this.updateUrl();
	}
}

describe('Router', function() {
	var router: TestRouter;
	
	beforeEach(function() {
		router = new TestRouter();
	});
	
	describe('addConfig', function() {
		it('adds a root config', function() {
			router.addConfig('a', {
				url: '/'
			});
			expect(router.getRootConfig().configs).toEqual({ 'a': { url: '/', configs: {} }});
		});
		
		it('adds a sub config', function() {
			router.addConfig('a', {
				url: '/a'
			});
			router.addConfig('a.b', {
				url: '/b'
			});
			expect(router.getRootConfig().configs).toEqual({ 'a': { url: '/a', configs: { 'b': { url: '/b', configs: {}}}}});
		});
		
		it('rebuilds internal config data if router is running', function() {
			var history = new RouterMemoryHistory();
			router.start(history, () => {});
			router.addConfig('a', {
				url: '/a'
			});
			expect((<any>router.getRootConfig().configs['a']).pathRegExp).toBeDefined();
		});
	});
	
	describe('start', function() {
		var history: RouterMemoryHistory;
		
		beforeEach(function() {
			history = new RouterMemoryHistory();
		});
		
		it('sets the running flag', function() {
			router.start(history, () => {});
			expect(router.isRunning()).toEqual(true);
		});
		
		it('installs an url update callback', function() {
			router.start(history, () => {});
			expect((<any>history.startHistoryUpdates).mock.calls.length).toBe(1);
		});
		
		it('builds internal config data', function() {
			router.addConfig('a', {
				url: '/a'
			});
			router.start(history, () => {});
			expect((<any>router.getRootConfig().configs['a']).pathRegExp).toBeDefined();
		});
		
		it('can only be called if the router is not running', function() {
			router.start(history, () => {});
			expect(router.start(history, () => {})).toThrow(RouterException);
		})
	});
	
	describe('stop', function() {
		var history: RouterMemoryHistory;
		
		beforeEach(function() {
			history = new RouterMemoryHistory();
		});
		
		it('clears the running flag', function() {
			router.start(history, () => {});
			router.stop();
			expect(router.isRunning()).toEqual(false);
		});
		
		it('uninstalls an url update callback', function() {
			router.start(history, () => {});
			router.stop();
			expect((<any>history.stopHistoryUpdates).mock.calls.length).toBe(1);
		});
		
		it('can be called even if the router is not running', function() {
			router.start(history, () => {});
			router.stop();
			router.stop();
			expect((<any>history.stopHistoryUpdates).mock.calls.length).toBe(1);
		})
	});
	
	describe('navigateTo', function() {
		var history: RouterMemoryHistory;
		
		beforeEach(function() {
			router = new TestRouter();
			router.addConfig('a', {
				url: '/a',
				configs: {
					'b1': {
						url: '/b1'
					},
					'b2': {
						url: '/b2',
						configs: {
							'c1': {
								url: '/:uArg'
							}
						}
					},
					'b3': {
						url: '/b3',
						unrouted: true,
						configs: {
							'c1': {
								url: '/c1',
								reloadable: true
							}
						}
					}
				}
			});
			history = new RouterMemoryHistory();
		});
		
		it('calls route found callback', function(done) {
			router.start(history, (routerState) => {
				expect(routerState.configPath).toBe('a');
				done();
			});
			router.navigateTo('a');
			jest.runAllTimers();
		});
		
		it('calls route not found callback', function(done) {
			router.start(history, (routerState) => {}, (configPath: string, fullUrl: string, matchedConfigs: RouterConfig[], error: any) => {
				expect(configPath).toBe('z');
				done();
			});
			router.navigateTo('z');
			jest.runAllTimers();
		});

		it('calls transition begin callback', function(done) {
			router.start(history, (routerState) => {}, () => {}, () => {}, (transitionId: number) => {
				expect(transitionId).toBe(1);
				done();
			});
			router.navigateTo('a');
			jest.runAllTimers();
		});

		it('calls transition end callback', function(done) {
			router.start(history, (routerState) => {}, () => {}, () => {}, () => {}, () => {}, (transitionId: number) => {
				expect(transitionId).toBe(1);
				done();
			});
			router.navigateTo('a');
			jest.runAllTimers();
		});
		
		it('calls transition cancel callback', function(done) {
			router.start(history, (routerState) => {}, () => {}, () => {}, () => {}, (transitionId: number) => {
				expect(transitionId).toBe(1);
				done();
			});
			router.navigateTo('a');
			router.navigateTo('a.b1');
			jest.runAllTimers();
		});
		
		it('applies url parameters', function(done) {
			router.start(history, (routerState) => {
				expect(routerState.urlParams).toEqual({ uArg: 'uValue' });
				expect((<any>history.navigateTo).mock.calls.length).toBe(1);
				expect((<any>history.navigateTo).mock.calls[0]).toEqual(['a.b2.c1', '/a/b2/uValue']);
				done();
			});
			router.navigateTo('a.b2.c1', { uArg: 'uValue' });
			jest.runAllTimers();
		});
		
		it('applies query parameters', function(done) {
			router.start(history, (routerState) => {
				expect(routerState.queryParams).toEqual({ qArg: 'qValue' });
				expect((<any>history.navigateTo).mock.calls.length).toBe(1);
				expect((<any>history.navigateTo).mock.calls[0]).toEqual(['a', '/a?qArg=qValue']);
				done();
			});
			router.navigateTo('a', {}, { qArg: 'qValue' });
			jest.runAllTimers();
		});
		
		it('can only be called if the router is running', function() {
			expect(router.navigateTo('a')).toThrow(RouterException);
		});
		
		it('will not navigate to unrouted states', function(done) {
			router.start(history, (routerState) => {}, (configPath: string, fullUrl: string, matchedConfigs: RouterConfig[], error: any) => {
				expect(configPath).toBe('a.b3');
				expect(error instanceof RouterNotFoundException).toBeTruthy();
				done();
			});
			router.navigateTo('a.b3');
			jest.runAllTimers();
		});
		
		it('will ask history to reload when navigating to reloadable state', function(done) {
			router.start(history, (routerState) => {
				expect((<any>history.reloadAtUrl).mock.calls.length).toBe(1);
				done();
			});
			router.requestReload();
			router.navigateTo('a.b3.c1');
			jest.runAllTimers();
		});
	});
	
	// Remember to add test for a updateUrl('/'): { url: '/', configs: { b: { configs: { c: { url: '/c' }}}}}
});
