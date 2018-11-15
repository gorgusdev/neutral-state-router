const chai = require('chai');
const expect = chai.expect;
const manager = require('../cjs/router-config-extension-manager');

describe('router-config-extension-manager', function() {
    describe('addConfig', function() {
        it('should add a root config', function() {
            var configManager = new manager.RouterConfigExtensionManager();
            configManager.addConfig('a', {
                url: '/'
            });
            expect(configManager.toExtensionCallbackResult()).to.deep.equal({ 'a': { url: '/', configs: {} }});
        });

        it('should add a sub config', function() {
            var configManager = new manager.RouterConfigExtensionManager();
            configManager.addConfig('a', {
                url: '/a'
            });
            configManager.addConfig('a.b', {
                url: '/b'
            });
            expect(configManager.toExtensionCallbackResult()).to.deep.equal({ 'a': { url: '/a', configs: { 'b': { url: '/b', configs: {}}}}});
        });

        it('should add a root config with a base config path', function() {
            var configManager = new manager.RouterConfigExtensionManager('pre.fix');
            configManager.addConfig('pre.fix.a', {
                url: '/'
            });
            expect(configManager.toExtensionCallbackResult()).to.deep.equal({ 'a': { url: '/', configs: {} }});
        });

        it('should add a sub config with a base config path', function() {
            var configManager = new manager.RouterConfigExtensionManager('pre.fix');
            configManager.addConfig('pre.fix.a', {
                url: '/a'
            });
            configManager.addConfig('pre.fix.a.b', {
                url: '/b'
            });
            expect(configManager.toExtensionCallbackResult()).to.deep.equal({ 'a': { url: '/a', configs: { 'b': { url: '/b', configs: {}}}}});
        });

        it('should not allow adding with a to short config path', function() {
            var configManager = new manager.RouterConfigExtensionManager('pre.fix');
            expect(function() { 
                configManager.addConfig('pre', {
                    url: '/'
                });
            }).to.throw('path must be longer');
        });

        it('should not allow adding with a config path not matching the base config path', function() {
            var configManager = new manager.RouterConfigExtensionManager('pre.fix');
            expect(function() {
                configManager.addConfig('pre.a.b', {
                    url: '/a'
                });
            }).to.throw('path must start');
        });
    });
});
