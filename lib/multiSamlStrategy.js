"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MultiSamlStrategy = void 0;
const strategy_1 = require("./strategy");
const node_saml2_1 = require("@techteamer/node-saml2");
class MultiSamlStrategy extends strategy_1.AbstractStrategy {
    constructor(options, signonVerify, logoutVerify) {
        if (!options || typeof options.getSamlOptions !== "function") {
            throw new Error("Please provide a getSamlOptions function");
        }
        // Force the type on this since we've disabled `newOnConstruct`
        // so the `SAML` constructor will not be called at this time
        // and there are defaults for all `strategy`-required options.
        const samlConfig = {
            ...options,
        };
        super(samlConfig, signonVerify, logoutVerify);
        this._options = samlConfig;
    }
    authenticate(req, options) {
        this._options.getSamlOptions(req, (err, samlOptions) => {
            if (err) {
                return this.error(err);
            }
            const samlService = new node_saml2_1.SAML({ ...this._options, ...samlOptions });
            const strategy = Object.assign({}, this, { _saml: samlService });
            Object.setPrototypeOf(strategy, this);
            super.authenticate.call(strategy, req, options);
        });
    }
    logout(req, callback) {
        this._options.getSamlOptions(req, (err, samlOptions) => {
            if (err) {
                return callback(err);
            }
            const samlService = new node_saml2_1.SAML(Object.assign({}, this._options, samlOptions));
            const strategy = Object.assign({}, this, { _saml: samlService });
            Object.setPrototypeOf(strategy, this);
            super.logout.call(strategy, req, callback);
        });
    }
    generateServiceProviderMetadata(req, decryptionCert, signingCert, callback) {
        if (typeof callback !== "function") {
            throw new Error("Metadata can't be provided synchronously for MultiSamlStrategy.");
        }
        return this._options.getSamlOptions(req, (err, samlOptions) => {
            if (err) {
                return callback(err);
            }
            const samlService = new node_saml2_1.SAML(Object.assign({}, this._options, samlOptions));
            const strategy = Object.assign({}, this, { _saml: samlService });
            Object.setPrototypeOf(strategy, this);
            return callback(null, this._generateServiceProviderMetadata.call(strategy, decryptionCert, signingCert));
        });
    }
    // This is reduntant, but helps with testing
    error(err) {
        super.error(err);
    }
}
exports.MultiSamlStrategy = MultiSamlStrategy;
MultiSamlStrategy.newSamlProviderOnConstruct = false;
//# sourceMappingURL=multiSamlStrategy.js.map