"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Strategy = exports.AbstractStrategy = void 0;
const passport_strategy_1 = require("passport-strategy");
const assert_1 = require("assert");
const url = require("url");
const _1 = require(".");
class AbstractStrategy extends passport_strategy_1.Strategy {
    constructor(options, signonVerify, logoutVerify) {
        super();
        if (typeof options === "function") {
            throw new Error("Mandatory SAML options missing");
        }
        if (!signonVerify || typeof signonVerify != "function") {
            throw new Error("SAML authentication strategy requires a verify function");
        }
        // Customizing the name can be useful to support multiple SAML configurations at the same time.
        // Unlike other options, this one gets deleted instead of passed along.
        if (options.name) {
            this.name = options.name;
        }
        else {
            this.name = "saml";
        }
        this._signonVerify = signonVerify;
        this._logoutVerify = logoutVerify;
        if (this.constructor.newSamlProviderOnConstruct) {
            this._saml = new _1.SAML(options);
        }
        this._passReqToCallback = !!options.passReqToCallback;
    }
    authenticate(req, options) {
        var _a, _b, _c, _d, _e;
        if (this._saml == null) {
            throw new Error("Can't get authenticate without a SAML provider defined.");
        }
        options.samlFallback = options.samlFallback || "login-request";
        const validateCallback = async ({ profile, loggedOut, }) => {
            if (loggedOut) {
                if (profile != null) {
                    // When logging out a user, use the consumer's `validate` function to check that
                    // the `profile` associated with the logout request resolves to the same user
                    // as the `profile` associated with the current session.
                    const verified = async (logoutUser) => {
                        var _a, _b;
                        let userMatch = true;
                        try {
                            // Check to see if we are logging out the user that is currently logged in to craft a proper IdP response
                            // It is up to the caller to return the same `User` as we have currently recorded as logged in for a successful logout
                            assert_1.strict.deepStrictEqual(req.user, logoutUser);
                        }
                        catch (err) {
                            userMatch = false;
                        }
                        const RelayState = ((_a = req.query) === null || _a === void 0 ? void 0 : _a.RelayState) || ((_b = req.body) === null || _b === void 0 ? void 0 : _b.RelayState);
                        if (this._saml == null) {
                            return this.error(new Error("Can't get logout response URL without a SAML provider defined."));
                        }
                        else {
                            this._saml.getLogoutResponseUrl(profile, RelayState, options, userMatch, redirectIfSuccess);
                        }
                        // Log out the current user no matter if we can verify the logged in user === logout requested user
                        await new Promise((resolve, reject) => {
                            req.logout((err) => {
                                if (err) {
                                    return reject(err);
                                }
                                resolve(undefined);
                            });
                        });
                    };
                    let logoutUser;
                    try {
                        logoutUser = await new Promise((resolve, reject) => {
                            const verifedCallback = (err, logoutUser) => {
                                if (err) {
                                    return reject(err);
                                }
                                resolve(logoutUser);
                            };
                            if (this._passReqToCallback) {
                                this._logoutVerify(req, profile, verifedCallback);
                            }
                            else {
                                this._logoutVerify(profile, verifedCallback);
                            }
                        });
                    }
                    catch (err) {
                        return this.error(err);
                    }
                    await verified(logoutUser);
                }
                else {
                    // If the `profile` object was null, this is just a logout acknowledgment, so we take no action
                    return this.pass();
                }
            }
            else {
                const verified = (err, user, info) => {
                    if (err) {
                        return this.error(err);
                    }
                    if (!user) {
                        return this.fail(info, 401);
                    }
                    this.success(user, info);
                };
                if (this._passReqToCallback) {
                    this._signonVerify(req, profile, verified);
                }
                else {
                    this._signonVerify(profile, verified);
                }
            }
        };
        const redirectIfSuccess = (err, url) => {
            if (err) {
                this.error(err);
            }
            else if (url == null) {
                this.error(new Error("Invalid logout redirect URL."));
            }
            else {
                this.redirect(url);
            }
        };
        if (((_a = req.query) === null || _a === void 0 ? void 0 : _a.SAMLResponse) || ((_b = req.query) === null || _b === void 0 ? void 0 : _b.SAMLRequest)) {
            const originalQuery = (_c = url.parse(req.url).query) !== null && _c !== void 0 ? _c : "";
            this._saml
                .validateRedirectAsync(req.query, originalQuery)
                .then(validateCallback)
                .catch((err) => this.error(err));
        }
        else if ((_d = req.body) === null || _d === void 0 ? void 0 : _d.SAMLResponse) {
            this._saml
                .validatePostResponseAsync(req.body)
                .then(validateCallback)
                .catch((err) => this.error(err));
        }
        else if ((_e = req.body) === null || _e === void 0 ? void 0 : _e.SAMLRequest) {
            this._saml
                .validatePostRequestAsync(req.body)
                .then(validateCallback)
                .catch((err) => this.error(err));
        }
        else {
            const requestHandler = {
                "login-request": async () => {
                    try {
                        if (this._saml == null) {
                            throw new Error("Can't process login request without a SAML provider defined.");
                        }
                        const RelayState = (req.query && req.query.RelayState) || (req.body && req.body.RelayState);
                        const host = req.headers && req.headers.host;
                        if (this._saml.options.authnRequestBinding === "HTTP-POST") {
                            const data = await this._saml.getAuthorizeFormAsync(RelayState, host);
                            const res = req.res;
                            res === null || res === void 0 ? void 0 : res.send(data);
                        }
                        else {
                            // Defaults to HTTP-Redirect
                            this.redirect(await this._saml.getAuthorizeUrlAsync(RelayState, host, options));
                        }
                    }
                    catch (err) {
                        this.error(err);
                    }
                },
                "logout-request": async () => {
                    if (this._saml == null) {
                        throw new Error("Can't process logout request without a SAML provider defined.");
                    }
                    try {
                        const RelayState = (req.query && req.query.RelayState) || (req.body && req.body.RelayState);
                        // Defaults to HTTP-Redirect
                        this.redirect(await this._saml.getLogoutUrlAsync(req.user, RelayState, options));
                    }
                    catch (err) {
                        this.error(err);
                    }
                },
            }[options.samlFallback];
            requestHandler();
        }
    }
    logout(req, callback) {
        if (this._saml == null) {
            throw new Error("Can't logout without a SAML provider defined.");
        }
        const RelayState = (req.query && req.query.RelayState) || (req.body && req.body.RelayState);
        this._saml
            .getLogoutUrlAsync(req.user, RelayState, {})
            .then((url) => callback(null, url))
            .catch((err) => callback(err));
    }
    _generateServiceProviderMetadata(decryptionCert, signingCert) {
        if (this._saml == null) {
            throw new Error("Can't generate service provider metadata without a SAML provider defined.");
        }
        return this._saml.generateServiceProviderMetadata(decryptionCert, signingCert);
    }
    // This is redundant, but helps with testing
    error(err) {
        super.error(err);
    }
    redirect(url, status) {
        super.redirect(url, status);
    }
    success(user, info) {
        super.success(user, info);
    }
}
exports.AbstractStrategy = AbstractStrategy;
class Strategy extends AbstractStrategy {
    generateServiceProviderMetadata(decryptionCert, signingCert) {
        return this._generateServiceProviderMetadata(decryptionCert, signingCert);
    }
}
exports.Strategy = Strategy;
Strategy.newSamlProviderOnConstruct = true;
//# sourceMappingURL=strategy.js.map