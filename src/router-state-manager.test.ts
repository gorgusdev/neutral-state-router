import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import { RouterStateManager } from './router-state-manager';

chai.use(chaiAsPromised);

describe('router-state-manager', function() {
    describe('updateState', function() {
		it('should build a simple state', function() {
            var stateManager = new RouterStateManager();
			var state = stateManager.updateState('a', '/a', {}, {}, 'track1', 1, [{
				data: {
					test: 'value'
				}
			}], undefined, undefined);
			expect(state).to.deep.equal({
				configPath: 'a',
				url: '/a',
				urlParams: {},
				queryParams: {},
				historyTrackId: 'track1',
				transitionId: 1,
				data: {
					test: 'value'
				}
			});
		});

		it('should build a simple state and make it available as current state', function() {
            var stateManager = new RouterStateManager();
			var state = stateManager.updateState('a', '/a', {}, {}, 'track1', 1, [{
				data: {
					test: 'value'
				}
			}], undefined, undefined);
			expect(stateManager.getCurrentState()).to.deep.equal({
				configPath: 'a',
				url: '/a',
				urlParams: {},
				queryParams: {},
				historyTrackId: 'track1',
				transitionId: 1,
				data: {
					test: 'value'
				}
			});
		});

		it('should build a simple state with data from extra state data', function() {
            var stateManager = new RouterStateManager();
			var state = stateManager.updateState('a', '/a', {}, {}, 'track1', 1, [{
				data: {
					test: 'value'
				}
			}], {
				test2: 'value2'
			}, undefined);
			expect(state).to.deep.equal({
				configPath: 'a',
				url: '/a',
				urlParams: {},
				queryParams: {},
				historyTrackId: 'track1',
				transitionId: 1,
				data: {
					test: 'value',
					test2: 'value2'
				}
			});
		});

		it('should build a state by merging data from multiple configs', function() {
            var stateManager = new RouterStateManager();
			var state = stateManager.updateState('a', '/a', {}, {}, 'track1', 1, [{
				data: {
					test: 'value'
				}
			}, {
				data: {
					test2: 'value2'
				}
			}], undefined, undefined);
			expect(state).to.deep.equal({
				configPath: 'a',
				url: '/a',
				urlParams: {},
				queryParams: {},
				historyTrackId: 'track1',
				transitionId: 1,
				data: {
					test: 'value',
					test2: 'value2'
				}
			});
		});

		it('should rebuild a state by adding and removing data from multiple configs', function() {
			var stateManager = new RouterStateManager();
			var config1 = {
				data: {
					test1: 'value1'
				}
			};
			var config2 = {
				data: {
					test2: 'value2'
				}
			};
			var config3 = {
				data: {
					test3: 'value3'
				}
			};
			stateManager.updateState('a', '/a', {}, {}, 'track1', 1, [config1, config2], undefined, undefined);
			var state = stateManager.updateState('a', '/a', {}, {}, 'track1', 1, [config1, config3], undefined, undefined);
			expect(state).to.deep.equal({
				configPath: 'a',
				url: '/a',
				urlParams: {},
				queryParams: {},
				historyTrackId: 'track1',
				transitionId: 1,
				data: {
					test1: 'value1',
					test3: 'value3'
				}
			});
		});

		it('should use refresh, setup and teardown callbacks to create the state', function() {
			var stateManager = new RouterStateManager();
			var refreshCallback = sinon.stub().returns({ refresh: 'refresh' });
			var config1 = {
				refreshCallback: refreshCallback,
				data: {
					test1: 'value1'
				}
			};
			var teardownCallback = sinon.spy();
			var config2 = {
				teardownCallback: teardownCallback,
				data: {
					test2: 'value2'
				}
			};
			var setupCallback = sinon.stub().returns({ setup: 'setup' });
			var config3 = {
				setupCallback: setupCallback,
				data: {
					test3: 'value3'
				}
			};
			stateManager.updateState('a', '/a', {}, {}, 'track1', 1, [config1, config2], undefined, undefined);
			var state = stateManager.updateState('a', '/a', {}, {}, 'track1', 1, [config1, config3], undefined, undefined);
			expect(state).to.deep.equal({
				configPath: 'a',
				url: '/a',
				urlParams: {},
				queryParams: {},
				historyTrackId: 'track1',
				transitionId: 1,
				data: {
					refresh: 'refresh',
					setup: 'setup'
				}
			});
			expect(setupCallback).to.have.property('callCount', 1);
			expect(refreshCallback).to.have.property('callCount', 1);
			expect(teardownCallback).to.have.property('callCount', 1);
		});

		it('should not merge non inherited data properties from parent configs', function() {
			var stateManager = new RouterStateManager();
			stateManager.setNonInheritedStateDataPropNames(['test1']);
			var state = stateManager.updateState('a', '/a', {}, {}, 'track1', 1, [{
				data: {
					test1: 'value1'
				}
			}, {
				data: {
					test2: 'value2'
				}
			}], undefined, undefined);
			expect(state).to.deep.equal({
				configPath: 'a',
				url: '/a',
				urlParams: {},
				queryParams: {},
				historyTrackId: 'track1',
				transitionId: 1,
				data: {
					test2: 'value2'
				}
			});
		});

		it('should concat accumulated properties from all configs', function() {
			var stateManager = new RouterStateManager();
			stateManager.setAccumulatedStateDataPropNames(['test1']);
			var state = stateManager.updateState('a', '/a', {}, {}, 'track1', 1, [{
				data: {
					test1: 'value1'
				}
			}, {
				data: {
					test1: 'value2'
				}
			}], undefined, undefined);
			expect(state).to.deep.equal({
				configPath: 'a',
				url: '/a',
				urlParams: {},
				queryParams: {},
				historyTrackId: 'track1',
				transitionId: 1,
				data: {
					test1: ['value1', 'value2']
				}
			});
		});

		it('should accumulated properties that start with a plus character from all configs', function() {
			var stateManager = new RouterStateManager();
			var state = stateManager.updateState('a', '/a', {}, {}, 'track1', 1, [{
				data: {
					'+test1': 'value1'
				}
			}, {
				data: {
					'+test1': 'value2'
				}
			}], undefined, undefined);
			expect(state).to.deep.equal({
				configPath: 'a',
				url: '/a',
				urlParams: {},
				queryParams: {},
				historyTrackId: 'track1',
				transitionId: 1,
				data: {
					test1: ['value1', 'value2']
				}
			});
		});

		it('should flatten arrays in accumulated properties from all configs', function() {
			var stateManager = new RouterStateManager();
			stateManager.setAccumulatedStateDataPropNames(['test1']);
			var state = stateManager.updateState('a', '/a', {}, {}, 'track1', 1, [{
				data: {
					test1: 'value1'
				}
			}, {
				data: {
					test1: ['value2', 'value3']
				}
			}], undefined, undefined);
			expect(state).to.deep.equal({
				configPath: 'a',
				url: '/a',
				urlParams: {},
				queryParams: {},
				historyTrackId: 'track1',
				transitionId: 1,
				data: {
					test1: ['value1', 'value2', 'value3']
				}
			});
		});

	});
});
