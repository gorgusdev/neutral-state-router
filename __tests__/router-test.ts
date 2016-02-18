// <reference path="../typings/defs.d.ts"/>

jest.dontMock('../src/router');
jest.dontMock('../src/router-exception');
jest.dontMock('extend');
jest.dontMock('path-to-regexp');

import { Router } from '../src/router';
import { RouterConfig } from '../src/router-types';
import { RouterException } from '../src/router-exception';
import { RouterMemoryHistory } from '../src/router-memory-history';

class TestRouter extends Router {
	getRootConfig(): RouterConfig {
		return this.rootConfig;
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
		
	});
	
});
